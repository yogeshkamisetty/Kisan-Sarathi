# User Guide, Hackathon Pitch & 3-Minute Demonstration Script
**Product:** KisanSaathi — *Fasal Awaaz* (`Speak. Verify. Prepare. Report.`)

---

## 1. User Guide by Role

### 1.1 For Farmers (Screens 01 – 11)
1. **Choose Your Language (Screen 01):** Tap your preferred language (Hindi, Telugu, Tamil, Kannada, Malayalam, or English). You can tap the speaker icon to hear each option aloud.
2. **Understand & Give Consent (Screen 02):** Listen to how Fasal Awaaz works. Remember: *Fasal Awaaz helps you prepare your crop-loss report; it does not submit an official insurance claim.* Grant permission for microphone and data saving.
3. **Basic Details (Screen 03):** Speak or confirm your name, state, district, and village. We never ask for your bank account number.
4. **Speak About Your Crop Damage (Screen 04 & 05):** Tap the large green microphone button and explain naturally what happened (for example: *"My standing paddy crop in Rampur was damaged yesterday evening by hailstorm across 2 acres"*).
5. **Answer Only Relevant Questions (Screen 05):** The assistant will only ask for details you haven't mentioned yet (such as whether the crop was standing or harvested for drying). If you don't have your survey number right now, say *"Not available right now"*—you can still generate your initial draft!
6. **Review & Listen to Readback (Screen 06 & 07):** Listen carefully as **Gnani Timbre** reads back your crop name, damage cause, incident date, affected area, and village. If anything is wrong, tap **Speak to Correct** or **Edit**.
7. **Download Your Intimation Draft & Contact Official Channels (Screen 08 & 09):** Download or share your bilingual PDF draft (`DRAFT – NOT OFFICIALLY SUBMITTED`). Then tap **Call Helpline 14447** or open the **Crop Insurance App** / visit your bank or agriculture office within the 72-hour window.
8. **Save Your Official Ticket Number (Screen 10 & 11):** After calling `14447` or visiting your bank, record the official reference/ticket number in Screen 10 and return within 7 days on Screen 11 to add any missing survey or application numbers.

### 1.2 For Family Members & CSC Operators
- Enable **Assisted Reporting Mode** on Screen 03. Enter the affected farmer's details along with your name/CSC ID so the report accurately attributes who spoke and who assisted.

---

## 2. Hackathon Pitch & Innovation Statement

### The Core Insight
After a hailstorm or unseasonal cyclone, an insured farmer has **72 hours** under PMFBY guidelines to lodge an initial localised calamity or post-harvest loss intimation. Yet farmers face complex forms, confusion between standing vs. cut-and-spread post-harvest rules, missing survey numbers, and post-storm network blackouts.

### Why Fasal Awaaz Stands Out
Fasal Awaaz is **not** a generic LLM wrapper or a fake claim-submission portal. It combines:
1. **Gnani Prisma v3.0 STT** with agricultural keyterms boosting and code-mixed speech recognition.
2. **Schema-Constrained Extraction + Deterministic Question Engine** that never fabricates missing fields and allows rapid partial intake when survey numbers aren't immediately on hand.
3. **Mandatory Spoken Verification via Gnani Timbre TTS** so semi-literate farmers can verify every critical number (acres, dates, crop stage) by ear before generating a draft.
4. **Policy-Aware Deadline Guidance** that separates PMFBY Localised Calamity, PMFBY Post-Harvest Cut-and-Spread Drying, and state relief portals like Haryana's e-Kshatipurti.
5. **Offline-First Resilience & Honest Boundaries** with encrypted local SQLite drafts, idempotent sync, and unmistakable separation between a prepared draft (`DRAFT – NOT OFFICIALLY SUBMITTED`) and an official government acknowledgement.

---

## 3. Three-Minute Live Hackathon Demonstration Script

- **0:00 – 0:30 | The Real-World Scenario & Consent (Screens 01–03):**
  - Open Fasal Awaaz (labelled *Synthetic Demo Mode*). Select **Hindi (`hi-IN`)** or **Telugu (`te-IN`)**.
  - Show Screen 02 Consent & Disclaimer: highlight that Fasal Awaaz prepares the intimation draft and does not pretend to be a government submission portal.
  - Show pre-filled synthetic farmer **Ramesh Kumar** (Village: *Peddapalli / Rampur*, District: *Guntur, Andhra Pradesh*).
- **0:30 – 1:30 | Voice Intake, Gnani Prisma STT & Dynamic Questions (Screens 04–05):**
  - Tap the microphone and speak: *"कल शाम ओलावृष्टि और भारी बारिश से मेरी धान की फसल खराब हो गई।"* ("Yesterday evening my paddy crop was damaged by hailstorm and heavy rain.")
  - Show Gnani Prisma transcription and real-time extraction badge: `Crop: Paddy (0.97)`, `Loss Event: Hailstorm (0.96)`, `Incident Date: 2026-11-03 (0.95)`.
  - Notice the Dynamic Question Engine skips asking for crop or date and asks only what is missing: *"आपकी कुल कितनी भूमि में नुकसान हुआ है, और क्या फसल खेत में खड़ी थी या कटी हुई?"* ("How much land was damaged, and was the crop standing or harvested?")
  - Farmer replies: *"तीन एकड़ खड़ी फसल खराब हुई है, सर्वे नंबर अभी याद नहीं है।"* ("Three acres of standing crop was damaged; I don't remember the survey number right now.")
- **1:30 – 2:15 | Spoken Verification via Gnani Timbre & Farmer Correction (Screens 06–07):**
  - On Screen 06 Review, point out `Survey Number: MISSING (Can be completed within 7 days)`.
  - Transition to Screen 07 Voice Readback. Play Gnani Timbre audio reading back *"3 acres of standing paddy damaged by hailstorm on 3 November 2026"*.
  - Demonstrate **Farmer Correction**: Farmer taps *"Correct Information"* and says *"तीन एकड़ नहीं, दो एकड़ नुकसान हुआ है"* ("Not 3 acres, 2 acres were damaged"). Show `affected_area` updating to `2 acres` (`status: CONFIRMED`) with an immutable `AuditEvent` logged.
- **2:15 – 3:00 | Bilingual PDF Draft, 72-Hour Guidance & Official Reference Tracking (Screens 08–11):**
  - Generate the **Crop Loss Intimation Draft PDF**. Show the rendered PDF with the bold **`DRAFT – NOT OFFICIALLY SUBMITTED`** banner, verified fields, missing-information checklist (`Survey Number`, `PMFBY Application Number`), device & server timestamps, and policy reference.
  - Open Screen 09 Official Reporting Guidance showing the 72-hour urgency indicator (`47 hours remaining`) and the explicit **Call Helpline 14447** action button.
  - Open Screen 10 Official Reference Entry, enter synthetic ticket `KRPH-2026-14447-88921`, and show that its status is transparently badged **`ACKNOWLEDGEMENT_ENTERED (Farmer-Reported — Not Independently Government-Verified)`**.
