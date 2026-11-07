# Product Requirements Document (PRD), Risk Register & MVP Roadmap
**Product Name:** KisanSaathi — *Fasal Awaaz* (फ़सल आवाज़ / పంట గొంతుक)
**Tagline:** Speak. Verify. Prepare. Report.
**Category:** AgriTech / InsurTech / Multilingual Voice AI
**Primary Technology Partner:** Gnani AI (Prisma STT & Timbre TTS via Vachana Platform)
**Document Version:** 1.0.0 | **Last Verified:** 2026-11-04

---

## 1. Executive Summary & Product Boundary

### 1.1 Problem Statement
Agricultural distress following hailstorms, unseasonal heavy rains, inundation, landslides, or post-harvest cyclonic rain requires rapid documentation. Under the **Pradhan Mantri Fasal Bima Yojana (PMFBY)** [Operational Guidelines](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf), farm-level assessment for **Localised Calamities** and **Post-Harvest Losses** requires initial intimation within **72 hours** of the event via approved channels (such as the Krishi Rakshak Helpline **14447** or the official Crop Insurance App). Farmers frequently miss this window due to:
1. Unfamiliarity with procedural differences between localised calamity, post-harvest cut-and-spread drying damage, and general yield loss.
2. Complex multi-field digital forms requiring English or formal literary phrasing.
3. Missing secondary documents (e.g., exact survey/khasra number or policy application number) that delay initial reporting even though initial intimation can be lodged first and completed within the applicable follow-up window.
4. Power and mobile network outages immediately following severe weather events.

### 1.2 Solution Overview
**Fasal Awaaz** (under the **KisanSaathi** initiative) is an offline-capable, multilingual AI voice assistant engineered for Android smartphones. It guides farmers through explaining crop damage naturally in their native language, extracts schema-constrained structured fields with confidence and source-utterance attribution, asks only relevant missing follow-up questions, reads critical values back aloud using **Gnani Timbre TTS**, records corrections with an immutable audit trail, and produces a timestamped bilingual **Crop Loss Intimation Draft** (PDF and plain text) paired with verified official reporting instructions.

### 1.3 Strict Product Boundary (Non-Negotiable)
Fasal Awaaz is an **AI-Assisted Crop-Loss Intimation Preparation System**.
- **IT IS NOT** an official PMFBY claim-submission portal or government acknowledgement system.
- **IT IS NOT** an insurance company, claim adjudication system, or compensation calculator.
- **IT NEVER** displays "Claim Submitted" or "Approved" upon generating a PDF report. Every exported document and UI screen prominently displays:
  > **`DRAFT – NOT OFFICIALLY SUBMITTED`**
  > *"This document is a farmer-prepared information summary. It is not an official claim submission, official acknowledgement, eligibility determination or guarantee of compensation."*

---

## 2. Target User Personas & Attribution Modes

| Persona | Role Enum | Core Needs & System Controls |
| :--- | :--- | :--- |
| **A. Farmer (Primary User)** | `FARMER` | Voice-first intake in native language, large 56dp+ touch targets, spoken verification readback, offline draft persistence, one-tap dialer launch to Helpline `14447`. |
| **B. Assisting Family Member** | `FAMILY_HELPER` | Operates device on behalf of an affected relative. System explicitly records `operator_relationship` and separates device operator identity from the affected `FarmerProfile`. |
| **C. CSC Operator / Krishi Mitra** | `CSC_OPERATOR` | Assisted reporting mode (`CSC_ASSISTED`) requiring explicit farmer consent capture, operator ID attribution, and zero silent modification of farmer-confirmed statements. |
| **D. System Administrator** | `ADMIN` | Configures verified state/district/season policy rules, active language packs, and monitors voice provider health. Cannot alter farmer report fields without an immutable `AuditEvent`. |

---

## 3. Feature Priority Matrix (Levels 1, 2, and 3)

