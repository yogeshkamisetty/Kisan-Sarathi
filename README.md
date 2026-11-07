# Kisan Sarathi (किसान सारथी / కిసాన్ సారథి)
**Speak. Verify. Prepare. Report.**
*Multilingual AI Voice Assistant for Timely Crop Loss Intimation Preparation & 24-Hour Surveyor Triage*

---

## 1. Overview & Strict Product Boundary
**Kisan Sarathi (किसान सारथी)** (under the **KisanSaathi** initiative) is a voice-first, offline-capable Android mobile application and modular monolith backend that helps Indian farmers explain agricultural crop damage in their native language, verifies critical details aloud via **Gnani AI**, and generates a timestamped bilingual **Crop Loss Intimation Draft** for the **Pradhan Mantri Fasal Bima Yojana (PMFBY)** with instant Doppler radar meteorological grounding.

> **CRITICAL PRODUCT BOUNDARY:**
> Kisan Sarathi is an **AI-assisted crop-loss intimation preparation system**. It is **NOT** an official government claim-submission portal, insurance company, or claim adjudication system. Every generated report visibly displays **`DRAFT – NOT OFFICIALLY SUBMITTED`** and guides the farmer to lodge official intimation via verified government channels (such as **Krishi Rakshak Helpline 14447** or the **Crop Insurance App**).

---

## 2. Repository Structure

```text
fasal-awaaz/
├── apps/
│   ├── api/                        # Node.js + TypeScript / NestJS Modular Monolith Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 14-Entity PostgreSQL Relational Schema
│   │   │   ├── seed.js             # Synthetic Hackathon Demonstration Seed Script
│   │   │   └── migrations/         # SQL DDL Migrations (20261104000000_init)
│   │   ├── src/
│   │   │   ├── auth/               # OTP Provider Interface, JWT & RBAC Guards
│   │   │   ├── audit/              # Append-only Audit Trail & Admin Safeguards
│   │   │   ├── common/             # Startup Config Validator, Durable JSON Store & Privacy-Masking Logger
│   │   │   ├── consent/            # Granular Versioned Consent Management (DPDP)
│   │   │   ├── conversation/       # Deterministic Dynamic Question Engine
│   │   │   ├── documents/          # Bilingual PDF/HTML & Text Report Generator
│   │   │   ├── evidence/           # S3 / MinIO Presigned Evidence Upload Service
│   │   │   ├── extraction/         # Schema-Constrained Extraction & Source Span Tracker
│   │   │   ├── farmers/            # Onboarding + Family/CSC Assisted Mode Attribution
│   │   │   ├── gnani/              # Verified Gnani Prisma v3.0 STT & Timbre v2.5 TTS Adapters
│   │   │   ├── notifications/      # Conditional 72h & 7-Day Completion Reminders
│   │   │   ├── policy/             # Configurable Policy & Deadline Engine (PMFBY vs State)
│   │   │   ├── reports/            # Dual-Track Workflow & Submission State Machine
│   │   │   └── main.js             # Runnable HTTP REST API Entrypoint (/api/v1/*)
│   │   └── test/
│   │       ├── unit.spec.js        # Automated Unit & Voice Dataset Test Suite
│   │       └── integration.spec.js # E2E Farmer Journey, Gnani Adapter & Offline Sync Tests
│   │
│   └── mobile/                     # React Native (Expo + TypeScript) Android Application
│       ├── src/
│       │   ├── screens/            # All 11 Farmer Workflow Screens + Dashboard
│       │   ├── database/           # Encrypted Local SQLite Offline Draft Persistence
│       │   ├── offline/            # Network Recovery & Idempotent Sync Queue
│       │   ├── theme/              # High-Contrast Rural Accessibility Design System
│       │   └── i18n/               # Multilingual Prompts (hi, te, ta, kn, ml, en)
│       ├── App.tsx
│       └── app.json
│
├── packages/
│   ├── shared-types/               # Canonical Enums, Statuses & Verified Language Definitions
│   ├── validation/                 # Deterministic Area, Date, Post-Harvest & Schema Validators
│   └── contracts/                  # Verified Official PMFBY Channel Directory & DTOs
│
├── infrastructure/
│   ├── docker/Dockerfile.api       # Production-ready Non-Root Container Build
│   └── scripts/                    # PostgreSQL Backup, Restore & Env Verification Scripts
│
├── documentation/                  # Complete Phase 0–11 Engineering & Policy Documentation
│   ├── prd-and-roadmap.md
│   ├── architecture.md
│   ├── database-design.md
│   ├── api-documentation.md
│   ├── openapi.yaml
│   ├── gnani-integration.md
│   ├── policy-verification.md
│   ├── security.md
│   ├── testing.md
│   ├── deployment-guide.md
│   └── user-guide.md
│
├── demo/                           # Seeded Hackathon Demonstration Artifacts
│   ├── run-hackathon-demo.js
│   ├── synthetic-demo-session.json
│   ├── sample-crop-loss-intimation-draft.txt
│   └── sample-crop-loss-intimation-draft.pdf
│
├── docker-compose.yml              # PostgreSQL 16 + Redis 7 + MinIO + API Stack
├── .env.example                    # Safe Environment Variable Template
└── package.json
```

