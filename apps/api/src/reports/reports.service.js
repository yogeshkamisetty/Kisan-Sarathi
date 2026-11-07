/**
 * Core Reports & Conversation Orchestration Service
 * Handles idempotent creation, turn-by-turn voice extraction, farmer correction with audit history,
 * critical-field readback confirmation, and separate official submission reference tracking.
 */
const crypto = require('node:crypto');
const {
  WorkflowStatus,
  SubmissionStatus,
  IncidentCategory,
  FieldExtractionStatus,
  CropStage,
  CRITICAL_CONFIRMATION_FIELDS,
  OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS,
} = require('../../../../packages/shared-types/src/index.js');
const { validateLandArea } = require('../../../../packages/validation/src/index.js');
const {
  transitionWorkflowStatus,
  transitionSubmissionStatus,
  verifyCriticalFieldsForFinalisation,
} = require('./workflow-state-machine.js');
const {
  SUPPORTED_READBACK_LANGUAGES,
  cropLabel,
  lossEventLabel,
  cropStageLabel,
  areaUnitLabel,
  spokenDate,
} = require('../conversation/localized-labels.js');

/**
 * Spoken placeholders for values that are genuinely absent. The readback says "not yet
 * stated" in the farmer's language rather than splicing in an English phrase.
 */
const MISSING_VALUE_PLACEHOLDER = Object.freeze({
  'hi-IN': {
    crop: 'फसल (अभी नहीं बताई गई)',
    event: 'नुकसान का कारण (अभी नहीं बताया गया)',
    date: 'तारीख (अभी नहीं बताई गई)',
    area: 'क्षेत्र (अभी नहीं बताया गया)',
    village: 'गाँव (अभी नहीं बताया गया)',
  },
  'te-IN': {
    crop: 'పంట (ఇంకా చెప్పలేదు)',
    event: 'నష్ట కారణం (ఇంకా చెప్పలేదు)',
    date: 'తేదీ (ఇంకా చెప్పలేదు)',
    area: 'విస్తీర్ణం (ఇంకా చెప్పలేదు)',
    village: 'గ్రామం (ఇంకా చెప్పలేదు)',
  },
  'ta-IN': {
    crop: 'பயிர் (இன்னும் கூறப்படவில்லை)',
    event: 'சேதத்தின் காரணம் (இன்னும் கூறப்படவில்லை)',
    date: 'தேதி (இன்னும் கூறப்படவில்லை)',
    area: 'பரப்பளவு (இன்னும் கூறப்படவில்லை)',
    village: 'கிராமம் (இன்னும் கூறப்படவில்லை)',
  },
  'kn-IN': {
    crop: 'ಬೆಳೆ (ಇನ್ನೂ ತಿಳಿಸಿಲ್ಲ)',
    event: 'ಹಾನಿಯ ಕಾರಣ (ಇನ್ನೂ ತಿಳಿಸಿಲ್ಲ)',
    date: 'ದಿನಾಂಕ (ಇನ್ನೂ ತಿಳಿಸಿಲ್ಲ)',
    area: 'ವಿಸ್ತೀರ್ಣ (ಇನ್ನೂ ತಿಳಿಸಿಲ್ಲ)',
    village: 'ಗ್ರಾಮ (ಇನ್ನೂ ತಿಳಿಸಿಲ್ಲ)',
  },
  'ml-IN': {
    crop: 'വിള (ഇതുവരെ പറഞ്ഞിട്ടില്ല)',
    event: 'നാശനഷ്ടത്തിന്റെ കാരണം (ഇതുവരെ പറഞ്ഞിട്ടില്ല)',
    date: 'തീയതി (ഇതുവരെ പറഞ്ഞിട്ടില്ല)',
    area: 'വിസ്തീർണ്ണം (ഇതുവരെ പറഞ്ഞിട്ടില്ല)',
    village: 'ഗ്രാമം (ഇതുവരെ പറഞ്ഞിട്ടില്ല)',
  },
  'en-IN': {
    crop: 'crop (not stated yet)',
    event: 'cause of damage (not stated yet)',
    date: 'date (not stated yet)',
    area: 'area (not stated yet)',
    village: 'village (not stated yet)',
  },
});

