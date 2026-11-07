# Backend REST API Reference (`/api/v1`)
**Base Path:** `/api/v1`
**Specification Format:** OpenAPI 3.1 (`documentation/openapi.yaml`)
**Authentication:** Bearer JWT (`Authorization: Bearer <access_token>`)
**Idempotency:** Mutating endpoints (`POST`, `PATCH`) accept `Idempotency-Key: <uuid-v4>` to guarantee safe offline sync retries without duplicate records.

---

## 0. Enforced Access Control (Runnable Server)

`apps/api/src/main.js` enforces the following on every request. Endpoints listed in the
catalog below but not yet implemented in the runnable server are marked as planned.

### 0.1 Authentication
Every endpoint except `GET /api/v1/health`, `GET /api/v1/languages`,
`GET /api/v1/voice/providers/health`, `POST /api/v1/auth/otp/request` and
`POST /api/v1/auth/otp/verify` requires `Authorization: Bearer <access_token>`.
A missing or malformed header returns `401 AUTHENTICATION_REQUIRED`.

- Only an **access** token is accepted; presenting a refresh token returns `401`.
- Signatures are compared in constant time.
- A request body may only ever ask for `FARMER` or `FAMILY_HELPER`. `CSC_OPERATOR` and
  `ADMIN` are provisioned server-side through the `PRIVILEGED_USERS` environment
  variable, so a caller cannot escalate themselves by posting `{"role":"ADMIN"}`.

### 0.2 Report ownership
Every `/api/v1/reports/:reportId/*` route loads the report and checks the caller against
it. A farmer may only reach their own reports; `CSC_OPERATOR` and `ADMIN` may assist.
Anyone else receives `403 FORBIDDEN_REPORT_ACCESS`.

### 0.3 Consent gates (DPDP)
Consent is verified at the request boundary, not merely in the UI:

| Endpoint | Required consent |
| --- | --- |
| `POST /api/v1/farmers` | `PERSONAL_DATA_STORAGE` |
| `POST /api/v1/reports` | `PERSONAL_DATA_STORAGE` |
| `POST /api/v1/reports/:id/conversation/turns` | `PERSONAL_DATA_STORAGE` |
| `POST /api/v1/voice/transcribe` | `AUDIO_RECORDING` **and** `GNANI_CLOUD_VOICE_PROCESSING` |

A missing consent returns `CONSENT_REQUIRED`. `POST /api/v1/consent` records consent for
the authenticated caller only — a `userId` in the body is ignored.

### 0.4 Voice provenance
`POST /api/v1/voice/transcribe` takes `{ audioBase64, languageCode, audioFormat,
durationSeconds }`; the backend holds `GNANI_API_KEY` and returns the real
`providerMode` (`LIVE_GNANI` or `MOCK_DEVELOPMENT`).

On `POST /api/v1/reports/:id/conversation/turns` the server — not the client — sets
`provider` and `providerMode`. A typed turn is stored as `MANUAL_TEXT_ENTRY`, so a client
can never mislabel keyboard input as a live Gnani transcription.

### 0.5 Error responses
`4xx` responses carry their actionable message. `5xx` responses return a generic
farmer-safe message; internal details (including raw upstream Gnani response bodies)
go only to the server log.

### 0.6 Demo endpoint
`POST /api/v1/demo/run` returns `404 DEMO_ENDPOINT_DISABLED` unless
`ENABLE_DEMO_ENDPOINT=true`, and is unconditionally disabled when `NODE_ENV=production`.

### 0.7 Correctness guarantees in responses

- `POST /reports/:id/conversation/turns` returns `skippedOptionalFields` (only ever the
  optional field actually being asked, or one the farmer named themselves) and
  `areaValidation`. An area that contradicts the cultivated area is kept but marked
  `uncertain`.
- `POST /reports/:id/readback` returns `languageCode`, each field's `spokenAs` value in the
  farmer's language, and `requiresClarification` — the fields the farmer must resolve
  before finalisation is allowed.
