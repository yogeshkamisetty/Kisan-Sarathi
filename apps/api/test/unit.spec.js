/**
 * Section 21.1 & 21.3: Comprehensive Unit Test Suite
 * Tests:
 * - Extraction validation & zero fabrication rule
 * - Date handling (future date rejection, >72h warning, post-harvest >14-day drying warning)
 * - Area validation (negative rejection, affected > cultivated rejection, unit preservation)
 * - Dynamic question engine priority & non-repetition
 * - Workflow & official submission state machine transitions
 * - Policy applicability & conditional deadline calculation (including Haryana e-Kshatipurti separation)
 * - Consent enforcement & administrator RBAC audit protection
 * - Voice test dataset critical-field extraction accuracy across Hindi, Hinglish, Telugu, Tamil, and English
 */

// Tests run against in-memory state so suites never share or leave on-disk data.
process.env.PERSISTENCE = 'memory';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  WorkflowStatus,
  SubmissionStatus,
  CropStage,
  ConsentType,
  UserRole,
  FieldExtractionStatus,
  CRITICAL_CONFIRMATION_FIELDS,
} = require('../../../packages/shared-types/src/index.js');
const {
  validateLandArea,
  validateIncidentTiming,
  validateExtractionSchema,
} = require('../../../packages/validation/src/index.js');
const { InformationExtractionService } = require('../src/extraction/extraction.service.js');
const { DynamicQuestionEngine } = require('../src/conversation/question-engine.service.js');
const { PolicyEngineService } = require('../src/policy/policy.service.js');
const {
  transitionWorkflowStatus,
  transitionSubmissionStatus,
  verifyCriticalFieldsForFinalisation,
} = require('../src/reports/workflow-state-machine.js');
const { AuditService } = require('../src/audit/audit.service.js');
const { ConsentService } = require('../src/consent/consent.service.js');
const { FarmersService } = require('../src/farmers/farmers.service.js');
const { GnaniTimbreTtsAdapter } = require('../src/gnani/gnani-timbre.adapter.js');
const { createAppContainer } = require('../src/main.js');
const { istDateString, deriveCropSeason } = require('../src/common/ist-time.js');

describe('1. Agricultural Area & Date Validation Rules', () => {
  it('rejects negative or zero affected acreage and preserves original units', () => {
    const resNeg = validateLandArea({ affectedArea: -2, cultivatedArea: 5, unit: 'acre' });
    assert.equal(resNeg.valid, false);
    assert.equal(resNeg.errors[0].code, 'INVALID_AFFECTED_AREA');

    const resHectare = validateLandArea({ affectedArea: 2, cultivatedArea: 4, unit: 'hectare' });
    assert.equal(resHectare.valid, true);
    assert.equal(resHectare.preservedUnit, 'hectare');
    assert.ok(resHectare.equivalentAcres > 4.9);
  });

  it('rejects affected area exceeding total cultivated area', () => {
    const res = validateLandArea({ affectedArea: 5, cultivatedArea: 2, unit: 'acre' });
    assert.equal(res.valid, false);
    assert.equal(res.errors[0].code, 'AFFECTED_EXCEEDS_CULTIVATED');
  });

  it('validates incident timing: rejects future dates, flags >72h elapsed, and checks 14-day post-harvest drying limit', () => {
    const refNow = '2026-11-04T06:00:00Z';

    // Future date rejected
    const futureRes = validateIncidentTiming({
      incidentDateIso: '2026-11-06T00:00:00Z',
      referenceNowIso: refNow,
      cropStage: CropStage.STANDING,
    });
    assert.equal(futureRes.valid, false);
    assert.equal(futureRes.errors[0].code, 'FUTURE_INCIDENT_DATE');

    // Within 72 hours
    const timelyRes = validateIncidentTiming({
      incidentDateIso: '2026-11-03T06:00:00Z',
      referenceNowIso: refNow,
      cropStage: CropStage.STANDING,
    });
    assert.equal(timelyRes.valid, true);
    assert.equal(timelyRes.withinInitialWindow, true);
    assert.equal(timelyRes.hoursElapsed, 24);
    assert.equal(timelyRes.hoursRemaining, 48);

    // >72 hours elapsed warning
    const lateRes = validateIncidentTiming({
      incidentDateIso: '2026-10-30T06:00:00Z',
      referenceNowIso: refNow,
      cropStage: CropStage.STANDING,
    });
    assert.equal(lateRes.withinInitialWindow, false);
    assert.equal(lateRes.warnings[0].code, 'INITIAL_WINDOW_ELAPSED');

    // Post-harvest drying > 14 days warning
    const postHarvestExceeded = validateIncidentTiming({
      incidentDateIso: '2026-11-03T06:00:00Z',
      harvestDateIso: '2026-10-10T06:00:00Z',
      referenceNowIso: refNow,
      cropStage: CropStage.HARVESTED_IN_FIELD_DRYING,
    });
    assert.ok(
      postHarvestExceeded.warnings.some((w) => w.code === 'POST_HARVEST_DRYING_LIMIT_EXCEEDED')
    );
  });
});

