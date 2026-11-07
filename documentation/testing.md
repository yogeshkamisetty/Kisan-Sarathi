# Testing Strategy, Voice Test Dataset & Verification Report
**System:** KisanSaathi — *Fasal Awaaz*

---

## 1. Multi-Layer Testing Strategy

1. **Unit Tests (`apps/api/test/unit.spec.js`):**
   - Agricultural & Extraction Validation: Negative acreage rejection, `affected_area > cultivated_area` flagging, future incident date rejection, >72-hour late-intimation warning, post-harvest >14-day drying limit check, approximate time handling.
   - Dynamic Question Engine: Verifies priority ordering, non-repetition of confirmed fields, and partial intake support when `survey_number` or `application_number` is unknown.
   - Workflow & Submission State Machines: Verifies valid transitions (`DRAFT_LOCAL` -> `EXPORTED`) and blocks illegal transitions (e.g., setting `OFFICIALLY_VERIFIED` from manual farmer input, or finalising a report before voice readback confirmation).
   - Policy & Deadline Calculator: Verifies 72-hour initial deadline and 7-day completion window calculation for verified policies, `UNCERTAIN_APPLICABILITY` fallback when state/crop policy is unverified, and strict separation between PMFBY and Haryana e-Kshatipurti.
2. **Integration & End-to-End Workflow Tests (`apps/api/test/integration.spec.js`):**
   - Gnani Prisma STT & Timbre TTS Adapter tests (verifying request headers `X-API-Key-ID`, `model=prisma-v3.0`, `format=transcribe`, `keyterms`, error recovery, and `MOCK_DEVELOPMENT` labelling when API keys are omitted).
   - Offline-to-Server Idempotent Synchronisation: Verifies that retrying report creation or turn submission with the same `Idempotency-Key` returns the existing record without creating duplicates.
   - Bilingual Report Generation: Verifies that generated PDF/HTML and plain-text outputs contain all 10 required sections, missing-field checklists, device & server timestamps, and the mandatory `DRAFT – NOT OFFICIALLY SUBMITTED` disclaimer.

---

## 2. Voice & Critical-Field Extraction Test Dataset
Critical-field accuracy (Crop, Loss Event, Incident Date, Crop Stage, Affected Area, Village) is evaluated separately from general Word Error Rate (WER), because a 95% accurate transcript that flips "2 acres" to "20 acres" is unsafe unless caught by readback.

| Case ID | Language / Style | Spoken Utterance | Expected Critical Extractions | Validation & Readback Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **V-01** | Hindi (`hi-IN`) | *"मेरी धान की खड़ी फसल कल शाम ओलावृष्टि और भारी बारिश से 2 एकड़ खराब हो गई, गाँव रामपुर है"* | `crop=paddy`, `loss_event=hailstorm`, `crop_stage=STANDING`, `affected_area=2 ACRE`, `village=Rampur`, `incident_date=yesterday` | All extracted with `status=needs_confirmation`; read back via Timbre TTS. |
| **V-02** | Hinglish Code-Switch (`hi-IN,en-IN`) | *"Mera paddy crop 3 acre damage ho gaya hailstorm se, survey number abhi yaad nahi hai"* | `crop=paddy`, `loss_event=hailstorm`, `affected_area=3 ACRE`, `survey_number=MISSING_TO_COMPLETE_LATER` | Allows partial draft creation; flags survey number in 7-day completion checklist. |
| **V-03** | Telugu (`te-IN`) | *"మా గ్రామంలో నిన్న సాయంత్రం వడగళ్ల వాన వల్ల నా 2 ఎకరాల వరి పంట నష్టపోయింది"* | `crop=paddy`, `loss_event=hailstorm`, `affected_area=2 ACRE`, `incident_date=yesterday` | Extracted accurately and read back in Telugu (`te-IN`). |
| **V-04** | Post-Harvest Cut & Spread (`hi-IN`) | *"फसल काट कर खेत में सुखाने के लिए रखी थी, 5 दिन पहले काटी थी और कल बेमौसम बारिश से भीग गई"* | `crop_stage=HARVESTED_IN_FIELD_DRYING`, `loss_category=POST_HARVEST_LOSS`, `days_since_harvest=5` (<=14 days) | Classified under Post-Harvest Loss workflow; verifies 14-day drying condition. |
| **V-05** | Contradictory Area (`en-IN`) | *"My total land is 2 acres and 5 acres were damaged by inundation"* | `cultivated_area=2`, `affected_area=5` | Deterministic validator flags `AFFECTED_EXCEEDS_CULTIVATED` and prompts farmer to clarify. |
