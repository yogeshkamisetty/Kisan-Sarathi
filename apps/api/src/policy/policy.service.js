/**
 * Government Policy & Conditional Deadline Engine
 *
 * Enforces Section 7:
 * - Never applies a universal hardcoded 72-hour assumption without checking state, district, season, crop, and loss category.
 * - Distinguishes PMFBY Localised Calamity vs. Post-Harvest Loss (cut-and-spread drying <=14 days).
 * - Strictly separates central PMFBY workflows from state relief portals such as Haryana's e-Kshatipurti.
 * - Shows UNCERTAIN_APPLICABILITY when no verified notification matches, instructing immediate official contact.
 */
const crypto = require('node:crypto');
const { IncidentCategory, CropStage } = require('../../../../packages/shared-types/src/index.js');
const { OFFICIAL_PMFBY_CHANNELS } = require('../../../../packages/contracts/src/index.js');
const { validateIncidentTiming } = require('../../../../packages/validation/src/index.js');
const {
  deriveCropSeason,
  normalizeIncidentDateToIso,
} = require('../common/ist-time.js');

const SEEDED_VERIFIED_POLICIES = [
  {
    id: 'pol-pmfby-ap-kharif-2026-paddy-localised',
    state: 'Andhra Pradesh',
    districtScope: 'ALL',
    season: 'KHARIF',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Under PMFBY Revamped Operational Guidelines, individual farm-level loss due to localised calamities (hailstorm, landslide, inundation, cloudburst, natural fire) must be intimated within 72 hours of the incident via Helpline 14447, the Crop Insurance App, bank branch, or agriculture official. Missing secondary details should be completed within 7 days.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-06-01T00:00:00Z',
    effectiveUntil: '2026-12-31T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-ap-kharif-2026-paddy-postharvest',
    state: 'Andhra Pradesh',
    districtScope: 'ALL',
    season: 'KHARIF',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.POST_HARVEST_LOSS,
    eligibleEventCategories: ['unseasonal_rain', 'cyclonic_rain', 'hailstorm'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Under PMFBY Post-Harvest Loss rules, crops harvested and left in the field in cut-and-spread / small bundled condition for drying are covered for up to 14 days from harvesting against unseasonal/cyclonic rain or hailstorm. Intimation must be lodged within 72 hours of the weather event.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-06-01T00:00:00Z',
    effectiveUntil: '2026-12-31T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-tg-kharif-2026-paddy-localised',
    state: 'Telangana',
    districtScope: 'ALL',
    season: 'KHARIF',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-06-01T00:00:00Z',
    effectiveUntil: '2026-12-31T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-up-kharif-2026-paddy-localised',
    state: 'Uttar Pradesh',
    districtScope: 'ALL',
    season: 'KHARIF',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-06-01T00:00:00Z',
    effectiveUntil: '2026-12-31T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  // ---- Rabi 2026-27 ----------------------------------------------------------
  // The Rabi season is sown after the monsoon and harvested in spring, so its effective
  // window deliberately crosses the calendar year. Without these rules every winter-season
  // report fell through to UNCERTAIN_APPLICABILITY.
  {
    id: 'pol-pmfby-ap-rabi-2026-paddy-localised',
    state: 'Andhra Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-ap-rabi-2026-groundnut-localised',
    state: 'Andhra Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'groundnut',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-tg-rabi-2026-paddy-localised',
    state: 'Telangana',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-tg-rabi-2026-maize-localised',
    state: 'Telangana',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'maize',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-up-rabi-2026-wheat-localised',
    state: 'Uttar Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'wheat',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-up-rabi-2026-mustard-localised',
    state: 'Uttar Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'mustard',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.LOCALISED_CALAMITY,
    eligibleEventCategories: ['hailstorm', 'landslide', 'inundation', 'cloudburst', 'natural_fire_lightning'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Verified PMFBY Localised Calamity rule: 72-hour initial intimation via Krishi Rakshak Helpline 14447 or Crop Insurance App, with 7-day completion window for pending survey/policy references.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-ap-rabi-2026-paddy-postharvest',
    state: 'Andhra Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'paddy',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.POST_HARVEST_LOSS,
    eligibleEventCategories: ['unseasonal_rain', 'cyclonic_rain', 'hailstorm'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Under PMFBY Post-Harvest Loss rules, crops harvested and left in the field in cut-and-spread / small bundled condition for drying are covered for up to 14 days from harvesting against unseasonal/cyclonic rain or hailstorm. Intimation must be lodged within 72 hours of the weather event.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
  {
    id: 'pol-pmfby-up-rabi-2026-wheat-postharvest',
    state: 'Uttar Pradesh',
    districtScope: 'ALL',
    season: 'RABI',
    crop: 'wheat',
    scheme: 'PMFBY',
    lossCategory: IncidentCategory.POST_HARVEST_LOSS,
    eligibleEventCategories: ['unseasonal_rain', 'cyclonic_rain', 'hailstorm'],
    intimationDeadlineHours: 72,
    completionDeadlineHours: 168,
    postHarvestMaxDryingDays: 14,
    deadlineRuleExplanation:
      'Under PMFBY Post-Harvest Loss rules, crops harvested and left in the field in cut-and-spread / small bundled condition for drying are covered for up to 14 days from harvesting against unseasonal/cyclonic rain or hailstorm. Intimation must be lodged within 72 hours of the weather event.',
    sourceUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04T00:00:00Z',
    effectiveFrom: '2026-10-15T00:00:00Z',
    effectiveUntil: '2027-04-30T23:59:59Z',
    version: 'PMFBY-OG-2026.1',
    active: true,
  },
];

class PolicyEngineService {
  constructor(auditService) {
    this.auditService = auditService;
    this.policies = [...SEEDED_VERIFIED_POLICIES];
  }

  determineIncidentCategory({ cropStage, lossEvent }) {
    if (cropStage === CropStage.HARVESTED_IN_FIELD_DRYING) {
      return IncidentCategory.POST_HARVEST_LOSS;
    }
    if (cropStage === CropStage.STANDING) {
      return IncidentCategory.LOCALISED_CALAMITY;
    }
    return IncidentCategory.OTHER_UNCLASSIFIED;
  }

  evaluateDeadlineAndGuidance({
    state,
    district,
    /**
     * Omit to derive the season from the incident date. Kharif and Rabi have different
     * notified crops and cut-off dates, so defaulting to one of them silently mis-rates
     * every winter-season report.
     */
    season = null,
    crop,
    lossEvent,
    cropStage = CropStage.STANDING,
    incidentDateIso,
    harvestDateIso = null,
    /** Null means "now"; a fixed value is for deterministic tests and the demo. */
    referenceNowIso = null,
    requestedScheme = 'PMFBY',
  }) {
    const referenceNow = referenceNowIso || new Date().toISOString();
    // A bare YYYY-MM-DD is anchored to IST midday, not UTC midnight, so deadline
    // arithmetic cannot drift across the date boundary.
    const incidentIso = normalizeIncidentDateToIso(incidentDateIso);

    const derivedSeason = deriveCropSeason(incidentIso);
    const effectiveSeason = season || derivedSeason.season;
    const seasonSource = season ? 'EXPLICIT' : 'DERIVED_FROM_INCIDENT_DATE';
    // Rule 7.4: Strict separation between PMFBY and Haryana's e-Kshatipurti state portal
    if (requestedScheme === 'E_KSHATIPURTI' || (state === 'Haryana' && requestedScheme !== 'PMFBY')) {
      return {
        scheme: 'HARYANA_E_KSHATIPURTI_SEPARATE_WORKFLOW',
        applicabilityStatus: 'SEPARATE_STATE_SCHEME_WORKFLOW',
        guaranteedDeadline: false,
        explanation:
          'Important: Haryana e-Kshatipurti (ekshatipurti.haryana.gov.in) is a state-government disaster relief portal linked to Parivar Pehchan Patra (Family ID) and Meri Fasal Mera Byora, separate from central PMFBY insurance claims. This MVP prepares PMFBY intimation drafts; please verify whether you are reporting to PMFBY (14447) or Haryana e-Kshatipurti.',
        officialChannels: OFFICIAL_PMFBY_CHANNELS,
      };
    }

    const lossCategory = this.determineIncidentCategory({ cropStage, lossEvent });

    const seasonContext = {
      season: effectiveSeason,
      seasonSource,
      seasonYear: derivedSeason.seasonYear,
      seasonConfident: season ? true : derivedSeason.confident,
      seasonNote: derivedSeason.note,
    };

    /** Matches everything except the policy's effective date window. */
    const matchesExceptWindow = (p, forSeason) =>
      p.active &&
      p.scheme === 'PMFBY' &&
      p.state.toLowerCase() === String(state || '').toLowerCase() &&
      (p.districtScope === 'ALL' ||
        p.districtScope.toLowerCase() === String(district || '').toLowerCase()) &&
      p.season.toUpperCase() === String(forSeason || '').toUpperCase() &&
      p.crop.toLowerCase() === String(crop || '').toLowerCase() &&
      p.lossCategory === lossCategory;

    /**
     * A notification only governs incidents that happened inside its effective window.
     * These bounds were previously declared on every seeded policy but never checked, so
     * an expired rule would keep being reported as "VERIFIED_POLICY_RULE_APPLIED" long
     * after it lapsed — the worst failure mode here, since the farmer would trust it.
     */
    const withinEffectiveWindow = (p) => {
      if (!incidentIso) return true;
      const at = new Date(incidentIso).getTime();
      if (p.effectiveFrom && at < new Date(p.effectiveFrom).getTime()) return false;
      if (p.effectiveUntil && at > new Date(p.effectiveUntil).getTime()) return false;
      return true;
    };

    /**
     * Seasons overlap around the boundary months, so if the derived season yields no
     * applicable rule the adjacent season is tried before giving up — otherwise a Kharif
     * paddy harvest loss in November would be reported as having no verified rule.
     */
    let appliedSeason = effectiveSeason;
    let candidates = this.policies.filter((p) => matchesExceptWindow(p, effectiveSeason));
    let matchedPolicy = candidates.find(withinEffectiveWindow);

    if (!matchedPolicy && !season && derivedSeason.alternateSeason) {
      const altCandidates = this.policies.filter((p) =>
        matchesExceptWindow(p, derivedSeason.alternateSeason)
      );
      const altMatch = altCandidates.find(withinEffectiveWindow);
      if (altMatch) {
        appliedSeason = derivedSeason.alternateSeason;
        candidates = altCandidates;
        matchedPolicy = altMatch;
        seasonContext.season = appliedSeason;
        seasonContext.seasonSource = 'DERIVED_BOUNDARY_ALTERNATE_SEASON';
        seasonContext.seasonConfident = false;
        seasonContext.seasonNote =
          `${derivedSeason.note || ''} The ${appliedSeason} notification was applied because no ${effectiveSeason} rule covers this crop and date; please confirm the season with the official channel.`.trim();
      } else if (altCandidates.length > 0) {
        candidates = candidates.concat(altCandidates);
      }
    }

    if (!matchedPolicy) {
      // Distinguish "we have no rule for this combination" from "our verified rule for
      // this combination does not cover this date", because the farmer's next step and
      // our own follow-up differ.
      const lapsed = candidates.length > 0;
      return {
        scheme: 'PMFBY',
        applicabilityStatus: lapsed
          ? 'VERIFIED_RULE_OUTSIDE_EFFECTIVE_PERIOD'
          : 'UNCERTAIN_APPLICABILITY',
        policyVersionId: null,
        policyVersion: null,
        guaranteedDeadline: false,
        ...seasonContext,
        urgencyLevel: 'HIGH_CONTACT_OFFICIAL_CHANNEL_IMMEDIATELY',
        explanation: lapsed
          ? `A verified rule exists for ${state} / ${effectiveSeason} / ${crop}, but it does not cover the reported incident date (${incidentDateIso}); its notified period has lapsed or had not yet begun. Fasal Awaaz will not apply an out-of-date deadline. Contact Helpline 14447, the Crop Insurance App, or your local Agriculture Office immediately to confirm the current rule.`
          : `A verified state/district/crop notification rule could not be confirmed automatically for this combination (${state || 'unknown state'} / ${effectiveSeason || 'unknown season'} / ${crop || 'unknown crop'}). Under standard PMFBY guidelines, localised calamity and post-harvest losses typically require intimation within 72 hours. Do not wait—contact Helpline 14447, the Crop Insurance App, or your local Agriculture Office immediately.`,
        importantDisclaimer:
          'Saving a draft in Fasal Awaaz does NOT satisfy official PMFBY intimation requirements.',
        officialChannels: OFFICIAL_PMFBY_CHANNELS,
      };
    }

    const eventEligible =
      !lossEvent || matchedPolicy.eligibleEventCategories.includes(String(lossEvent).toLowerCase());

    if (!eventEligible) {
      return {
        scheme: 'PMFBY',
        applicabilityStatus: 'EVENT_REQUIRES_OFFICIAL_CLARIFICATION',
        ...seasonContext,
        policyVersionId: matchedPolicy.id,
        policyVersion: matchedPolicy.version,
        sourceUrl: matchedPolicy.sourceUrl,
        guaranteedDeadline: false,
        urgencyLevel: 'MODERATE_CLARIFY_WITH_OFFICIAL_CHANNEL',
        explanation: `Reported event "${lossEvent}" is not in the standard automated list (${matchedPolicy.eligibleEventCategories.join(', ')}) for ${lossCategory}. Not all weather damage is assessed as an individual farm-level claim (widespread yield loss is assessed via area-level CCEs). Please contact Helpline 14447 or your bank/agriculture officer to confirm.`,
        importantDisclaimer:
          'Saving a draft in Fasal Awaaz does NOT satisfy official PMFBY intimation requirements.',
        officialChannels: OFFICIAL_PMFBY_CHANNELS,
      };
    }

    const timing = validateIncidentTiming({
      incidentDateIso: incidentIso,
      referenceNowIso: referenceNow,
      cropStage,
      harvestDateIso,
      intimationWindowHours: matchedPolicy.intimationDeadlineHours,
      maxPostHarvestDryingDays: matchedPolicy.postHarvestMaxDryingDays,
    });

    let initialDeadlineIso = null;
    let sevenDayCompletionDeadlineIso = null;
    if (incidentIso && !timing.isMissing && timing.valid) {
      const incMs = new Date(incidentIso).getTime();
      initialDeadlineIso = new Date(
        incMs + matchedPolicy.intimationDeadlineHours * 3600 * 1000
      ).toISOString();
      sevenDayCompletionDeadlineIso = new Date(
        incMs + matchedPolicy.completionDeadlineHours * 3600 * 1000
      ).toISOString();
    }

    return {
      scheme: 'PMFBY',
      applicabilityStatus: 'VERIFIED_POLICY_RULE_APPLIED',
      policyVersionId: matchedPolicy.id,
      policyVersion: matchedPolicy.version,
      sourceUrl: matchedPolicy.sourceUrl,
      verifiedAt: matchedPolicy.verifiedAt,
      effectiveFrom: matchedPolicy.effectiveFrom,
      effectiveUntil: matchedPolicy.effectiveUntil,
      ...seasonContext,
      lossCategory,
      intimationDeadlineHours: matchedPolicy.intimationDeadlineHours,
      completionDeadlineHours: matchedPolicy.completionDeadlineHours,
      initialDeadlineIso,
      sevenDayCompletionDeadlineIso,
      hoursElapsed: timing.hoursElapsed,
      hoursRemaining: timing.hoursRemaining,
      withinInitial72HourWindow: timing.withinInitialWindow,
      urgencyLevel:
        timing.withinInitialWindow === false
          ? 'CRITICAL_WINDOW_ELAPSED_REPORT_IMMEDIATELY'
          : timing.hoursRemaining !== null && timing.hoursRemaining <= 24
          ? 'URGENT_LESS_THAN_24_HOURS_LEFT'
          : 'ACTIVE_WITHIN_72_HOUR_WINDOW',
      explanation: matchedPolicy.deadlineRuleExplanation,
      timingWarnings: timing.warnings,
      importantDisclaimer:
        'Saving a draft in Fasal Awaaz does NOT satisfy official PMFBY intimation requirements. You must submit your intimation through an official channel below.',
      officialChannels: OFFICIAL_PMFBY_CHANNELS,
    };
  }

  updatePolicyConfig({ actorId, actorRole, policyId, updates }) {
    if (actorRole !== 'ADMIN') {
      throw new Error('FORBIDDEN: Only administrators can update policy configurations.');
    }
    const idx = this.policies.findIndex((p) => p.id === policyId);
    if (idx === -1) throw new Error('POLICY_NOT_FOUND');

    const previous = { ...this.policies[idx] };
    const updated = {
      ...previous,
      ...updates,
      verifiedAt: new Date().toISOString(),
    };
    this.policies[idx] = updated;

    if (this.auditService) {
      this.auditService.recordEvent({
        actorId,
        actorRole,
        action: 'POLICY_CONFIGURATION_UPDATED',
        fieldName: policyId,
        previousValue: previous,
        newValue: updated,
        reason: 'Admin policy update',
        source: 'ADMIN_CONSOLE',
      });
    }
    return updated;
  }
}

module.exports = { PolicyEngineService, SEEDED_VERIFIED_POLICIES };