describe('2. Schema-Constrained Extraction & Zero Fabrication Guardrail', () => {
  it('rejects any extracted value that lacks a supporting source_text span', () => {
    const res = validateExtractionSchema({
      crop: { value: 'paddy', confidence: 0.99, source_text: null, status: 'needs_confirmation' },
    });
    assert.equal(res.valid, false);
    assert.equal(res.errors[0].code, 'UNGROUNDED_EXTRACTION_REJECTED');
    assert.equal(res.sanitized.crop.value, null);
    assert.equal(res.sanitized.crop.status, FieldExtractionStatus.MISSING);
  });

  it('achieves 100% critical-field extraction accuracy on the multilingual voice test dataset', () => {
    const extractor = new InformationExtractionService({
      referenceDateIso: '2026-11-04T06:00:00+05:30',
    });

    // Case 1: Hindi utterance
    const c1 = extractor.extractFields({
      transcript: 'मेरी धान की खड़ी फसल कल शाम ओलावृष्टि और भारी बारिश से 2 एकड़ खराब हो गई, गाँव रामपुर है',
    });
    assert.equal(c1.extracted.crop.value, 'paddy');
    assert.equal(c1.extracted.loss_event.value, 'hailstorm');
    assert.equal(c1.extracted.crop_stage.value, CropStage.STANDING);
    assert.equal(c1.extracted.affected_area.value, 2);
    assert.equal(c1.extracted.affected_area.unit, 'acre');
    assert.equal(c1.extracted.village.value, 'रामपुर');
    assert.equal(c1.extracted.survey_number.value, null);
    assert.equal(c1.extracted.survey_number.status, 'missing');

    // Case 2: Hinglish code-switching with unknown survey number
    const c2 = extractor.extractFields({
      transcript: 'Mera paddy crop yesterday evening 3 acre damage ho gaya hailstorm se, survey number abhi yaad nahi hai',
    });
    assert.equal(c2.extracted.crop.value, 'paddy');
    assert.equal(c2.extracted.loss_event.value, 'hailstorm');
    assert.equal(c2.extracted.affected_area.value, 3);
    assert.equal(c2.extracted.survey_number.value, null);

    // Case 3: Telugu utterance
    const c3 = extractor.extractFields({
      transcript: 'నిన్న సాయంత్రం వడగళ్ల వాన వల్ల నా 2 ఎకరాల వరి పంట నష్టపోయింది',
    });
    assert.equal(c3.extracted.crop.value, 'paddy');
    assert.equal(c3.extracted.loss_event.value, 'hailstorm');
    assert.equal(c3.extracted.affected_area.value, 2);

    // Case 4: Post-harvest cut-and-spread drying in field
    const c4 = extractor.extractFields({
      transcript: 'फसल काट कर खेत में सुखाने के लिए रखी थी और कल बेमौसम बारिश से 4 एकड़ खराब हो गई',
    });
    assert.equal(c4.extracted.crop_stage.value, CropStage.HARVESTED_IN_FIELD_DRYING);
    assert.equal(c4.extracted.loss_event.value, 'unseasonal_rain');
    assert.equal(c4.extracted.affected_area.value, 4);
  });
});

