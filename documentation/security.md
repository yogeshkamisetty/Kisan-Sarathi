# Application Security, Privacy & DPDP Alignment
**System:** KisanSaathi — *Fasal Awaaz*

---

## 1. Core Security Principles
1. **Zero Client-Side Secrets:** `GNANI_API_KEY`, `GEMINI_API_KEY`, `JWT_ACCESS_SECRET`, and `OBJECT_STORAGE_SECRET_KEY` exist exclusively in backend environment variables. The React Native bundle contains only the backend API base URL.
2. **Strict Data Minimisation:**
   - **Prohibited Fields:** Complete bank account numbers, IFSC codes, Aadhaar numbers, debit/credit card numbers, or land title deeds are **never** requested or stored in the MVP workflow.
   - **Location Privacy:** GPS coordinates are captured only when the farmer explicitly grants location consent, and can be skipped in favour of spoken village/district names.
   - **Ephemeral Voice Processing:** Raw audio uploads are streamed to Gnani Prisma STT and discarded immediately after transcription unless queued locally offline for pending sync (and wiped upon sync completion or user deletion).
3. **Granular Versioned Consent (DPDP Act 2023 Alignment):**
   - Before any recording begins on Screen 02, the farmer is presented with a plain-language notice (and spoken read-out) explaining:
     - *What is collected:* Voice statement about crop damage, farmer name, village, crop details, and optional field photos/GPS.
     - *Who processes voice:* Gnani AI (`api.vachana.ai`) for speech-to-text and text-to-speech.
     - *Why:* To prepare a structured Crop Loss Intimation Draft for the farmer to use with official PMFBY channels.
     - *Right to Withdraw & Delete:* Farmers can withdraw consent or delete local/server drafts at any time with one tap.
4. **Immutable Audit Trail (`audit_events`):**
   - Any modification to a farmer-confirmed value, status transition, official reference entry, or administrator policy update writes an append-only record containing `actor_id`, `actor_role`, `previous_value`, `new_value`, `timestamp`, and `source`.
   - Administrators are blocked by RBAC guards from editing farmer report fields without an explicit administrative audit reason.
5. **Privacy-Aware Structured Logging:**
   - The backend logger automatically redacts `authorization`, `x-api-key-id`, `otp`, and masks mobile numbers (`XXXXXX3210`) before writing JSON logs.

---

## 1A. Enforcement Status (Implemented in `apps/api/src`)

The principles above are enforced at the HTTP boundary, not only in the mobile UI:

- **Authentication guard** (`requireAuth` in `main.js`): all farmer-data endpoints require
  a Bearer access token. Refresh tokens are rejected where an access token is required,
  and signatures are compared with `crypto.timingSafeEqual`.
- **No hardcoded JWT fallback secrets.** Production startup fails without
  `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`; development generates a random
  per-process secret instead of using a shared constant.
- **No self-service privilege escalation.** `CSC_OPERATOR` and `ADMIN` come from the
  server-side `PRIVILEGED_USERS` variable; a request body cannot grant them.
- **Report ownership checks** (`ReportsService.assertActorMayAccess`): a farmer cannot
  read, correct, confirm, export or attach a submission reference to another farmer's
  report. Attempts return `403 FORBIDDEN_REPORT_ACCESS` and are rejected before any
  personal data is serialised.
- **Consent enforced server-side** via `ConsentService.requireConsent` on profile
  creation, report creation, conversation turns and voice transcription. Audio reaches
  Gnani only after both `AUDIO_RECORDING` and `GNANI_CLOUD_VOICE_PROCESSING` are granted.
- **Trustworthy provenance:** the server stamps `provider` / `providerMode` on each
  conversation turn from the real adapter state, so a draft can never claim a live Gnani
  transcription for typed text.
- **No internal error disclosure:** `5xx` responses return a generic message; upstream
  error bodies stay in the server log.
- **Demo seed route gated** behind `ENABLE_DEMO_ENDPOINT` and blocked in production.
- **Durable state:** domain state is written through to `DATA_DIR` (atomic temp-file +
  rename). A restart during a farmer's 72-hour window no longer destroys their draft, and
  the idempotency index and report-number sequence survive with it. `PERSISTENCE=memory`
  is rejected in production by the startup validator.

### Known remaining gaps
- The Prisma/PostgreSQL schema is still not the live datastore; the JSON store is an
  interim measure for a single API process.
- Local SQLite draft storage on the device is not yet encrypted at rest (SQLCipher or
  `expo-secure-store`-held key still to be wired in).
- No rate limiting, CORS policy or request-size tuning beyond the 5 MB body cap.