/** Extra spoken questions for values the engine could not resolve with confidence. */
const UNCERTAIN_FIELD_PROMPTS = Object.freeze({
  incident_date: {
    'hi-IN':
      'एक बात और ज़रूरी है: आपने "कल" कहा था, जिसका मतलब बीता हुआ दिन भी हो सकता है और आने वाला दिन भी। कृपया नुकसान की सही तारीख बताएं।',
    'te-IN':
      'ఒక ముఖ్యమైన విషయం: మీరు చెప్పిన రోజు స్పష్టంగా తెలియలేదు. నష్టం జరిగిన కచ్చితమైన తేదీని చెప్పండి.',
    'ta-IN':
      'ஒரு முக்கியமான விஷயம்: நீங்கள் கூறிய நாள் தெளிவாக இல்லை. சேதம் ஏற்பட்ட சரியான தேதியைக் கூறவும்.',
    'kn-IN':
      'ಒಂದು ಮುಖ್ಯ ವಿಷಯ: ನೀವು ಹೇಳಿದ ದಿನ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಹಾನಿ ಸಂಭವಿಸಿದ ನಿಖರವಾದ ದಿನಾಂಕವನ್ನು ತಿಳಿಸಿ.',
    'ml-IN':
      'ഒരു പ്രധാന കാര്യം: നിങ്ങൾ പറഞ്ഞ ദിവസം വ്യക്തമല്ല. നാശനഷ്ടം സംഭവിച്ച കൃത്യമായ തീയതി പറയുക.',
    'en-IN':
      'One important point: the day you mentioned was not clear. Please state the exact date on which the damage happened.',
  },
  affected_area: {
    'hi-IN': 'कृपया यह भी बताएं कि नुकसान वाला क्षेत्र आपकी कुल बोई गई ज़मीन से अधिक कैसे है।',
    'te-IN': 'నష్టపోయిన విస్తీర్ణం మీ మొత్తం సాగు భూమి కంటే ఎక్కువగా ఉంది; దయచేసి స్పష్టం చేయండి.',
    'ta-IN': 'சேதமடைந்த பரப்பளவு உங்கள் மொத்த சாகுபடி நிலத்தை விட அதிகமாக உள்ளது; தெளிவுபடுத்தவும்.',
    'kn-IN': 'ಹಾನಿಯಾದ ವಿಸ್ತೀರ್ಣ ನಿಮ್ಮ ಒಟ್ಟು ಸಾಗುವಳಿ ಭೂಮಿಗಿಂತ ಹೆಚ್ಚಾಗಿದೆ; ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟಪಡಿಸಿ.',
    'ml-IN': 'നശിച്ച വിസ്തീർണ്ണം നിങ്ങളുടെ ആകെ കൃഷിഭൂമിയെക്കാൾ കൂടുതലാണ്; വ്യക്തമാക്കുക.',
    'en-IN':
      'Please also clarify how the damaged area is larger than your total cultivated land.',
  },
});

class ReportsService {
  constructor({
    auditService,
    extractionService,
    questionEngine,
    policyService,
    ttsAdapter,
    store = null,
  }) {
    this.auditService = auditService;
    this.extractionService = extractionService;
    this.questionEngine = questionEngine;
    this.policyService = policyService;
    this.ttsAdapter = ttsAdapter;
    this.store = store;

    const persisted = store?.read('reports') || null;
    this.reports = new Map(Object.entries(persisted?.reports || {}));
    this.idempotencyIndex = new Map(Object.entries(persisted?.idempotencyIndex || {}));
    // The sequence counter must survive restarts, otherwise report numbers repeat.
    this.sequenceCounter = persisted?.sequenceCounter ?? 100;
  }

  _persist() {
    if (!this.store) return;
    this.store.write('reports', {
      reports: Object.fromEntries(this.reports),
      idempotencyIndex: Object.fromEntries(this.idempotencyIndex),
      sequenceCounter: this.sequenceCounter,
    });
  }

  /**
   * Confirms the given actor is allowed to see or change this report.
   * A farmer may only touch their own reports; CSC operators and admins may assist.
   */
  assertActorMayAccess(report, { userId, role } = {}) {
    if (role === 'ADMIN' || role === 'CSC_OPERATOR') return true;
    const ownerIds = [report.farmerId, report.farmerProfile?.userId, report.farmerProfile?.id].filter(
      Boolean
    );
    if (userId && ownerIds.includes(userId)) return true;
    const err = new Error('FORBIDDEN_REPORT_ACCESS: This report belongs to another farmer.');
    err.code = 'FORBIDDEN_REPORT_ACCESS';
    err.statusCode = 403;
    throw err;
  }