- `POST /reports/:id/correct` re-validates the corrected value: an impossible area is
  rejected with `400 INVALID_CORRECTION`, while a contradiction is stored and flagged via
  `requiresClarification`.
- `POST /reports/:id/confirm` returns `400 UNCONFIRMED_CRITICAL_FIELDS` or
  `400 UNCERTAIN_CRITICAL_FIELDS` **before** mutating anything, so a rejected confirmation
  never leaves the report partially confirmed.
- Policy evaluation attached on confirmation reports `season`, `seasonSource`,
  `seasonConfident` and the applied `effectiveFrom`/`effectiveUntil` window. See
  `documentation/policy-verification.md` section 4.

---

## 1. Endpoint Catalog

### 1.1 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/otp/request` — Request 6-digit OTP to farmer/operator mobile number. Uses `OtpProvider` interface (`MockDevelopmentOtpAdapter` clearly labelled in non-production environments).
- `POST /api/v1/auth/otp/verify` — Verify OTP and issue short-lived `accessToken` (15m) + `refreshToken` (7d).
- `POST /api/v1/auth/refresh` — Rotate refresh token and issue new access token.
- `POST /api/v1/auth/logout` — Revoke current refresh session.

### 1.2 Supported Languages (`/api/v1/languages`)
- `GET /api/v1/languages` — List voice-workflow-verified languages (`hi-IN`, `te-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `en-IN`) with native labels, Gnani Prisma STT support flags, and Gnani Timbre TTS voice mappings (`Nalini`, `Kaveri`, `Deepak`, `Pranav`, `Shivani`).
- `GET /api/v1/languages/:languageCode` — Retrieve localized UI strings, spoken prompt templates, and TTS voice configuration for a specific language code.

### 1.3 Farmer Profiles & Consent (`/api/v1/farmers`, `/api/v1/consent`)
- `POST /api/v1/consent` — Record granular versioned consent (`AUDIO_RECORDING`, `GNANI_CLOUD_VOICE_PROCESSING`, `PERSONAL_DATA_STORAGE`, `GPS_LOCATION_CAPTURE`, `PHOTO_EVIDENCE_UPLOAD`).
- `GET /api/v1/farmers/me` — Fetch authenticated farmer profile(s).
- `POST /api/v1/farmers` — Create farmer profile (supports `SELF`, `FAMILY_HELPER`, and `CSC_OPERATOR` assisted modes).
- `PATCH /api/v1/farmers/me` — Update profile details with audit logging.

### 1.4 Crop-Loss Intimation Reports (`/api/v1/reports`)
- `POST /api/v1/reports` — Initialise a new draft report (accepts `Idempotency-Key` and `createdAtDevice` timestamp for offline-created drafts).
- `GET /api/v1/reports` — List farmer's saved drafts, pending completions, and exported reports.
- `GET /api/v1/reports/:reportId` — Retrieve full report state, extracted values, missing-field checklist, policy deadline evaluation, and revision history.
- `PATCH /api/v1/reports/:reportId` — Update report fields (creates an `AuditEvent` whenever a previously confirmed field is modified).
- `DELETE /api/v1/reports/:reportId` — Permanently delete a report draft and associated attachments.
- `POST /api/v1/reports/:reportId/finalise` — Verify that all critical fields (`crop_name`, `incident_type`, `incident_date`, `crop_stage`, `affected_area`, `village`) have been read back and confirmed by the farmer, then transition `workflowStatus` to `READY_FOR_EXPORT`.

### 1.5 Voice & Gnani AI Proxy (`/api/v1/voice`)
- `POST /api/v1/voice/transcribe` — Upload audio (`WAV`, `MP3`, `OGG`, `FLAC`, `AAC`, `M4A`, max 30s) -> Gnani Prisma (`POST https://api.vachana.ai/stt/v3`). Returns transcript, detected language, request ID, and provider mode (`LIVE_GNANI` vs `MOCK_DEVELOPMENT`).
- `POST /api/v1/voice/synthesize` — Synthesize question or verification readback -> Gnani Timbre (`POST https://api.vachana.ai/api/v1/tts/inference`). Returns audio buffer + readable fallback text.
- `GET /api/v1/voice/providers/health` — Returns live status of Gnani Prisma STT, Gnani Timbre TTS, and Extraction Engine.

### 1.6 Conversation, Extraction & Dynamic Question Engine
- `POST /api/v1/reports/:reportId/conversation/turns` — Submit a spoken or typed farmer turn, run schema-constrained extraction, validate values, and return the next dynamic follow-up question in the farmer's language.
- `GET /api/v1/reports/:reportId/conversation` — Retrieve full chronological turn history.
- `POST /api/v1/reports/:reportId/conversation/correct` — Record a farmer correction to an extracted field via voice or manual edit and log an `AuditEvent`.
- `POST /api/v1/reports/:reportId/extract` — Execute standalone schema-constrained extraction on a transcript.
- `POST /api/v1/reports/:reportId/validate` — Execute deterministic agricultural & policy validation on report fields.
- `GET /api/v1/reports/:reportId/missing-fields` — Return categorized missing fields (`criticalMissing`, `optionalSevenDayCompletable`, `uncertainFields`).
- `POST /api/v1/reports/:reportId/confirm` — Record farmer confirmation after voice readback (`readbackCompleted: true`).

### 1.7 Documents, Evidence, Policy & Official Submission References
- `POST /api/v1/reports/:reportId/documents` — Generate timestamped bilingual PDF & plain-text Crop Loss Intimation Draft (`DRAFT – NOT OFFICIALLY SUBMITTED`).
- `GET /api/v1/reports/:reportId/documents` & `GET /api/v1/documents/:documentId` — Download generated PDF or text summary.
- `POST /api/v1/reports/:reportId/evidence/upload-url` & `POST /api/v1/reports/:reportId/evidence/confirm-upload` — S3/MinIO presigned upload and confirmation for field photos.
- `POST /api/v1/reports/:reportId/submission-records` — Record official channel submission details (`14447` ticket number, bank acknowledgement, etc.) as `ACKNOWLEDGEMENT_ENTERED` (farmer-reported, not government-verified).
- `GET /api/v1/policies/applicable` & `GET /api/v1/reports/:reportId/deadline-guidance` — Evaluate applicable PMFBY policy version, 72-hour initial deadline, 7-day completion deadline, and verified official channels.

### 1.8 Innovative Express Channels, Weather Grounding & Commercial Analytics
- `POST /api/v1/intake/quick-voice` — Zero-App single-shot rapid intake via voice base64 or raw text. Returns verified draft, weather plausibility index (IPI), instant PDF link, and localized WhatsApp/SMS action card with single-tap `14447` dialer.
- `POST /api/v1/channels/whatsapp/webhook` — Inbound webhook for WhatsApp Business API (Twilio / Meta Cloud API) supporting audio voice notes and text distress messages.
- `GET /api/v1/reports/:reportId/pdf` — Dynamic streaming binary download of official A4 bilingual PDF draft (`application/pdf`).
- `GET /api/v1/reports/:reportId/plausibility` — Real-time meteorological plausibility scoring (IPI: 0–100%) against historical Doppler radar and weather telemetry with automated triage routing (`GREEN_CHANNEL_FAST_TRACK`, `URGENT_24H_DISPATCH`, or `ANOMALY_MANUAL_AUDIT_REQUIRED`).
- `GET /api/v1/business/analytics` — Executive and insurer B2B commercial analytics reporting unit economics (₹35/intake vs ₹1,500 manual survey triage), turnaround time compression (48h -> 6h), fraud reduction savings, and Total Addressable Market (TAM) statistics.