### Level 1: Essential MVP (Implemented & Verified)
1. **Language Selection (Screen 01):** Tested language packs (`hi-IN`, `te-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `en-IN`) gated by voice workflow readiness.
2. **Welcome & Granular Consent (Screen 02):** Explicit opt-in before audio capture, Gnani AI transmission, GPS capture, photo attachment, and local/server storage.
3. **Farmer Onboarding (Screen 03):** Captures minimum required profile (Name, Mobile, State, District, Village, Preferred Language, plus Assisted Mode attribution). Never collects full bank account numbers.
4. **Voice Recording & Fallback (Screen 04):** Record, stop, replay, retry, manual text input, and partial draft continuation.
5. **Gnani Prisma STT Adapter:** Multipart upload to `POST https://api.vachana.ai/stt/v3` with `X-API-Key-ID`, `model=prisma-v3.0`, `format=transcribe`, and agricultural `keyterms` boosting.
6. **Schema-Constrained Extraction Engine:** Extracts structured fields with `confidence`, `source_text`, `source_turn_id`, and `status` (`needs_confirmation`, `confirmed`, `missing`, `approximate`, `uncertain`).
7. **Deterministic Dynamic Question Engine (Screen 05):** Priority-ordered state machine that asks only for missing/uncertain fields without repeating confirmed facts.
8. **Information Review Cards (Screen 06):** Card-by-card status badges, manual edit, and speak-to-correct workflows.
9. **Gnani Timbre TTS Voice Readback (Screen 07):** Spoken verification of critical fields (crop, loss event, incident date, affected area, village) via `POST https://api.vachana.ai/api/v1/tts/inference` (`timbre-v2.5` / `timbre-v3.0`) with text fallback.
10. **Bilingual Timestamped Report Generation (Screen 08):** Generates printable PDF and plain-text summaries with device timestamp, server sync timestamp, revision number, missing-field checklist, and mandatory `DRAFT – NOT OFFICIALLY SUBMITTED` watermark/banner.
11. **Official Reporting Guidance (Screen 09):** Verified PMFBY channels (Helpline `14447`, Krishi Rakshak Portal, Crop Insurance App, Bank Branch, Agriculture Office) with explicit user-initiated call trigger.
12. **Official Reference Entry (Screen 10):** Records `FARMER_REPORTED_SUBMITTED` and `ACKNOWLEDGEMENT_ENTERED` separately from `OFFICIALLY_VERIFIED`.
13. **Follow-Up & 7-Day Completion Tracker (Screen 11):** Tracks pending survey numbers, application numbers, and evidence attachments with full revision audit logging.

### Level 2: Important Enhancements (Implemented in Codebase)
- Photo evidence metadata & S3/MinIO presigned upload flow.
- GPS-assisted field location capture with explicit permission and manual override.
- Bilingual PDF generation (Farmer's selected language + English).
- Policy-aware 72-hour urgency indicator and 7-day completion countdown.
- CSC Operator / Family Member assisted mode attribution.
- Offline SQLite draft storage and idempotent background synchronization queue (`Idempotency-Key` header).

### Level 3: Future Roadmap (Architected Extension Points)
- State-specific notification ingestion connectors (e.g., automated state gazette/notification sync).
- Formal government API integration with National Crop Insurance Portal (NCIP) once official partner credentials are granted.
- Additional schemes (e.g., RWBCIS — Restructured Weather Based Crop Insurance Scheme, and distinct state disaster relief modules such as Haryana's e-Kshatipurti).

---

## 4. Technical & Operational Risk Register

| Risk ID | Risk Description | Likelihood | Impact | Mitigation Strategy Implemented |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | Farmers mistake the generated PDF draft for an official PMFBY claim submission. | High | Critical | Persistent red/amber `DRAFT – NOT OFFICIALLY SUBMITTED` banner on Screens 08–11 and every PDF page; separate `workflow_status` vs `submission_status` enums; explicit spoken disclaimer during readback. |
| **R-02** | STT misrecognizes numbers (acreage, dates, survey numbers) in noisy rural environments. | Medium | High | Use Gnani Prisma v3.0 with `format=transcribe` and agricultural `keyterms`; deterministic range validation; mandatory spoken readback and explicit farmer confirmation before finalisation. |
| **R-03** | Universal 72-hour deadline shown for ineligible events or unverified districts/crops. | Medium | High | Policy Engine checks `PolicyVersion` table by state, district, season, crop, and loss category. If no active verified notification matches, returns `UNCERTAIN_APPLICABILITY` and advises immediate official contact without guaranteeing a deadline. |
| **R-04** | Network drop during storm causes loss of recorded voice or partial answers. | High | High | Offline-first SQLite store saves every field turn-by-turn on device (`DRAFT_LOCAL`) and queues idempotent sync operations (`SYNC_PENDING`) when connectivity returns. |
| **R-05** | Gnani API credentials unavailable or quota exhausted during hackathon/field demo. | Medium | Medium | Clean `SpeechProvider` and `TextToSpeechProvider` interfaces with automatic health reporting and clearly labelled `MOCK_DEVELOPMENT` fallback adapter that never masquerades as live API traffic. |
| **R-06** | Confusion between PMFBY insurance claims and state relief portals (e.g., Haryana e-Kshatipurti). | Medium | High | Strict scheme separation in database (`scheme = 'PMFBY'` vs `'STATE_RELIEF_EKSHATIPURTI'`) and policy engine rules. |

---

## 5. Phased Implementation Plan (Phases 0 to 11)

- **Phase 0:** Technical & Policy Validation, Architecture, Database ER Design, OpenAPI Spec, Policy Verification Matrix.
- **Phase 1:** Monorepo Foundation (`apps/api`, `apps/mobile`, `packages/shared-types`, `packages/validation`, `packages/contracts`, Docker Compose, Prisma migrations).
- **Phase 2:** Core Mobile App (Screens 01–04, Onboarding, Consent, SQLite local draft storage).
- **Phase 3:** Voice Engine (`SpeechProvider`, Gnani Prisma v3.0 REST adapter, audio validation, retry/error recovery).
- **Phase 4:** Intelligence Engine (Schema-constrained extraction, confidence/source tracking, deterministic dynamic question engine, agricultural validation rules).
- **Phase 5:** Speaking & Verification (`TextToSpeechProvider`, Gnani Timbre v2.5/v3.0 REST adapter, critical-field spoken readback, correction loop).
- **Phase 6:** Reporting Engine (Bilingual HTML-to-PDF and plain-text generator, timestamps, revision tracking, watermarks).
- **Phase 7:** Policy Engine (Configurable `PolicyVersion` records, 72h/7d conditional deadline calculator, verified channel directory).
- **Phase 8:** Offline & Synchronisation (Offline banner, SQLite queue, `Idempotency-Key` deduplication).
- **Phase 9:** Security, Consent & Administration (OTP Auth adapter, RBAC, Consent versioning, Audit trail, data deletion).
- **Phase 10:** Automated Testing & Verification (Unit, integration, voice critical-field test dataset, offline sync tests).
- **Phase 11:** Hackathon Demonstration Package (Seeded synthetic scenario, rendered sample PDF, 3-minute live script).