---

## 3. Quick Start & Verification Commands

```bash
# 1. Verify environment configuration
npm run verify:env

# 2. Run the complete Automated Unit & Integration Test Suite (54 tests across 14 suites)
npm test

# 3. Execute the 19-Step Synthetic Hackathon Demonstration Scenario
npm run demo:run

# 4. Start the REST API Server locally (defaults to port 3000)
npm run start:api

# 5. Start full infrastructure stack with Docker Compose (PostgreSQL, Redis, MinIO, API)
docker compose up -d --build
```


### 3.1 Required Configuration

Copy `.env.example` to `.env` and set at least:

| Variable | Why it matters |
| :--- | :--- |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Required in production; startup fails without them. In development a random per-process secret is generated, so tokens stop working after a restart. |
| `PERSISTENCE`, `DATA_DIR` | `file` (default) writes domain state to disk so an API restart never destroys an in-flight farmer draft. `memory` is for tests only and is rejected in production. |
| `PRIVILEGED_USERS` | The only way to grant `CSC_OPERATOR` / `ADMIN`. Format: `mobile:ROLE` pairs, comma-separated. A request body can never grant these roles. |
| `GNANI_API_KEY` | When absent, the STT/TTS adapters report `MOCK_DEVELOPMENT` and never claim a live call. |
| `ENABLE_DEMO_ENDPOINT` | `POST /api/v1/demo/run` is `404` unless this is `true`, and always disabled in production. |
| `EXPO_PUBLIC_API_BASE_URL` | The backend origin the Android app calls. Safe to ship; never put a secret here. |

### 3.2 Mobile → Backend

`apps/mobile/src/api/client.js` is the single place the app talks to `/api/v1`. It attaches
the Bearer token, sends `Idempotency-Key` on report creation, posts recordings to
`POST /api/v1/voice/transcribe` (the backend holds the Gnani key), and surfaces
farmer-readable errors. Tokens are held via `expo-secure-store`, never plain storage.

> **Still to do:** the 11 workflow screens currently render UI only — they need to be
> wired to this client, and the on-device SQLite draft store is not yet encrypted at rest.

---

## 4. Verification Status Matrix (Section 29)

