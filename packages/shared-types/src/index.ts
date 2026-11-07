/**
 * @fasal-awaaz/shared-types
 * Canonical enums, workflow statuses, language definitions, and domain constants.
 */

const UserRole = Object.freeze({
  FARMER: 'FARMER',
  FAMILY_HELPER: 'FAMILY_HELPER',
  CSC_OPERATOR: 'CSC_OPERATOR',
  ADMIN: 'ADMIN',
});

const AssistedMode = Object.freeze({
  SELF: 'SELF',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
  CSC_OPERATOR: 'CSC_OPERATOR',
});

const WorkflowStatus = Object.freeze({
  DRAFT_LOCAL: 'DRAFT_LOCAL',
  SYNC_PENDING: 'SYNC_PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  READY_FOR_EXPORT: 'READY_FOR_EXPORT',
  EXPORTED: 'EXPORTED',
  COMPLETION_PENDING: 'COMPLETION_PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const SubmissionStatus = Object.freeze({
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  FARMER_REPORTED_SUBMITTED: 'FARMER_REPORTED_SUBMITTED',
  ACKNOWLEDGEMENT_ENTERED: 'ACKNOWLEDGEMENT_ENTERED',
  OFFICIALLY_VERIFIED: 'OFFICIALLY_VERIFIED',
});

const IncidentCategory = Object.freeze({
  LOCALISED_CALAMITY: 'LOCALISED_CALAMITY',
  POST_HARVEST_LOSS: 'POST_HARVEST_LOSS',
  OTHER_UNCLASSIFIED: 'OTHER_UNCLASSIFIED',
});

const CropStage = Object.freeze({
  STANDING: 'STANDING',
  HARVESTED_IN_FIELD_DRYING: 'HARVESTED_IN_FIELD_DRYING',
  HARVESTED_STORED: 'HARVESTED_STORED',
  OTHER_MANUAL_CLARIFICATION: 'OTHER_MANUAL_CLARIFICATION',
});

const TimePrecision = Object.freeze({
  EXACT: 'EXACT',
  APPROXIMATE: 'APPROXIMATE',
  UNKNOWN: 'UNKNOWN',
});

const AreaUnit = Object.freeze({
  ACRE: 'acre',
  HECTARE: 'hectare',
  BIGHA: 'bigha',
  GUNTHA: 'guntha',
});

const FieldExtractionStatus = Object.freeze({
  NEEDS_CONFIRMATION: 'needs_confirmation',
  CONFIRMED: 'confirmed',
  CORRECTED: 'corrected',
  MISSING: 'missing',
  APPROXIMATE: 'approximate',
  UNCERTAIN: 'uncertain',
});

const ConsentType = Object.freeze({
  AUDIO_RECORDING: 'AUDIO_RECORDING',
  GNANI_CLOUD_VOICE_PROCESSING: 'GNANI_CLOUD_VOICE_PROCESSING',
  PERSONAL_DATA_STORAGE: 'PERSONAL_DATA_STORAGE',
  GPS_LOCATION_CAPTURE: 'GPS_LOCATION_CAPTURE',
  PHOTO_EVIDENCE_UPLOAD: 'PHOTO_EVIDENCE_UPLOAD',
});

const CRITICAL_CONFIRMATION_FIELDS = Object.freeze([
  'crop',
  'loss_event',
  'incident_date',
  'crop_stage',
  'affected_area',
  'village',
]);

const OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS = Object.freeze([
  'survey_number',
  'application_number',
  'evidence_photographs',
  'gps_coordinates',
]);

const VERIFIED_LANGUAGES = Object.freeze([
  {
    code: 'hi-IN',
    nameEnglish: 'Hindi',
    nameNative: 'हिन्दी',
    script: 'Devanagari',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Nalini',
    fallbackVoiceV3: 'Shivani',
    voiceWorkflowTested: true,
    active: true,
  },
  {
    code: 'te-IN',
    nameEnglish: 'Telugu',
    nameNative: 'తెలుగు',
    script: 'Telugu',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Kaveri',
    fallbackVoiceV3: 'Lakshmi',
    voiceWorkflowTested: true,
    active: true,
  },
  {
    code: 'ta-IN',
    nameEnglish: 'Tamil',
    nameNative: 'தமிழ்',
    script: 'Tamil',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Kaveri',
    fallbackVoiceV3: 'Lakshmi',
    voiceWorkflowTested: true,
    active: true,
  },
  {
    code: 'kn-IN',
    nameEnglish: 'Kannada',
    nameNative: 'ಕನ್ನಡ',
    script: 'Kannada',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Pranav',
    fallbackVoiceV3: 'Avinash',
    voiceWorkflowTested: true,
    active: true,
  },
  {
    code: 'ml-IN',
    nameEnglish: 'Malayalam',
    nameNative: 'മലയാളം',
    script: 'Malayalam',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Nalini',
    fallbackVoiceV3: 'Vasudha',
    voiceWorkflowTested: true,
    active: true,
  },
  {
    code: 'en-IN',
    nameEnglish: 'English (India)',
    nameNative: 'English',
    script: 'Latin',
    gnaniSttModel: 'prisma-v3.0',
    gnaniTtsModel: 'timbre-v2.5',
    defaultVoice: 'Deepak',
    fallbackVoiceV3: 'Avinash',
    voiceWorkflowTested: true,
    active: true,
  },
]);

const MANDATORY_DRAFT_DISCLAIMER =
  'This document is a farmer-prepared information summary. It is not an official claim submission, official acknowledgement, eligibility determination or guarantee of compensation.';

const MANDATORY_DRAFT_WATERMARK = 'DRAFT – NOT OFFICIALLY SUBMITTED';

module.exports = {
  UserRole,
  AssistedMode,
  WorkflowStatus,
  SubmissionStatus,
  IncidentCategory,
  CropStage,
  TimePrecision,
  AreaUnit,
  FieldExtractionStatus,
  ConsentType,
  CRITICAL_CONFIRMATION_FIELDS,
  OPTIONAL_SEVEN_DAY_COMPLETABLE_FIELDS,
  VERIFIED_LANGUAGES,
  MANDATORY_DRAFT_DISCLAIMER,
  MANDATORY_DRAFT_WATERMARK,
};

export {};
