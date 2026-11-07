# Policy & Government Channel Verification Matrix
**Verification Date:** 2026-11-04
**Primary Scheme Scope:** Pradhan Mantri Fasal Bima Yojana (PMFBY)

---

## 1. Official PMFBY Policy Rules Verification

| Policy Rule / Concept | Status | Official Source & URL | Verified Operational Rule Implemented in Engine |
| :--- | :--- | :--- | :--- |
| **72-Hour Initial Intimation Requirement** | **VERIFIED** | [PMFBY Revamped Operational Guidelines (MoA&FW)](https://pmfby.gov.in/pdf/Revamped%20Operational%20Guidelines_17th%20August%202020.pdf) & [PMFBY Revised Operational Guidelines](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Applies **specifically** to individual farm-level assessment categories: (1) **Localised Calamities** and (2) **Post-Harvest Losses**. Insured farmer must intimate loss within **72 hours** of the event directly via Crop Insurance App, Krishi Rakshak Helpline `14447`, National Crop Insurance Portal, bank branch, or local agriculture official. |
| **Eligible Localised Calamities** | **VERIFIED** | [PMFBY Operational Guidelines — Section on Localised Risks](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Covers notified perils affecting isolated farms: **Hailstorm**, **Landslide**, **Inundation** (except for hydrophilic crops where excluded), **Cloudburst**, and **Natural Fire due to Lightning**. General widespread drought or deficit rainfall is assessed via area-level CCEs/triggers, not individual farm-level localised calamity intimation. |
| **Eligible Post-Harvest Losses (14-Day Drying Rule)** | **VERIFIED** | [PMFBY Operational Guidelines — Post-Harvest Losses](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Covers damage to harvested crops left in the field in **"cut and spread" / small bundled condition for drying** after harvesting, for up to a **maximum of 14 days (2 weeks)** from harvesting, caused by unseasonal/cyclonic rains or hailstorms. Intimation must still occur within **72 hours** of the damaging weather event. Crops already stored in godowns/warehouses are **not** eligible under PMFBY post-harvest loss. |
| **7-Day Follow-Up / Detail Completion Window** | **VERIFIED (Conditional)** | [PMFBY Revamped Operational Guidelines](https://pmfby.gov.in/pdf/Revamped%20Operational%20Guidelines_17th%20August%202020.pdf) | While initial intimation must occur within 72 hours, missing secondary particulars or supporting verification documents required for loss surveyor inspection must be completed within the stipulated **7-day** window where applicable under state/insurer operational workflow. Implemented as a configurable `completionHours = 168` policy attribute. |
| **Loss Assessor Appointment Timeline** | **VERIFIED** | [PMFBY Operational Guidelines](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Insurance company is required to appoint a loss surveyor within **48 hours** of receiving valid intimation and complete field assessment within the next **10 days**. (Displayed as informational guidance only; Fasal Awaaz never schedules government surveyors.) |
| **Separation from Haryana e-Kshatipurti Portal** | **VERIFIED** | [Haryana e-Kshatipurti Portal](https://ekshatipurti.haryana.gov.in/) & [Meri Fasal Mera Byora (MFMB)](https://fasal.haryana.gov.in/) | Haryana's **e-Kshatipurti** is a **state-government disaster compensation portal** tied to *Parivar Pehchan Patra (PPP / Family ID)* and *Meri Fasal Mera Byora* with Girdawari verification and a 25% minimum damage threshold for state relief. It is **legally and operationally distinct** from central PMFBY insurance claims. Fasal Awaaz strictly isolates PMFBY workflows from state relief schemes. |

---

## 2. Official Reporting Channels Verification

| Channel Name | Contact / Identifier | Official Source | Role in Fasal Awaaz |
| :--- | :--- | :--- | :--- |
| **Krishi Rakshak Portal & Helpline (KRPH)** | Toll-Free: **`14447`** | [PMFBY Official Portal](https://pmfby.gov.in/) / [PIB Press Release](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2304549&reg=48&lang=2) | Primary voice/telephone channel for lodging 72-hour crop loss intimation and receiving an SMS complaint/intimation ticket number. Triggered only via explicit user tap (`tel:14447`). |
| **National Crop Insurance Portal (NCIP)** | `https://pmfby.gov.in/` | [Ministry of Agriculture & Farmers Welfare](https://pmfby.gov.in/) | Official web portal for farmer login, policy verification, and online crop loss reporting. |
| **Crop Insurance Mobile App** | Android Package (`in.farmguide.farmerapp.central`) | [PMFBY Official Portal](https://pmfby.gov.in/) | Official Government of India mobile app for direct crop-loss intimation with geo-tagged photographs. |
| **Kisan Call Centre (KCC)** | Toll-Free: **`1800-180-1551`** | Department of Agriculture & Farmers Welfare | General agricultural advisory and scheme information helpline. Clearly distinguished in UI from the `14447` PMFBY claim intimation helpline. |
| **Concerned Bank Branch / PACS / CSC** | Local Financial Institution / Common Service Centre | [PMFBY Operational Guidelines](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Offline/assisted intimation channel (especially for loanee farmers whose premium was deducted by the bank). Officials must forward intimations within 48 hours. |
| **Local Agriculture / Revenue Official** | Block Agriculture Officer / Gram Sevak / Patwari / VAA | [PMFBY Operational Guidelines](https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf) | Written/in-person intimation channel when digital and telephone channels are unreachable during severe weather. |

---

## 3. Information Requiring Runtime / State-Specific Verification
Per Section 2.8 of the engineering specification, the following items vary by state and season and **cannot** be hardcoded globally:
1. **District-wise Notified Crops & Empanelled Insurance Companies (ICs):** Each State Level Coordination Committee on Crop Insurance (SLCCCI) issues season-specific notifications (Kharif / Rabi) mapping districts and Tehsils/Mandals to specific crops and insurers (e.g., AIC of India, SBI General, HDFC ERGO, IFFCO Tokio).
2. **State Enrollment & Cut-off Dates:** Vary each season.
3. **Engine Behaviour When Unverified:** When a farmer's `state + district + season + crop` combination does not match an active, administrator-verified `PolicyVersion` row in PostgreSQL, the Policy Engine sets `applicabilityStatus = 'UNCERTAIN_APPLICABILITY'`, suppresses any guaranteed deadline countdown, and instructs the farmer to contact **Helpline 14447** or their local Agriculture Office immediately.

---

## 4. Deadline Engine Correctness Rules (Implemented)

These are enforced in `apps/api/src/policy/policy.service.js` and
`apps/api/src/common/ist-time.js`.

### 4.1 The season is derived, never assumed
Kharif and Rabi have different notified crops, cut-off dates and insurance windows, so
the season is derived from the incident's IST date rather than defaulting to Kharif:

| IST month of incident | Season | Alternate considered |
| :--- | :--- | :--- |
| June – October | `KHARIF` | `RABI` in June and October |
| November – December | `RABI` | `KHARIF` in November |
| January – March | `RABI` (labelled by the starting year) | — |
| April – May | `ZAID` | `RABI` |

Seasons overlap in practice — Kharif paddy is still being harvested in November while Rabi
sowing has begun — so when the derived season yields no applicable rule the adjacent
season is tried before giving up. A match found that way is returned with
`seasonSource: 'DERIVED_BOUNDARY_ALTERNATE_SEASON'`, `seasonConfident: false` and a note
telling the farmer to confirm the season with the official channel. A caller may still
pass an explicit `season`, which wins and is reported as `seasonSource: 'EXPLICIT'`.

### 4.2 Effective windows are enforced
Every verified policy carries `effectiveFrom` / `effectiveUntil`. These bounds are checked
against the **incident date** — the rule in force when the loss happened. A rule whose
window does not cover the incident is never applied; the evaluation returns
`VERIFIED_RULE_OUTSIDE_EFFECTIVE_PERIOD` with `policyVersionId: null`, which is distinct
from `UNCERTAIN_APPLICABILITY` (no rule exists for that combination at all). Both direct
the farmer to Helpline 14447 immediately.

> These bounds were previously declared on every seeded policy but never checked, so a
> lapsed rule would keep being reported as `VERIFIED_POLICY_RULE_APPLIED` indefinitely.

### 4.3 Dates are IST, not UTC
A farmer's "today" is an IST calendar date. A bare `YYYY-MM-DD` incident date is anchored
to **IST midday** before any deadline arithmetic, and relative days are resolved on the IST
calendar. Deriving them from a UTC ISO string shifts the date for any incident reported
between 00:00 and 05:30 IST — enough to move a report across the 72-hour boundary.

### 4.4 Seeded coverage
Kharif 2026 (Jun–Dec 2026) and Rabi 2026-27 (Oct 2026 – Apr 2027) for Andhra Pradesh,
Telangana and Uttar Pradesh, across paddy, wheat, groundnut, maize and mustard, with
post-harvest rules for the crops dried in the field. Any other combination correctly
returns `UNCERTAIN_APPLICABILITY` rather than a guessed deadline.