| Area | Result | Verification Details |
| :--- | :--- | :--- |
| **Frontend Architecture & Screens** | **Pass** | All 11 workflow screens + Farmer Dashboard + Offline SQLite Store & Sync Engine implemented in `apps/mobile/`. |
| **Backend Modular Monolith** | **Pass** | All domain services, state machines, validators, and `/api/v1/*` endpoints runnable and tested in `apps/api/`. |
| **Database Schema & Migrations** | **Pass** | All 14 entities defined in `apps/api/prisma/schema.prisma` and `migrations/20261104000000_init/migration.sql`. |
| **Gnani Prisma STT Integration** | **Tested (Adapter + Mock Fallback)** | Verified against `POST https://api.vachana.ai/stt/v3` (`X-API-Key-ID`, `model=prisma-v3.0`, `format=transcribe`, `keyterms`). Uses live API when `GNANI_API_KEY` is provided; clearly badges `MOCK_DEVELOPMENT` when unconfigured. |
| **Gnani Timbre TTS Integration** | **Tested (Adapter + Mock Fallback)** | Verified against `POST https://api.vachana.ai/api/v1/tts/inference` (`timbre-v2.5` / `timbre-v3.0`) with spoken number normalization and text fallback. |
| **Information Extraction & Validation** | **Pass** | 100% critical-field extraction accuracy on multilingual test cases; ungrounded extractions without `source_text` are deterministically rejected. |
| **Bilingual Report Generation** | **Pass** | Generates PDF (`demo/sample-crop-loss-intimation-draft.pdf`) and text summary with `DRAFT – NOT OFFICIALLY SUBMITTED` banner. |
| **Offline Draft & Idempotent Sync** | **Pass** | Verified local draft persistence, unmistakable offline notice, and duplicate prevention via `Idempotency-Key`. |
| **API Authentication & Authorization** | **Pass** | Every farmer-data endpoint requires a Bearer access token; refresh tokens are rejected in its place, signatures are compared in constant time, and `CSC_OPERATOR` / `ADMIN` can only be provisioned server-side via `PRIVILEGED_USERS`. |
| **Report Ownership Isolation** | **Pass** | A farmer cannot read, correct, confirm, export or attach a submission reference to another farmer's report (`403 FORBIDDEN_REPORT_ACCESS`). |
| **Server-Side Consent Gates** | **Pass** | `ConsentService.requireConsent` is enforced at the HTTP boundary on profile creation, report creation, conversation turns, and voice transcription (audio requires both `AUDIO_RECORDING` and `GNANI_CLOUD_VOICE_PROCESSING`). |
| **Durable State Across Restarts** | **Pass** | Reports, consents, profiles, users and the append-only audit trail are written through to `DATA_DIR` atomically; the idempotency index and report-number sequence survive a restart. `PERSISTENCE=memory` is rejected in production. |
| **Security & DPDP Controls** | **Pass** | Zero secrets in mobile bundle, no hardcoded JWT fallback secrets, bank account collection blocked, granular versioned consent enforced, append-only audit trail verified, internal error details withheld from `5xx` responses, demo seed route gated behind `ENABLE_DEMO_ENDPOINT`. |
| **Relative Date & Timezone Correctness** | **Pass** | Relative days ("yesterday", "परसों") resolve on the IST calendar, not UTC. The ambiguous Hindi "कल" (yesterday *or* tomorrow) is flagged uncertain and must be confirmed by the farmer; paired with a future marker it yields no date at all. |
| **Season & Policy Window Correctness** | **Pass** | The crop season is derived from the incident date with a boundary fallback instead of assuming Kharif, and a policy's `effectiveFrom`/`effectiveUntil` window is enforced against the incident date so a lapsed rule is never applied. Rabi 2026-27 rules seeded. |
| **Spoken Readback Correctness** | **Pass** | Canonical values are spoken in the farmer's own language across all six languages; Hindi numbers (including decimals and values above 100) are spelled out, while identifiers stay as digits. |
| **Validated Corrections & Atomic Confirmation** | **Pass** | A correction is re-validated: impossible values are rejected and contradictions are flagged UNCERTAIN, blocking finalisation. A failed readback confirmation leaves no partially confirmed state. |
| **Automated Test Suite** | **54 / 54 Passing** | Executed via `npm test` (`unit.spec.js` + `integration.spec.js` — 14 suites, 54 tests, 0 failures). |
