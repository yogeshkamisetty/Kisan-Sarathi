# System Architecture & Technical Decisions
**System:** KisanSaathi — *Fasal Awaaz*
**Architecture Pattern:** Offline-First React Native Client + Modular Monolith Backend (Node.js / NestJS / TypeScript) + PostgreSQL + Redis + S3/MinIO

---

## 1. End-to-End Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                        FARMER / FAMILY HELPER / CSC OPERATOR                      |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                 REACT NATIVE (EXPO) ANDROID MOBILE APPLICATION                    |
|                                                                                   |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  | Voice UI & Recorder   |  | Encrypted SQLite Store |  | Dynamic Review Cards |  |
|  | - 16kHz Mono WAV/M4A  |  | - Local Drafts         |  | - Confirmed / Missing|  |
|  | - Replay & Text Input |  | - Turn-by-Turn State   |  | - Voice Readback UI  |  |
|  +-----------+-----------+  +-----------+------------+  +----------+-----------+  |
|              |                          |                          |              |
|              +--------------------------+--------------------------+              |
|                                         |                                         |
|                         +---------------v----------------+                        |
|                         | Offline Sync & Retry Queue     |                        |
|                         | (Idempotency-Key + NetInfo)    |                        |
|                         +---------------+----------------+                        |
+-----------------------------------------|-----------------------------------------+
                                          | HTTPS REST (/api/v1/*)
                                          v
+-----------------------------------------------------------------------------------+
|                      NODE.JS + NESTJS MODULAR MONOLITH API                        |
|                                                                                   |
|  +--------------+  +---------------+  +----------------+  +--------------------+  |
|  | Auth & RBAC  |  | Consent &     |  | Report & State |  | Policy & Deadline  |  |
|  | - OTP Adapter|  | Audit Module  |  | Machine Module |  | Engine Module      |  |
|  | - JWT Guards |  | - DPDP Logs   |  | - 9 Internal   |  | - PMFBY 72h / 7d   |  |
|  +--------------+  +---------------+  |   States       |  | - State Separation |  |
|                                       | - 4 Submission |  +--------------------+  |
|  +---------------------------------+  |   States       |                          |
|  | Voice & Conversation Engine     |  +----------------+  +--------------------+  |
|  | - Dynamic Question Engine       |                      | Document Generator |  |
|  | - Deterministic Validation      |                      | - Bilingual HTML   |  |
|  | - SpeechProvider Interface      |                      |   to PDF & Text    |  |
|  | - TextToSpeechProvider Interface|                      | - Watermarked      |  |
|  +--------+---------------+--------+                      +---------+----------+  |
+-----------|---------------|-----------------------------------------|-------------+
            |               |                                         |
            v               v                                         v
+-------------------+ +--------------------+            +---------------------------+
| GNANI AI VACHANA  | | EXTRACTION ENGINE  |            | DATA & STORAGE LAYER      |
| - Prisma v3.0 STT | | - Deterministic +  |            | - PostgreSQL 16 (Prisma)  |
|   POST /stt/v3    | |   Schema-Bound LLM |            | - Redis 7 (BullMQ Jobs)   |
| - Timbre v2.5 TTS | | - Confidence &     |            | - MinIO / S3 (PDFs &      |
|   /v1/tts/infer   | |   Source Tracking  |            |   Geo-Tagged Evidence)    |
+-------------------+ +--------------------+            +---------------------------+
```

---

## 2. Key Architectural Decisions (ADRs)

### ADR-01: Modular Monolith over Microservices
- **Context:** Field deployments and hackathon/pilot operations require simple operational monitoring, transactional consistency across report revisions and audit events, and zero distributed network hops between extraction, validation, and policy checks.
- **Decision:** Implement a strict **NestJS Modular Monolith** with 21 domain modules (`auth`, `users`, `farmers`, `consent`, `languages`, `reports`, `incidents`, `crop-data`, `fields`, `insurance`, `conversation`, `voice`, `gnani`, `extraction`, `validation`, `policy`, `evidence`, `documents`, `notifications`, `submission-records`, `audit`, `admin`, `health`, `common`).

### ADR-02: PostgreSQL with Relational Auditability over NoSQL
- **Context:** Crop-loss intimation drafts require strict foreign-key integrity between `Report`, `ConversationTurn`, `ExtractedValue` (`source_turn_id`), `PolicyVersion`, `OfficialSubmissionRecord`, and `AuditEvent`.
- **Decision:** Use **PostgreSQL 16** managed via Prisma migrations so every field in a generated PDF report can be traced back to the exact spoken turn (`source_turn_id`) and revision history (`AuditEvent`).

### ADR-03: Deterministic State Machine + Schema-Constrained Extraction
- **Context:** Unrestricted generative AI chatbots can hallucinate survey numbers, invent dates, or give inaccurate legal insurance advice.
- **Decision:**
  1. The **Question Engine** is 100% deterministic: it inspects current report fields, ranks missing/uncertain fields by clinical priority (`incident_date` → `village/district` → `crop_name` → `incident_type` → `crop_stage` → `affected_area` → `insured_status` → optional `survey_number` / `application_number`), and selects the next verified localized question template.
  2. The **Extraction Engine** produces schema-validated field objects with `confidence`, `source_text`, and `status = 'needs_confirmation'`. Deterministic validators check date bounds (not in the future, flag if >72h), area constraints (`affected_area > 0` and `<= cultivated_area`), and post-harvest drying rules.
  3. **Zero Silent Promotion:** No AI-extracted critical field becomes `confirmed` until the farmer explicitly confirms it during Review (Screen 06) or Voice Readback (Screen 07).

### ADR-04: Dual-Track Workflow & Submission State Machines
- **Internal Preparation Status (`WorkflowStatus`):**
  `DRAFT_LOCAL` → `SYNC_PENDING` → `IN_PROGRESS` → `NEEDS_REVIEW` → `READY_FOR_EXPORT` → `EXPORTED` → `COMPLETION_PENDING` → `COMPLETED` (plus `CANCELLED`).
- **Official Submission Status (`SubmissionStatus`):**
  `NOT_SUBMITTED` → `FARMER_REPORTED_SUBMITTED` → `ACKNOWLEDGEMENT_ENTERED` → `OFFICIALLY_VERIFIED`.
- **Rule:** Generating or exporting a PDF transitions `WorkflowStatus` to `EXPORTED` (or `COMPLETION_PENDING` if optional fields like `survey_number` are missing), while `SubmissionStatus` remains `NOT_SUBMITTED` until the farmer contacts an official channel and records their reference on Screen 10. Even then, manual entry sets `ACKNOWLEDGEMENT_ENTERED` (labelled *Farmer-Reported, Not Independently Verified by Government*), never `OFFICIALLY_VERIFIED`.