describe('3. Dynamic Question Engine & Partial Intake', () => {
  it('asks only for missing critical fields and allows partial draft creation when survey_number is missing', () => {
    const qEngine = new DynamicQuestionEngine();

    // Missing affected_area and crop_stage
    const step1 = qEngine.selectNextQuestion({
      fields: {
        crop: { value: 'paddy', status: 'needs_confirmation' },
        loss_event: { value: 'hailstorm', status: 'needs_confirmation' },
        incident_date: { value: '2026-11-03', status: 'needs_confirmation' },
        village: { value: 'Rampur', status: 'needs_confirmation' },
        affected_area: { value: null, status: 'missing' },
        crop_stage: { value: null, status: 'missing' },
      },
      languageCode: 'hi-IN',
    });
    assert.equal(step1.nextFieldToAsk, 'affected_area');
    assert.equal(step1.canPreparePartialDraft, false);

    // All critical fields present, survey_number missing -> canPreparePartialDraft is true!
    const step2 = qEngine.selectNextQuestion({
      fields: {
        crop: { value: 'paddy', status: 'needs_confirmation' },
        loss_event: { value: 'hailstorm', status: 'needs_confirmation' },
        incident_date: { value: '2026-11-03', status: 'needs_confirmation' },
        village: { value: 'Rampur', status: 'needs_confirmation' },
        affected_area: { value: 2, unit: 'acre', status: 'needs_confirmation' },
        crop_stage: { value: 'STANDING', status: 'needs_confirmation' },
        insured_status: { value: 'YES_INSURED', status: 'needs_confirmation' },
        survey_number: { value: null, status: 'missing' },
      },
      languageCode: 'hi-IN',
    });
    assert.equal(step2.canPreparePartialDraft, true);
    assert.equal(step2.skippableForInitialDraft, true);
  });
});

describe('4. Policy Engine, Conditional Deadlines & State Separation', () => {
  const policyService = new PolicyEngineService(new AuditService());

  it('calculates 72-hour initial deadline and 7-day completion deadline when verified policy matches', () => {
    const evalRes = policyService.evaluateDeadlineAndGuidance({
      state: 'Andhra Pradesh',
      district: 'Guntur',
      season: 'KHARIF',
      crop: 'paddy',
      lossEvent: 'hailstorm',
      cropStage: CropStage.STANDING,
      incidentDateIso: '2026-11-03T06:00:00+05:30',
      referenceNowIso: '2026-11-04T06:00:00+05:30',
    });
    assert.equal(evalRes.applicabilityStatus, 'VERIFIED_POLICY_RULE_APPLIED');
    assert.equal(evalRes.intimationDeadlineHours, 72);
    assert.equal(evalRes.completionDeadlineHours, 168);
    assert.equal(evalRes.hoursRemaining, 48);
  });

  it('returns UNCERTAIN_APPLICABILITY when state/crop notification is not verified', () => {
    const evalRes = policyService.evaluateDeadlineAndGuidance({
      state: 'Assam',
      district: 'Kamrup',
      season: 'KHARIF',
      crop: 'jute',
      lossEvent: 'hailstorm',
      cropStage: CropStage.STANDING,
      incidentDateIso: '2026-11-03T06:00:00+05:30',
    });
    assert.equal(evalRes.applicabilityStatus, 'UNCERTAIN_APPLICABILITY');
    assert.equal(evalRes.guaranteedDeadline, false);
  });

  it('strictly separates Haryana e-Kshatipurti state relief workflow from PMFBY', () => {
    const evalRes = policyService.evaluateDeadlineAndGuidance({
      state: 'Haryana',
      district: 'Karnal',
      crop: 'paddy',
      requestedScheme: 'E_KSHATIPURTI',
    });
    assert.equal(evalRes.applicabilityStatus, 'SEPARATE_STATE_SCHEME_WORKFLOW');
    assert.ok(evalRes.explanation.includes('ekshatipurti.haryana.gov.in'));
  });
});

