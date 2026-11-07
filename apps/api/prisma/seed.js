/**
 * Synthetic Demonstration Seed Script (Section 22 & Section 29)
 * Explicitly labels all demo records as SYNTHETIC_DEMO_DATA.
 */
const { createAppContainer } = require('../src/main.js');
const { ConsentType, AssistedMode } = require('../../../packages/shared-types/src/index.js');

async function runSeed() {
  // The synthetic demonstration always starts from a clean, isolated state: it must never
  // read or write the real persisted farmer data, and re-running it must not collide with
  // its own previous run's finalised report.
  const app = createAppContainer({
    ...process.env,
    PERSISTENCE: 'memory',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'demo_only_access_secret_not_for_production',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET || 'demo_only_refresh_secret_not_for_production',
  });

  const demoFarmer = {
    id: 'demo-farmer-ramesh-001',
    userId: 'demo-user-ramesh-001',
    farmerName: 'Ramesh Kumar (SYNTHETIC DEMO FARMER)',
    mobileNumber: '9876543210',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    village: 'Peddapalli',
    preferredLanguage: 'hi-IN',
    assistedMode: AssistedMode.SELF,
    isSyntheticDemoData: true,
  };

  // Grant required consents
  app.consentService.grantConsent({
    userId: demoFarmer.userId,
    consentType: ConsentType.AUDIO_RECORDING,
  });
  app.consentService.grantConsent({
    userId: demoFarmer.userId,
    consentType: ConsentType.GNANI_CLOUD_VOICE_PROCESSING,
  });
  app.consentService.grantConsent({
    userId: demoFarmer.userId,
    consentType: ConsentType.PERSONAL_DATA_STORAGE,
  });

  // Create draft report
  const { report } = app.reportsService.createReport({
    idempotencyKey: 'demo-seed-idem-key-001',
    farmerProfile: demoFarmer,
    actorId: demoFarmer.userId,
    createdAtDevice: '2026-11-04T05:45:12+05:30',
  });

  // Turn 1: Farmer speaks about paddy hailstorm damage
  app.reportsService.processConversationTurn({
    reportId: report.id,
    actorId: demoFarmer.userId,
    language: 'hi-IN',
    transcript: 'मेरी धान की खड़ी फसल कल शाम ओलावृष्टि और भारी बारिश से 3 एकड़ खराब हो गई',
    referenceDateIso: '2026-11-04T06:00:00+05:30',
  });

  // Turn 2: Farmer clarifies insured status and notes survey number is not currently handy
  app.reportsService.processConversationTurn({
    reportId: report.id,
    actorId: demoFarmer.userId,
    language: 'hi-IN',
    transcript: 'फसल बीमा करवाया है, लेकिन सर्वे नंबर अभी याद नहीं है',
    referenceDateIso: '2026-11-04T06:00:00+05:30',
  });

  // Farmer hears readback and corrects 3 acres -> 2 acres
  await app.reportsService.generateVoiceReadback({
    reportId: report.id,
    languageCode: 'hi-IN',
  });

  app.reportsService.correctField({
    reportId: report.id,
    actorId: demoFarmer.userId,
    fieldName: 'affected_area',
    newValue: 2,
    unit: 'acre',
    sourceText: 'तीन एकड़ नहीं, दो एकड़ नुकसान हुआ है (Corrected from 3 acres to 2 acres)',
  });

  // The farmer said "कल शाम", and "कल" means both yesterday and tomorrow in Hindi, so the
  // engine flags the date as uncertain rather than guessing. The readback asks the farmer
  // to state the exact date, which they confirm here as 3 November 2026.
  app.reportsService.correctField({
    reportId: report.id,
    actorId: demoFarmer.userId,
    fieldName: 'incident_date',
    newValue: '2026-11-03',
    sourceText: 'हाँ, कल यानी 3 नवंबर की शाम को नुकसान हुआ (Ambiguous "कल" confirmed as 3 November 2026)',
    reason: 'Farmer resolved ambiguous relative day reference during voice readback',
  });

  // Confirm after readback
  app.reportsService.confirmAfterReadback({
    reportId: report.id,
    actorId: demoFarmer.userId,
  });

  // Generate draft document
  const doc = app.reportGenerator.generateDraftDocuments({
    report,
    actorId: demoFarmer.userId,
  });

  // Record separate farmer-reported official reference
  const sub = app.reportsService.recordOfficialSubmissionReference({
    reportId: report.id,
    actorId: demoFarmer.userId,
    submissionChannel: 'Krishi Rakshak Helpline 14447',
    officialReferenceNumber: 'KRPH-2026-14447-88921-DEMO',
  });

  return {
    syntheticLabel: 'SYNTHETIC_DEMONSTRATION_DATASET',
    farmer: demoFarmer,
    report,
    generatedDocument: doc,
    officialSubmissionRecord: sub,
    auditTrail: app.auditService.getReportAuditTrail(report.id),
  };
}

if (require.main === module) {
  runSeed().then((res) => {
    console.log('Seeded synthetic demonstration journey:', res.report.reportNumber);
  });
}

module.exports = { runSeed };
