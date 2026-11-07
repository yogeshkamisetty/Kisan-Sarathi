# Gnani AI Developer Documentation & Integration Specification
**Verification Date:** 2026-11-04
**Official Documentation Source:** [Gnani Speech APIs Documentation](https://docs.gnani.ai/api/introduction/introduction) & [Quick Start Guide](https://docs.gnani.ai/api/introduction/quick-start)

---

## 1. Documentation Verification Summary (Reference Doc vs. Current 2026 Official API)

Before writing a single line of integration code, our team audited the reference endpoints mentioned in the initial research brief against Gnani AI's live production documentation (`docs.gnani.ai`, verified October/November 2026):

| Aspect | Initial Research Reference | Verified Official Gnani API (Nov 2026) | Engineering Decision |
| :--- | :--- | :--- | :--- |
| **Unified Base URL** | Mixed (`api.vachana.ai` for STT, `api.gnani.ai` for TTS) | **`https://api.vachana.ai`** for all REST/SSE Speech APIs ([Source](https://docs.gnani.ai/api/introduction/introduction)) | Default both `GNANI_STT_BASE_URL` and `GNANI_TTS_BASE_URL` to `https://api.vachana.ai` while keeping them configurable via `.env`. |
| **Authentication Header** | Unspecified token | **`X-API-Key-ID: <your_api_key>`** ([Source](https://docs.gnani.ai/api/introduction/introduction)) | Sent strictly from the NestJS backend; missing/invalid key returns `401 Unauthorized`. |
| **Prisma STT Endpoint** | `POST https://api.vachana.ai/stt/v3` | **`POST https://api.vachana.ai/stt/v3`** (`multipart/form-data`) ([Source](https://docs.gnani.ai/api/STT/models/prisma-v3)) | Confirmed current. Supports `model=prisma-v3.0` (multilingual + auto-detect + context hints) and `prisma-v2.5` (default). |
| **Prisma STT Supported Formats & Limits** | General audio | **`WAV, MP3, OGG, FLAC, AAC, M4A`**, Mono, 8kHz–44.1kHz, max **30 seconds** per synchronous REST call ([Source](https://docs.gnani.ai/api/STT/models/prisma-v3)) | Mobile app enforces max 28-second utterance chunks in 16kHz mono WAV/M4A; longer recordings use `/stt/v3/batch/jobs` or segmented utterances with `previous_text`. |
| **Prisma STT Context & Number Formatting** | Not specified | **`format=transcribe`** (digits `2`, `12345`), **`keyterms`** (up to 200 domain phrases), **`topic`** (up to 1600 chars), **`previous_text`** (last 600 chars) ([Source](https://docs.gnani.ai/api/STT/models/prisma-v3)) | Pass `format=transcribe` and agricultural `keyterms` (crop names, calamity terms, acreage units) to boost critical-field recognition accuracy. |
| **Timbre TTS Endpoint** | `POST https://api.gnani.ai/v1/tts/inference` | **`POST https://api.vachana.ai/api/v1/tts/inference`** ([Source](https://docs.gnani.ai/api/TTS/tts-inference)) | Use verified path `/api/v1/tts/inference` on `https://api.vachana.ai` with `model: "timbre-v2.5"` (42 voices) or `"timbre-v3.0"` (13 multilingual voices). Note: `timbre-v2.0` is deprecated. |
| **Supported Languages (10 Indian + English)** | Listed 6 candidates | **`hi-IN`, `te-IN`, `ml-IN`, `ta-IN`, `kn-IN`, `en-IN`, `bn-IN`, `gu-IN`, `mr-IN`, `pa-IN`**, plus **`indic-auto`** on Prisma v3.0 ([Source](https://docs.gnani.ai/api/STT/models/prisma-v3)) | Expose the 6 verified & workflow-tested MVP languages (`hi-IN`, `te-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `en-IN`), with admin toggle for `mr-IN`, `pa-IN`, `gu-IN`, `bn-IN`. |

---

## 2. Verified Request & Response Contracts

### 2.1 Gnani Prisma v3.0 Speech-to-Text (`POST https://api.vachana.ai/stt/v3`)
**Request (`multipart/form-data`):**
```http
POST /stt/v3 HTTP/1.1
Host: api.vachana.ai
X-API-Key-ID: <GNANI_API_KEY>
Content-Type: multipart/form-data; boundary=---FasalAwaazBoundary

--FasalAwaazBoundary
Content-Disposition: form-data; name="audio_file"; filename="utterance.wav"
Content-Type: audio/wav

<binary 16kHz mono PCM WAV>
--FasalAwaazBoundary
Content-Disposition: form-data; name="model"

prisma-v3.0
--FasalAwaazBoundary
Content-Disposition: form-data; name="language_code"

hi-IN,en-IN
--FasalAwaazBoundary
Content-Disposition: form-data; name="format"

transcribe
--FasalAwaazBoundary
Content-Disposition: form-data; name="topic"

Farmer reporting agricultural crop damage, hailstorm, heavy rain, affected land area in acres, village name, and incident date for PMFBY intimation.
--FasalAwaazBoundary
Content-Disposition: form-data; name="keyterms"

["धान","गेहूँ","कपास","ओलावृष्टि","भारी बारिश","जलभराव","एकड़","हेक्टेयर","खसरा","सर्वे नंबर","PMFBY","paddy","wheat","cotton","hailstorm","inundation","acres"]
--FasalAwaazBoundary--
```

**Verified Response (`200 OK`):**
```json
{
  "success": true,
  "request_id": "5c1f0a52-6d62-4e0b-9a38-2f2b8a8f7a10",
  "transcript": "मेरी धान की फसल कल शाम ओलावृष्टि और भारी बारिश से 2 एकड़ खराब हो गई",
  "model": "prisma-v3.0",
  "detected_language_code": "hi-IN",
  "processing_time": 0.58,
  "end_to_end_latency": 0.66
}
```

### 2.2 Gnani Timbre v2.5 / v3.0 Text-to-Speech (`POST https://api.vachana.ai/api/v1/tts/inference`)
Per [Gnani TTS REST Documentation](https://docs.gnani.ai/api/TTS/tts-inference), numbers and dates should be formatted clearly in spoken form before synthesis to avoid mispronunciation.

**Request (`application/json`):**
```json
{
  "text": "आपकी फसल धान है। आपने तीन नवंबर दो हज़ार छब्बीस को ओलावृष्टि से दो एकड़ खड़ी फसल के नुकसान की जानकारी दी है। क्या यह जानकारी बिल्कुल सही है?",
  "voice": "Nalini",
  "model": "timbre-v2.5",
  "language": "hi-IN",
  "speed": 0.95,
  "audio_config": {
    "sample_rate": 24000,
    "num_channels": 1,
    "sample_width": 2,
    "encoding": "linear_pcm",
    "container": "wav"
  }
}
```
**Verified Response (`200 OK`):**
- `Content-Type: audio/wav`
- Body: Raw binary WAV audio stream. The backend returns a signed audio buffer/base64 payload along with the exact readable text transcript so the mobile app can play the audio, replay it offline from local cache, and always show a high-contrast text fallback.

---

## 3. Provider Abstraction Architecture

All screens and conversation services depend strictly on abstract interfaces in `apps/api/src/voice/interfaces/`:
- `SpeechProvider`: `transcribeAudio(input: TranscribeAudioInput): Promise<TranscriptionResult>`, `getSupportedLanguages()`, `getProviderHealth()`
- `TextToSpeechProvider`: `synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesisResult>`, `getSupportedVoices()`, `getProviderHealth()`
- `InformationExtractionProvider`: `extractFields(input: ExtractionInput): Promise<ExtractionResult>`, `validateExtraction(raw: ExtractionResult): ValidatedExtractionResult`

### Transparent Development Mock Policy
When `GNANI_API_KEY` is not set in `.env`:
1. `getProviderHealth()` explicitly returns `mode: "MOCK_DEVELOPMENT"`, `liveConfigured: false`, and `reason: "GNANI_API_KEY not configured"`.
2. Every transcription and synthesis response includes `providerMode: "MOCK_DEVELOPMENT"` so the mobile UI and audit logs clearly badge simulated responses and never claim live Gnani API execution when running without credentials.

---

## Spoken Number Normalisation (Implemented)

Gnani's TTS guidance is to pass numbers, dates and currency as spoken words. The readback
sentence contains the figures the farmer must verify — the damaged area and the hours left
before the deadline — so `apps/api/src/gnani/hindi-number-words.js` spells them out:

- Hindi 0–99 from an explicit table (Hindi numerals are irregular and cannot be composed
  from a tens word plus a units word), then `सौ` / `हज़ार` / `लाख` composition above that.
- Decimals are read digit-by-digit after `दशमलव`, so `2.5` becomes `दो दशमलव पाँच`.
- Standalone numbers only. Identifiers such as a survey number (`123/4A`) or an ISO date
  are left as digits, since spelling those out makes them harder to verify.
- Unicode-aware boundaries, because ASCII `\b` does not separate digits from Devanagari —
  the previous implementation handled only 0–10 and 72 and missed any number sitting
  against Hindi text.
- Other languages pass through unchanged. Timbre reads digits in-language acceptably,
  whereas an unverified transliteration would be read out wrongly with full confidence.

## Readback Localisation

Extraction stores language-neutral canonical keys (`paddy`, `hailstorm`, `STANDING`) so
validation and policy matching stay deterministic. The readback translates them back into
the farmer's language via `apps/api/src/conversation/localized-labels.js`, covering crops,
loss events, crop stages, area units and month names across all six supported languages,
and renders the date as spoken words rather than `2026-11-03`. Values the engine is unsure
about get their own spoken follow-up question, and are returned in
`requiresClarification`.