describe('5. Dual-Track Workflow State Machine, Consent & Security Controls', () => {
  it('blocks setting OFFICIALLY_VERIFIED from manual farmer/operator reference entry', () => {
    assert.throws(
      () =>
        transitionSubmissionStatus(
          SubmissionStatus.NOT_SUBMITTED,
          SubmissionStatus.OFFICIALLY_VERIFIED,
          { isAuthorisedGovernmentIntegration: false }
        ),
      /UNVERIFIED_SUBMISSION_STATUS_FORBIDDEN/
    );
  });

  it('blocks report finalisation before voice readback confirmation', () => {
    const check = verifyCriticalFieldsForFinalisation({
      readbackCompleted: false,
      extractedValues: {},
    });
    assert.equal(check.ready, false);
    assert.match(check.reason, /VOICE_READBACK_REQUIRED/);
  });

  it('enforces explicit consent before recording/processing and blocks bank account collection', () => {
    const audit = new AuditService();
    const consent = new ConsentService(audit);
    const farmers = new FarmersService(audit);

    assert.throws(
      () => consent.requireConsent('user-1', ConsentType.AUDIO_RECORDING),
      /CONSENT_REQUIRED/
    );
    consent.grantConsent({ userId: 'user-1', consentType: ConsentType.AUDIO_RECORDING });
    assert.equal(consent.requireConsent('user-1', ConsentType.AUDIO_RECORDING), true);

    // Bank account collection blocked
    assert.throws(
      () =>
        farmers.createProfile({
          userId: 'user-1',
          farmerName: 'Test Farmer',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          village: 'Peddapalli',
          bankAccountNumber: '123456789012',
        }),
      /DATA_MINIMISATION_VIOLATION/
    );

    // Admin cannot silently alter farmer report field without reason
    assert.throws(
      () =>
        audit.recordEvent({
          actorId: 'admin-1',
          actorRole: UserRole.ADMIN,
          reportId: 'rep-1',
          action: 'ADMIN_EDIT',
          fieldName: 'affected_area',
          reason: null,
        }),
      /SECURITY_VIOLATION/
    );
  });
});


describe('6. Relative Date Resolution, IST Boundaries & Ambiguity', () => {
  const REF = '2026-11-04T06:00:00+05:30';
  const extractor = new InformationExtractionService();
  const dateOf = (transcript, referenceDateIso = REF) =>
    extractor.extractFields({ transcript, referenceDateIso }).extracted.incident_date;

  it('resolves unambiguous relative days in every supported language', () => {
    assert.equal(dateOf('my paddy was damaged yesterday by hailstorm').value, '2026-11-03');
    assert.equal(dateOf('నిన్న వడగళ్ల వాన వల్ల వరి పంట నష్టం').value, '2026-11-03');
    assert.equal(dateOf('நேற்று கனமழை நெல் சேதம்').value, '2026-11-03');
    assert.equal(dateOf('ನಿನ್ನೆ ಆಲಿಕಲ್ಲು ಮಳೆ ಭತ್ತ ಹಾನಿ').value, '2026-11-03');
    assert.equal(dateOf('ഇന്നലെ ആലിപ്പഴം നെല്ല് നാശം').value, '2026-11-03');
    assert.equal(dateOf('आज सुबह ओलावृष्टि से धान खराब').value, '2026-11-04');
    assert.equal(dateOf('परसों ओलावृष्टि से धान खराब').value, '2026-11-02');
  });

  it('checks "day before yesterday" before "yesterday" in Tamil, where the phrase contains it', () => {
    // "நேற்று முன் தினம்" contains "நேற்று" (yesterday) and must not resolve to -1 day.
    assert.equal(dateOf('நேற்று முன் தினம் கனமழை நெல் சேதம்').value, '2026-11-02');
  });

  it('treats the ambiguous Hindi "कल" as uncertain rather than silently dating the incident', () => {
    const d = dateOf('मेरी धान की फसल कल ओलावृष्टि से खराब हुई');
    // Past reading is offered, but flagged for farmer confirmation.
    assert.equal(d.value, '2026-11-03');
    assert.equal(d.status, FieldExtractionStatus.UNCERTAIN);
    assert.ok(d.confidence < 0.7, 'ambiguous value must not carry high confidence');
    assert.equal(d.ambiguous, true);
  });

  it('extracts no date at all when "कल" is paired with a future marker', () => {
    const d = dateOf('कल भारी बारिश होगी, धान को नुकसान होगा');
    assert.equal(d.value, null);
    assert.equal(d.status, FieldExtractionStatus.MISSING);
  });

  it('does not match a relative-day word inside a longer word', () => {
    // "आजकल" means "nowadays" and contains both आज (today) and कल.
    assert.equal(dateOf('आजकल बहुत बारिश हो रही है, धान खराब').value, null);
  });

  it('resolves "today" against the IST calendar date, not the UTC one', () => {
    // 02:00 IST is still the previous day in UTC; slicing a UTC ISO string would have
    // dated this incident to 3 November and could push it outside the 72-hour window.
    assert.equal(dateOf('आज ओलावृष्टि', '2026-11-04T02:00:00+05:30').value, '2026-11-04');
    assert.equal(dateOf('आज ओलावृष्टि', '2026-11-04T23:30:00+05:30').value, '2026-11-04');
  });

  it('does not freeze "today" at construction time', () => {
    // A long-lived service instance previously carried a build-time reference date.
    const fresh = new InformationExtractionService();
    const expected = istDateString(new Date());
    assert.equal(fresh.extractFields({ transcript: 'आज ओलावृष्टि' }).extracted.incident_date.value, expected);
  });
});