  /**
   * Creates a new draft report with idempotency protection so offline sync retries never create duplicates.
   */
  createReport({
    idempotencyKey,
    farmerProfile,
    actorId,
    actorRole = 'FARMER',
    createdAtDevice = null,
    initialWorkflowStatus = WorkflowStatus.IN_PROGRESS,
  }) {
    const idemKey = idempotencyKey || crypto.randomUUID();
    if (this.idempotencyIndex.has(idemKey)) {
      return {
        report: this.reports.get(this.idempotencyIndex.get(idemKey)),
        deduplicatedRetry: true,
      };
    }

    this.sequenceCounter += 1;
    const stateCode = String(farmerProfile.state || 'IN')
      .slice(0, 2)
      .toUpperCase();
    const reportNumber = `FA-2026-${stateCode}-${String(this.sequenceCounter).padStart(6, '0')}`;
    const nowIso = new Date().toISOString();

    const extractedValues = {};
    const allTrackedFields = [
      ...CRITICAL_CONFIRMATION_FIELDS,
      'incident_time',
      'cultivated_area',
      ...OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS,
    ];
    for (const f of allTrackedFields) {
      extractedValues[f] = {
        value: f === 'village' && farmerProfile.village ? farmerProfile.village : null,
        unit: null,
        confidence: f === 'village' && farmerProfile.village ? 1.0 : 0,
        source_text: f === 'village' && farmerProfile.village ? 'Farmer onboarding profile' : null,
        status:
          f === 'village' && farmerProfile.village
            ? FieldExtractionStatus.NEEDS_CONFIRMATION
            : FieldExtractionStatus.MISSING,
      };
    }

    const report = {
      id: crypto.randomUUID(),
      idempotencyKey: idemKey,
      reportNumber,
      farmerId: farmerProfile.id,
      farmerProfile: { ...farmerProfile },
      workflowStatus: initialWorkflowStatus,
      submissionStatus: SubmissionStatus.NOT_SUBMITTED,
      incidentCategory: IncidentCategory.LOCALISED_CALAMITY,
      policyVersionId: null,
      readbackCompleted: false,
      farmerVerifiedAt: null,
      createdAtDevice: createdAtDevice || nowIso,
      createdAtServer: nowIso,
      updatedAt: nowIso,
      finalisedAt: null,
      currentRevision: 1,
      extractedValues,
      conversationTurns: [],
      evidenceItems: [],
      submissionRecords: [],
      skippedOptionalFields: [],
    };

    this.reports.set(report.id, report);
    this.idempotencyIndex.set(idemKey, report.id);
    this._persist();

    this.auditService.recordEvent({
      actorId: actorId || farmerProfile.userId || farmerProfile.id,
      actorRole,
      reportId: report.id,
      action: 'REPORT_DRAFT_CREATED',
      newValue: {
        reportNumber: report.reportNumber,
        workflowStatus: report.workflowStatus,
        submissionStatus: report.submissionStatus,
      },
    });

    return { report, deduplicatedRetry: false };
  }

  getReport(reportId) {
    const report = this.reports.get(reportId);
    if (!report) {
      const err = new Error(`REPORT_NOT_FOUND: ${reportId}`);
      err.statusCode = 404;
      throw err;
    }
    return report;
  }