describe('7. Crop Season Derivation & Policy Effective Windows', () => {
  const policyService = new PolicyEngineService();
  const evaluate = (overrides) =>
    policyService.evaluateDeadlineAndGuidance({
      state: 'Andhra Pradesh',
      district: 'Guntur',
      crop: 'paddy',
      lossEvent: 'hailstorm',
      ...overrides,
    });

  it('derives the season from the incident date instead of assuming Kharif', () => {
    assert.equal(deriveCropSeason('2026-08-15T00:00:00+05:30').season, 'KHARIF');
    assert.equal(deriveCropSeason('2027-01-15T00:00:00+05:30').season, 'RABI');
    // A Rabi season starting in November is labelled by its starting year.
    assert.equal(deriveCropSeason('2027-02-10T00:00:00+05:30').seasonYear, 2026);
    assert.equal(deriveCropSeason('2027-04-20T00:00:00+05:30').season, 'ZAID');
    assert.equal(deriveCropSeason(null).season, null);
  });

  it('applies a verified Rabi rule to a winter-season report', () => {
    const r = evaluate({
      state: 'Uttar Pradesh',
      district: 'Agra',
      crop: 'wheat',
      incidentDateIso: '2027-01-15',
      referenceNowIso: '2027-01-16T06:00:00+05:30',
    });
    assert.equal(r.applicabilityStatus, 'VERIFIED_POLICY_RULE_APPLIED');
    assert.equal(r.season, 'RABI');
    assert.equal(r.seasonSource, 'DERIVED_FROM_INCIDENT_DATE');
  });

  it('refuses to apply a verified rule outside its notified effective period', () => {
    // The effective bounds were previously declared but never checked, so a lapsed rule
    // kept being reported as verified long after it expired.
    const r = evaluate({
      incidentDateIso: '2029-08-01',
      referenceNowIso: '2029-08-02T06:00:00+05:30',
    });
    assert.equal(r.applicabilityStatus, 'VERIFIED_RULE_OUTSIDE_EFFECTIVE_PERIOD');
    assert.equal(r.policyVersionId, null);
    assert.equal(r.guaranteedDeadline, false);
    assert.match(r.explanation, /lapsed|had not yet begun/);
    assert.ok(r.officialChannels.length > 0);
  });

  it('still reports UNCERTAIN_APPLICABILITY when no rule exists for the crop at all', () => {
    const r = evaluate({
      crop: 'sugarcane',
      incidentDateIso: '2026-11-03',
      referenceNowIso: '2026-11-04T06:00:00+05:30',
    });
    assert.equal(r.applicabilityStatus, 'UNCERTAIN_APPLICABILITY');
  });

  it('honours an explicitly supplied season over the derived one', () => {
    const r = evaluate({
      season: 'KHARIF',
      incidentDateIso: '2026-11-03',
      referenceNowIso: '2026-11-04T06:00:00+05:30',
    });
    assert.equal(r.season, 'KHARIF');
    assert.equal(r.seasonSource, 'EXPLICIT');
  });

  it('anchors a bare incident date to IST, not UTC midnight, for deadline arithmetic', () => {
    const r = evaluate({
      incidentDateIso: '2026-11-03',
      referenceNowIso: '2026-11-04T06:00:00+05:30',
    });
    assert.equal(r.applicabilityStatus, 'VERIFIED_POLICY_RULE_APPLIED');
    // Midday IST on 3 Nov + 72h = midday IST on 6 Nov (06:30 UTC).
    assert.equal(r.initialDeadlineIso, '2026-11-06T06:30:00.000Z');
  });
});