  /**
   * Detects a "don't know / skip for now" answer, and whether the farmer named the field.
   *
   * @returns {{detected: boolean, explicitField: string|null, matched: string|null}}
   */
  _detectSkipIntent(transcript) {
    const text = String(transcript || '');

    // The farmer names the field themselves.
    const EXPLICIT_FIELD_PATTERNS = [
      {
        field: 'survey_number',
        regex:
          /((survey|khasra)\s*(number|no\.?|नंबर)?[^.?!]{0,24}(not available|not have|don'?t know|yaad nahi|याद नहीं|पता नहीं|नहीं है))|((सर्वे|खसरा)\s*(नंबर)?[^।.?!]{0,24}(याद नहीं|पता नहीं|नहीं है|अभी नहीं))|(సర్వే నంబర్[^.?!]{0,24}(తెలియదు|గుర్తు లేదు|లేదు))|(சர்வே எண்[^.?!]{0,24}(தெரியவில்லை|இல்லை))/i,
      },
      {
        field: 'application_number',
        regex:
          /((application|policy|receipt)\s*(number|no\.?|नंबर)?[^.?!]{0,24}(not available|not have|don'?t know|yaad nahi|याद नहीं|पता नहीं|नहीं है))|((आवेदन|पॉलिसी|रसीद)\s*(नंबर)?[^।.?!]{0,24}(याद नहीं|पता नहीं|नहीं है|अभी नहीं))/i,
      },
    ];

    for (const { field, regex } of EXPLICIT_FIELD_PATTERNS) {
      const m = text.match(regex);
      if (m) return { detected: true, explicitField: field, matched: m[0] };
    }

    // A bare "I don't know" — only meaningful against the field that was just asked.
    const BARE_SKIP =
      /(\bskip\b|\bnot available\b|\bdon'?t know\b|\bno idea\b|yaad nahi|pata nahi|याद नहीं|पता नहीं|मालूम नहीं|छोड़ दें|आगे बढ़ें|తెలియదు|గుర్తు లేదు|వదిలేయండి|தெரியவில்லை|தவிர்|ಗೊತ್ತಿಲ್ಲ|ಬಿಟ್ಟುಬಿಡಿ|അറിയില്ല|വിട്ടുകളയുക)/i;
    const bare = text.match(BARE_SKIP);
    if (bare) return { detected: true, explicitField: null, matched: bare[0] };

    return { detected: false, explicitField: null, matched: null };
  }

  /**
   * Validates the report's area fields and flags inconsistencies on the report.
   *
   * Cross-field contradictions (damaged area larger than cultivated area) are marked
   * UNCERTAIN rather than discarded: the figure the farmer gave is kept, but the report
   * cannot be finalised until they clarify it.
   */
  _validateAndFlagArea(report) {
    const affected = report.extractedValues.affected_area;
    const areaValidation = validateLandArea({
      affectedArea: affected?.value,
      cultivatedArea: report.extractedValues.cultivated_area?.value,
      unit: affected?.unit || 'acre',
    });

    if (affected && affected.value !== null && affected.value !== undefined) {
      if (!areaValidation.valid) {
        affected.status = FieldExtractionStatus.UNCERTAIN;
        affected.validationErrors = areaValidation.errors;
      } else {
        delete affected.validationErrors;
        if (affected.status === FieldExtractionStatus.UNCERTAIN) {
          // A previously flagged value is now consistent (e.g. the farmer corrected the
          // cultivated area instead), so it returns to needing plain confirmation.
          affected.status = FieldExtractionStatus.NEEDS_CONFIRMATION;
        }
      }
    }

    return areaValidation;
  }

  /**
   * Processes a spoken or typed farmer turn, extracts structured values, validates constraints,
   * and selects the next relevant dynamic question.
   */
  processConversationTurn({
    reportId,
    actorId,
    speaker = 'FARMER',
    language = 'hi-IN',
    transcript,
    provider = 'gnani-prisma-v3.0',
    providerMode = 'MOCK_DEVELOPMENT',
    providerRequestId = null,
    /** Null means "now"; a fixed value is for deterministic tests and the demo. */
    referenceDateIso = null,
  }) {
    const report = this.getReport(reportId);
    const turn = {
      id: crypto.randomUUID(),
      reportId: report.id,
      turnIndex: report.conversationTurns.length + 1,
      speaker,
      language,
      transcript,
      processingStatus: 'COMPLETED',
      provider,
      providerMode,
      providerRequestId,
      createdAt: new Date().toISOString(),
    };
    report.conversationTurns.push(turn);

    const extractionResult = this.extractionService.extractFields({
      transcript,
      existingFields: report.extractedValues,
      referenceDateIso,
    });

    const newlyExtractedFields = [];
    for (const [field, extractedObj] of Object.entries(extractionResult.extracted)) {
      if (extractedObj && extractedObj.value !== null && extractedObj.value !== undefined) {
        const prev = report.extractedValues[field];
        // Do not overwrite already farmer-confirmed fields unless via explicit correction
        if (!prev || prev.status !== FieldExtractionStatus.CONFIRMED) {
          report.extractedValues[field] = {
            ...extractedObj,
            source_turn_id: turn.id,
          };
          newlyExtractedFields.push(field);
        }
      }
    }

    /**
     * "I don't know" / "skip" is scoped to the field actually being asked.
     *
     * A generic match against the whole transcript previously dropped `survey_number`
     * whenever a farmer said "पता नहीं" or "skip" anywhere — including while answering a
     * completely different question, such as not knowing the exact damaged area. The
     * field is only skipped when it was the one on the table and it is genuinely optional.
     */
    const skipIntent = this._detectSkipIntent(transcript);
    const askedField = report.lastAskedField || null;
    const skippedThisTurn = [];
    if (
      skipIntent.detected &&
      askedField &&
      OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS.includes(askedField) &&
      !report.skippedOptionalFields.includes(askedField)
    ) {
      report.skippedOptionalFields.push(askedField);
      skippedThisTurn.push(askedField);
    } else if (skipIntent.explicitField && !report.skippedOptionalFields.includes(skipIntent.explicitField)) {
      // The farmer named the field themselves ("सर्वे नंबर याद नहीं"), so it is
      // unambiguous even when a different question was asked.
      report.skippedOptionalFields.push(skipIntent.explicitField);
      skippedThisTurn.push(skipIntent.explicitField);
    }

    // Validate area consistency
    const areaValidation = this._validateAndFlagArea(report);

    const nextQuestion = this.questionEngine.selectNextQuestion({
      fields: report.extractedValues,
      languageCode: language,
      skippedFields: report.skippedOptionalFields,
    });

    // Remember what was asked so the next turn can interpret a bare "I don't know".
    report.lastAskedField = nextQuestion.nextFieldToAsk || null;

    if (nextQuestion.canPreparePartialDraft && report.workflowStatus === WorkflowStatus.IN_PROGRESS) {
      report.workflowStatus = transitionWorkflowStatus(report.workflowStatus, WorkflowStatus.NEEDS_REVIEW);
    }

    report.updatedAt = new Date().toISOString();
    this._persist();

    return {
      turn,
      newlyExtractedFields,
      skippedOptionalFields: skippedThisTurn,
      areaValidation,
      nextQuestion,
      reportSnapshot: report,
    };
  }

  /**
   * Records a farmer correction (spoken or manual) and writes an immutable AuditEvent.
   */
  correctField({
    reportId,
    actorId,
    actorRole = 'FARMER',
    fieldName,
    newValue,
    unit = null,
    sourceText = 'Farmer explicit correction',
    reason = 'Farmer corrected value during review/readback',
  }) {
    const report = this.getReport(reportId);
    const previous = report.extractedValues[fieldName] ? { ...report.extractedValues[fieldName] } : null;

    /**
     * A correction is validated like any other input.
     *
     * Previously an explicit correction was written straight through with
     * `status: CORRECTED` and `confidence: 1.0`, bypassing the area checks applied during
     * extraction — so a farmer could correct the damaged area to a negative number, or to
     * more than their total cultivated land, and that contradiction would be stamped as
     * farmer-confirmed and carried into the finalised draft.
     */
    if (fieldName === 'affected_area' || fieldName === 'cultivated_area') {
      const candidate = Number(newValue);
      const candidateUnit = unit || previous?.unit || 'acre';
      const selfCheck = validateLandArea({
        affectedArea: fieldName === 'affected_area' ? candidate : undefined,
        cultivatedArea: fieldName === 'cultivated_area' ? candidate : undefined,
        unit: candidateUnit,
      });

      // Values that cannot be right under any circumstances are rejected outright, so the
      // farmer is asked again rather than having nonsense stored as confirmed.
      const hardErrors = selfCheck.errors.filter((e) =>
        ['INVALID_AFFECTED_AREA', 'INVALID_CULTIVATED_AREA', 'UNSUPPORTED_AREA_UNIT'].includes(e.code)
      );
      if (hardErrors.length > 0) {
        const err = new Error(
          `INVALID_CORRECTION: ${hardErrors.map((e) => e.message).join(' ')}`
        );
        err.code = 'INVALID_CORRECTION';
        err.statusCode = 400;
        err.validationErrors = hardErrors;
        throw err;
      }
    }

    report.extractedValues[fieldName] = {
      value: newValue,
      unit: unit || (previous ? previous.unit : null),
      confidence: 1.0,
      source_text: sourceText,
      status: FieldExtractionStatus.CORRECTED,
      confirmedAt: new Date().toISOString(),
    };

    // Re-check cross-field consistency after the correction lands. An inconsistent pair
    // is flagged UNCERTAIN, which blocks finalisation until the farmer clarifies it.
    let areaValidation = null;
    if (fieldName === 'affected_area' || fieldName === 'cultivated_area') {
      areaValidation = this._validateAndFlagArea(report);
    }

    report.currentRevision += 1;
    report.updatedAt = new Date().toISOString();
    this._persist();

    const auditEvent = this.auditService.recordEvent({
      actorId,
      actorRole,
      reportId: report.id,
      action: 'FARMER_FIELD_CORRECTION',
      fieldName,
      previousValue: previous,
      newValue: report.extractedValues[fieldName],
      reason,
    });

    return {
      updatedField: report.extractedValues[fieldName],
      currentRevision: report.currentRevision,
      areaValidation,
      /** True when the correction left a contradiction the farmer must still resolve. */
      requiresClarification:
        report.extractedValues[fieldName].status === FieldExtractionStatus.UNCERTAIN,
      auditEvent,
    };
  }

  /**
   * Generates the localized critical-field readback script and synthesizes speech via Gnani Timbre TTS.
   */
  async generateVoiceReadback({ reportId, languageCode = 'hi-IN' }) {
    const report = this.getReport(reportId);
    const ev = report.extractedValues;

    const lang = SUPPORTED_READBACK_LANGUAGES.includes(languageCode) ? languageCode : 'en-IN';

    /**
     * Canonical values are spoken in the farmer's own language. Extraction stores
     * language-neutral keys (`paddy`, `hailstorm`, `STANDING`) for deterministic policy
     * matching, but reading those English keys aloud inside a Hindi or Tamil sentence
     * defeats the one check the farmer gets before the draft is finalised.
     */
    const missing = MISSING_VALUE_PLACEHOLDER[lang];
    const crop = cropLabel(ev.crop?.value, lang) || missing.crop;
    const event = lossEventLabel(ev.loss_event?.value, lang) || missing.event;
    const date = spokenDate(ev.incident_date?.value, lang) || missing.date;
    const stage = cropStageLabel(ev.crop_stage?.value || CropStage.STANDING, lang);
    const village = ev.village?.value || report.farmerProfile.village || missing.village;
    const area = ev.affected_area?.value
      ? `${ev.affected_area.value} ${areaUnitLabel(ev.affected_area.unit || 'acre', lang)}`
      : missing.area;

    const readbackTextByLang = {
      'hi-IN': `कृपया ध्यान से सुनें और पुष्टि करें: गाँव ${village} में आपकी ${crop} की फसल (${stage}) को तारीख ${date} को ${event} के कारण लगभग ${area} भूमि में नुकसान हुआ है। क्या यह जानकारी बिल्कुल सही है?`,
      'te-IN': `దయచేసి విని నిర్ధారించండి: ${village} గ్రామంలో మీ ${crop} పంటకు ${date} తేదీన ${event} వల్ల సుమారు ${area} విస్తీర్ణంలో నష్టం జరిగింది. ఈ సమాచారం సరైనదేనా?`,
      'ta-IN': `தயவுசெய்து கவனித்துக் கேட்டு உறுதிப்படுத்தவும்: கிராமம் ${village}-ல் உங்கள் ${crop} பயிருக்கு (${stage}) ${date} அன்று ${event} காரணமாக சுமார் ${area} நிலத்தில் சேதம் ஏற்பட்டுள்ளது. இந்த தகவல் சரியானதா?`,
      'kn-IN': `ದಯವಿಟ್ಟು ಗಮನವಿಟ್ಟು ಕೇಳಿ ಮತ್ತು ದೃಢೀಕರಿಸಿ: ${village} ಗ್ರಾಮದಲ್ಲಿ ನಿಮ್ಮ ${crop} ಬೆಳೆಗೆ (${stage}) ${date} ರಂದು ${event} ಕಾರಣದಿಂದ ಸುಮಾರು ${area} ಜಮೀನಿನಲ್ಲಿ ಹಾನಿಯಾಗಿದೆ. ಈ ಮಾಹಿತಿ ಸರಿಯಾಗಿದೆಯೇ?`,
      'ml-IN': `ദയവായി ശ്രദ്ധിച്ചു കേട്ട് സ്ഥിരീകരിക്കുക: ${village} ഗ്രാമത്തിൽ നിങ്ങളുടെ ${crop} വിളയ്ക്ക് (${stage}) ${date}-ൽ ${event} കാരണം ഏകദേശം ${area} സ്ഥലത്ത് നാശനഷ്ടം സംഭവിച്ചു. ഈ വിവരങ്ങൾ ശരിയാണോ?`,
      'en-IN': `Please listen and confirm: In village ${village}, your ${crop} crop (${stage}) suffered ${event} damage on ${date} across approximately ${area}. Is this information correct?`,
    };

    let readbackText = readbackTextByLang[lang] || readbackTextByLang['en-IN'];

    /**
     * Any value the engine is unsure about gets its own explicit question appended, so an
     * ambiguous date (such as the Hindi "कल", which means both yesterday and tomorrow) is
     * resolved by the farmer instead of being quietly accepted.
     */
    const uncertainFields = CRITICAL_CONFIRMATION_FIELDS.filter(
      (f) => ev[f]?.status === FieldExtractionStatus.UNCERTAIN
    );
    const clarifications = uncertainFields
      .map((f) => UNCERTAIN_FIELD_PROMPTS[f]?.[lang] || UNCERTAIN_FIELD_PROMPTS[f]?.['en-IN'])
      .filter(Boolean);
    if (clarifications.length > 0) {
      readbackText = `${readbackText} ${clarifications.join(' ')}`;
    }

    const ttsResult = await this.ttsAdapter.synthesizeSpeech({
      text: readbackText,
      languageCode: lang,
    });

    return {
      readbackText,
      languageCode: lang,
      criticalFieldsReadBack: CRITICAL_CONFIRMATION_FIELDS.map((f) => ({
        field: f,
        value: ev[f]?.value ?? null,
        unit: ev[f]?.unit ?? null,
        status: ev[f]?.status ?? 'missing',
        /** What the farmer actually heard for this field. */
        spokenAs:
          f === 'crop'
            ? cropLabel(ev[f]?.value, lang)
            : f === 'loss_event'
            ? lossEventLabel(ev[f]?.value, lang)
            : f === 'crop_stage'
            ? cropStageLabel(ev[f]?.value, lang)
            : f === 'incident_date'
            ? spokenDate(ev[f]?.value, lang)
            : ev[f]?.value ?? null,
      })),
      /** Fields the farmer must explicitly resolve before finalisation is allowed. */
      requiresClarification: uncertainFields,
      ttsResult,
    };
  }

  /**
   * Confirms critical fields after voice readback and transitions to READY_FOR_EXPORT.
   */
  confirmAfterReadback({ reportId, actorId, actorRole = 'FARMER' }) {
    const report = this.getReport(reportId);
    const nowIso = new Date().toISOString();

    /**
     * Pre-condition check BEFORE any mutation.
     *
     * Previously the critical fields were stamped CONFIRMED and `readbackCompleted` was
     * set first, and only then was readiness verified — so a failed check left the report
     * permanently half-confirmed: marked as read back to the farmer when it had not been,
     * which would let a later call finalise unverified values.
     */
    const missingValues = CRITICAL_CONFIRMATION_FIELDS.filter((field) => {
      const entry = report.extractedValues[field];
      return !entry || entry.value === null || entry.value === undefined || entry.value === '';
    });

    const unresolvedUncertain = CRITICAL_CONFIRMATION_FIELDS.filter(
      (field) => report.extractedValues[field]?.status === FieldExtractionStatus.UNCERTAIN
    );

    if (missingValues.length > 0) {
      const err = new Error(
        `UNCONFIRMED_CRITICAL_FIELDS: The following critical fields require farmer confirmation: ${missingValues.join(', ')}`
      );
      err.code = 'FINALISATION_PRECONDITION_FAILED';
      err.statusCode = 400;
      err.missingCriticalFields = missingValues;
      throw err;
    }

    if (unresolvedUncertain.length > 0) {
      // An ambiguous value (e.g. the date behind an ambiguous "कल") must be explicitly
      // corrected or re-stated, not silently promoted to confirmed.
      const err = new Error(
        `UNCERTAIN_CRITICAL_FIELDS: These values are uncertain and must be clarified with the farmer before finalisation: ${unresolvedUncertain.join(', ')}`
      );
      err.code = 'UNCERTAIN_CRITICAL_FIELDS';
      err.statusCode = 400;
      err.uncertainCriticalFields = unresolvedUncertain;
      throw err;
    }

    // Snapshot so an unexpected failure below cannot leave a partially confirmed report.
    const snapshot = {
      extractedValues: JSON.parse(JSON.stringify(report.extractedValues)),
      readbackCompleted: report.readbackCompleted,
      farmerVerifiedAt: report.farmerVerifiedAt,
      workflowStatus: report.workflowStatus,
      finalisedAt: report.finalisedAt,
      updatedAt: report.updatedAt,
    };

    try {
      for (const field of CRITICAL_CONFIRMATION_FIELDS) {
        const entry = report.extractedValues[field];
        if (entry && entry.value !== null && entry.value !== undefined) {
          if (entry.status !== FieldExtractionStatus.CORRECTED) {
            entry.status = FieldExtractionStatus.CONFIRMED;
          }
          entry.confirmedAt = nowIso;
        }
      }

      report.readbackCompleted = true;
      report.farmerVerifiedAt = nowIso;

      const check = verifyCriticalFieldsForFinalisation(report);
      if (!check.ready) {
        const err = new Error(check.reason);
        err.code = 'FINALISATION_PRECONDITION_FAILED';
        err.statusCode = 400;
        throw err;
      }

      if (report.workflowStatus !== WorkflowStatus.READY_FOR_EXPORT) {
        report.workflowStatus = transitionWorkflowStatus(
          report.workflowStatus === WorkflowStatus.DRAFT_LOCAL
            ? WorkflowStatus.IN_PROGRESS
            : report.workflowStatus,
          WorkflowStatus.READY_FOR_EXPORT
        );
      }
      report.finalisedAt = nowIso;
      report.updatedAt = nowIso;
    } catch (err) {
      Object.assign(report, snapshot);
      this._persist();
      throw err;
    }

    this._persist();

    // Attach verified policy & deadline evaluation. The season is derived from the
    // incident date rather than assumed to be Kharif.
    const policyEval = this.policyService.evaluateDeadlineAndGuidance({
      state: report.farmerProfile.state,
      district: report.farmerProfile.district,
      crop: report.extractedValues.crop?.value,
      lossEvent: report.extractedValues.loss_event?.value,
      cropStage: report.extractedValues.crop_stage?.value,
      incidentDateIso: report.extractedValues.incident_date?.value,
      referenceNowIso: nowIso,
    });
    report.policyVersionId = policyEval.policyVersionId;
    report.policyEvaluation = policyEval;

    this.auditService.recordEvent({
      actorId,
      actorRole,
      reportId: report.id,
      action: 'CRITICAL_FIELDS_READBACK_CONFIRMED_AND_FINALISED',
      newValue: {
        workflowStatus: report.workflowStatus,
        submissionStatus: report.submissionStatus,
        policyVersionId: report.policyVersionId,
      },
    });

    return report;
  }

  /**
   * Records a farmer-entered official submission reference (e.g. Helpline 14447 ticket number).
   * Explicitly labels the entry as farmer-reported, never OFFICIALLY_VERIFIED.
   */
  recordOfficialSubmissionReference({
    reportId,
    actorId,
    submissionChannel,
    officialReferenceNumber,
    submissionDateIso = new Date().toISOString(),
    acknowledgementFileId = null,
  }) {
    const report = this.getReport(reportId);

    const newSubmissionStatus = officialReferenceNumber
      ? SubmissionStatus.ACKNOWLEDGEMENT_ENTERED
      : SubmissionStatus.FARMER_REPORTED_SUBMITTED;

    report.submissionStatus = transitionSubmissionStatus(
      report.submissionStatus,
      newSubmissionStatus,
      { isAuthorisedGovernmentIntegration: false }
    );

    const record = {
      id: crypto.randomUUID(),
      reportId: report.id,
      submissionChannel,
      farmerReportedSubmissionDate: submissionDateIso,
      officialReferenceNumber: officialReferenceNumber || null,
      acknowledgementFileId,
      verificationStatus: 'FARMER_REPORTED_NOT_GOVERNMENT_VERIFIED',
      createdAt: new Date().toISOString(),
    };

    report.submissionRecords.push(record);
    report.updatedAt = new Date().toISOString();
    this._persist();

    this.auditService.recordEvent({
      actorId,
      reportId: report.id,
      action: 'OFFICIAL_SUBMISSION_REFERENCE_RECORDED',
      newValue: record,
    });

    return {
      submissionRecord: record,
      submissionStatus: report.submissionStatus,
      transparencyNotice:
        'Recorded as Farmer-Reported. Kisan Sarathi has not independently verified this reference number with government servers.',
    };
  }

  getMissingFieldsChecklist(reportId) {
    const report = this.getReport(reportId);
    const criticalMissing = [];
    const optionalMissing = [];

    for (const f of CRITICAL_CONFIRMATION_FIELDS) {
      if (!report.extractedValues[f] || report.extractedValues[f].value === null) {
        criticalMissing.push(f);
      }
    }
    for (const f of OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS) {
      if (!report.extractedValues[f] || report.extractedValues[f].value === null) {
        optionalMissing.push({
          field: f,
          guidance:
            'Optional during initial 72-hour intake; keep ready when speaking to official channel or during the 7-day completion follow-up.',
        });
      }
    }

    return {
      reportId: report.id,
      criticalMissing,
      optionalSevenDayCompletable: optionalMissing,
      readyForInitialDraft: criticalMissing.length === 0,
    };
  }

  deleteReport({ reportId, actorId }) {
    const report = this.getReport(reportId);
    this.reports.delete(reportId);
    this.idempotencyIndex.delete(report.idempotencyKey);
    this._persist();
    this.auditService.recordEvent({
      actorId,
      reportId,
      action: 'REPORT_DELETED_BY_USER',
      previousValue: { reportNumber: report.reportNumber },
    });
    return { deleted: true, reportId };
  }
}

module.exports = { ReportsService };