describe('8. Voice Readback Localisation & Spoken Numbers', () => {
  const tts = new GnaniTimbreTtsAdapter({ env: {} });

  it('spells out whole numbers, decimals and large values in Hindi', () => {
    const n = (t) => tts.normalizeTextForSpeech(t, 'hi-IN');
    assert.equal(n('लगभग 2 एकड़'), 'लगभग दो एकड़');
    // Previously only 0-10 and 72 were handled, so "15" and "2.5" were read as digits.
    assert.equal(n('15 एकड़'), 'पंद्रह एकड़');
    assert.equal(n('लगभग 2.5 एकड़'), 'लगभग दो दशमलव पाँच एकड़');
    assert.equal(n('72 घंटे'), 'बहत्तर घंटे');
    assert.equal(n('45 एकड़'), 'पैंतालीस एकड़');
    assert.equal(n('1250 रुपये'), 'एक हज़ार दो सौ पचास रुपये');
  });

  it('normalises numbers that sit directly against Devanagari text', () => {
    // ASCII word boundaries do not separate digits from Devanagari, so these were missed.
    assert.match(tts.normalizeTextForSpeech('कुल 3 एकड़ में से 2 एकड़', 'hi-IN'), /तीन/);
    assert.match(tts.normalizeTextForSpeech('कुल 3 एकड़ में से 2 एकड़', 'hi-IN'), /दो/);
  });

  it('leaves identifiers such as survey numbers as digits', () => {
    assert.equal(tts.normalizeTextForSpeech('सर्वे नंबर 123/4A', 'hi-IN'), 'सर्वे नंबर 123/4A');
  });

  it('leaves digits untouched for languages with no verified number table', () => {
    assert.equal(tts.normalizeTextForSpeech('2 ఎకరాలు', 'te-IN'), '2 ఎకరాలు');
  });

  it('reads canonical field values back in the farmer\'s own language', async () => {
    const app = createAppContainer({
      PERSISTENCE: 'memory',
      JWT_ACCESS_SECRET: 'a'.repeat(30),
      JWT_REFRESH_SECRET: 'b'.repeat(30),
    });
    const { report } = app.reportsService.createReport({
      idempotencyKey: 'readback-i18n',
      farmerProfile: { id: 'f1', userId: 'u1', state: 'Andhra Pradesh', district: 'Guntur', village: 'Pedakakani' },
      actorId: 'u1',
    });
    app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'मेरी धान की खड़ी फसल कल ओलावृष्टि से 2 एकड़ खराब हो गई',
      referenceDateIso: '2026-11-04T06:00:00+05:30',
    });

    // Canonical keys ("paddy", "hailstorm", "STANDING") must not be spoken into a
    // non-English sentence: the readback is the farmer's only chance to catch an error.
    const hi = await app.reportsService.generateVoiceReadback({ reportId: report.id, languageCode: 'hi-IN' });
    assert.match(hi.readbackText, /धान/);
    assert.match(hi.readbackText, /ओलावृष्टि/);
    assert.match(hi.readbackText, /नवंबर/);
    assert.ok(!hi.readbackText.includes('paddy'));
    assert.ok(!hi.readbackText.includes('hailstorm'));
    assert.ok(!hi.readbackText.includes('STANDING'));
    assert.ok(!hi.readbackText.includes('2026-11-03'));

    const ta = await app.reportsService.generateVoiceReadback({ reportId: report.id, languageCode: 'ta-IN' });
    assert.match(ta.readbackText, /நெல்/);
    assert.ok(!ta.readbackText.includes('paddy'));

    const ml = await app.reportsService.generateVoiceReadback({ reportId: report.id, languageCode: 'ml-IN' });
    assert.match(ml.readbackText, /നെല്ല്/);

    // An ambiguous value gets its own spoken question and is reported to the caller.
    assert.deepEqual(hi.requiresClarification, ['incident_date']);
    assert.match(hi.readbackText, /सही तारीख/);
  });
});

describe('9. Scoped Skip Intent & Validated Corrections', () => {
  const REF = '2026-11-04T06:00:00+05:30';

  function freshApp() {
    return createAppContainer({
      PERSISTENCE: 'memory',
      JWT_ACCESS_SECRET: 'c'.repeat(30),
      JWT_REFRESH_SECRET: 'd'.repeat(30),
    });
  }

  function newReport(app, key) {
    return app.reportsService.createReport({
      idempotencyKey: key,
      farmerProfile: { id: 'f1', userId: 'u1', state: 'Andhra Pradesh', district: 'Guntur', village: 'Pedakakani' },
      actorId: 'u1',
    }).report;
  }

  it('does not skip survey_number because "don\'t know" appeared while answering another question', () => {
    const app = freshApp();
    const report = newReport(app, 'skip-scope');
    const turn = app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'धान की खड़ी फसल ओलावृष्टि से खराब हो गई, कितने एकड़ पता नहीं',
      referenceDateIso: REF,
    });
    assert.deepEqual(turn.skippedOptionalFields, []);
    assert.deepEqual(report.skippedOptionalFields, []);
  });

  it('skips the field the farmer explicitly names', () => {
    const app = freshApp();
    const report = newReport(app, 'skip-named');
    const turn = app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'फसल बीमा करवाया है, लेकिन सर्वे नंबर अभी याद नहीं है',
      referenceDateIso: REF,
    });
    assert.deepEqual(turn.skippedOptionalFields, ['survey_number']);
  });

  it('applies a bare "skip" only to the optional field that was actually asked', () => {
    const app = freshApp();
    const report = newReport(app, 'skip-asked');
    app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'धान की खड़ी फसल 2026-11-03 को ओलावृष्टि से 2 एकड़ खराब, गाँव पेडकाकानी',
      referenceDateIso: REF,
    });
    // Drive the conversation to the point where survey_number is the open question.
    app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'हाँ, फसल बीमा करवाया हुआ है',
      referenceDateIso: REF,
    });
    assert.equal(report.lastAskedField, 'survey_number');

    const turn = app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'पता नहीं',
      referenceDateIso: REF,
    });
    assert.deepEqual(turn.skippedOptionalFields, ['survey_number']);
  });

  it('rejects a correction that cannot be valid under any circumstances', () => {
    const app = freshApp();
    const report = newReport(app, 'correct-negative');
    assert.throws(
      () =>
        app.reportsService.correctField({
          reportId: report.id,
          actorId: 'u1',
          fieldName: 'affected_area',
          newValue: -3,
          unit: 'acre',
        }),
      /INVALID_CORRECTION/
    );
  });

  it('keeps a contradictory corrected area but blocks finalisation until it is clarified', () => {
    const app = freshApp();
    const report = newReport(app, 'correct-contradiction');
    app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'मेरी धान की खड़ी फसल 2026-11-03 को ओलावृष्टि से 2 एकड़ खराब हुई, कुल 5 एकड़ बोई थी',
      referenceDateIso: REF,
    });

    // A correction previously bypassed the area checks entirely and was stamped CORRECTED
    // with full confidence, carrying the contradiction into the finalised draft.
    const corrected = app.reportsService.correctField({
      reportId: report.id,
      actorId: 'u1',
      fieldName: 'affected_area',
      newValue: 50,
      unit: 'acre',
    });
    assert.equal(corrected.updatedField.value, 50, 'the farmer-stated figure is preserved');
    assert.equal(corrected.updatedField.status, FieldExtractionStatus.UNCERTAIN);
    assert.equal(corrected.requiresClarification, true);

    assert.throws(
      () => app.reportsService.confirmAfterReadback({ reportId: report.id, actorId: 'u1' }),
      /UNCERTAIN_CRITICAL_FIELDS/
    );

    // Correcting the other side of the comparison clears the flag.
    app.reportsService.correctField({
      reportId: report.id,
      actorId: 'u1',
      fieldName: 'cultivated_area',
      newValue: 60,
      unit: 'acre',
    });
    assert.equal(report.extractedValues.affected_area.status, FieldExtractionStatus.NEEDS_CONFIRMATION);
  });

  it('leaves no partially confirmed state when readback confirmation fails', () => {
    const app = freshApp();
    const report = newReport(app, 'atomic-confirm');
    app.reportsService.processConversationTurn({
      reportId: report.id,
      actorId: 'u1',
      transcript: 'धान की फसल ओलावृष्टि से खराब हुई',
      referenceDateIso: REF,
    });

    const statusesBefore = CRITICAL_CONFIRMATION_FIELDS.map((f) => report.extractedValues[f]?.status);

    assert.throws(
      () => app.reportsService.confirmAfterReadback({ reportId: report.id, actorId: 'u1' }),
      /UNCONFIRMED_CRITICAL_FIELDS/
    );

    // The report must not claim it was read back to the farmer when it was not.
    assert.equal(report.readbackCompleted, false);
    assert.equal(report.farmerVerifiedAt, null);
    assert.equal(report.finalisedAt, null);
    assert.deepEqual(
      CRITICAL_CONFIRMATION_FIELDS.map((f) => report.extractedValues[f]?.status),
      statusesBefore
    );
  });
});
