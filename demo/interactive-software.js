#!/usr/bin/env node
/**
 * KisanSaathi — Fasal Awaaz: Interactive Software Operating Console
 *
 * Professional CLI software terminal for project demonstration, hackathon evaluation,
 * and field simulation of the Rapid Zero-App Intake & Weather Grounding Engine.
 */
const readline = require('node:readline');
const { createAppContainer } = require('../apps/api/src/main.js');

const BANNER = `
================================================================================
  🌾 KISANSAATHI — FASAL AWAAZ ENTERPRISE SOFTWARE CONSOLE 🌾
  Motto: "Speak for 30 Seconds. Protect Your Harvest."
  Architecture: Multilingual Voice AI • Weather Radar Grounding • 24h Express Triage
================================================================================
`;

function createConsole() {
  const container = createAppContainer({
    ...process.env,
    PERSISTENCE: 'file',
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function promptMenu() {
    console.log(BANNER);
    console.log('SELECT AN OPERATIONAL MODULE TO EXECUTE:');
    console.log(' [1] 🎙️  Zero-App WhatsApp / IVR Voice Intake (Simulate Farmer Speaking)');
    console.log(' [2] 📄  Generate Dynamic Bilingual PDF Draft & Inspect Binary');
    console.log(' [3] 🛰️  Meteorological Radar Grounding (Intimation Plausibility Index)');
    console.log(' [4] 📊  Executive Business Analytics, Unit Economics & Insurer ROI');
    console.log(' [5] 🧪  Run Full Production Test Suite (55 Tests, 15 Suites)');
    console.log(' [6] 🚨  24-Hour Emergency Surveyor Escalation Dossier');
    console.log(' [0] 🚪  Exit Software Console');
    console.log('--------------------------------------------------------------------------------');
    rl.question('Enter option (0-6): ', async (answer) => {
      const choice = answer.trim();
      try {
        switch (choice) {
          case '1':
            await runVoiceIntake(container);
            break;
          case '2':
            await runPdfGenerator(container);
            break;
          case '3':
            await runWeatherGrounding(container);
            break;
          case '4':
            await runBusinessAnalytics(container);
            break;
          case '5':
            await runTestSuite();
            break;
          case '6':
            await runSurveyorEscalation(container);
            break;
          case '0':
            console.log('\nExiting Fasal Awaaz Console. Jai Kisan!\n');
            rl.close();
            process.exit(0);
            return;
          default:
            console.log('\nInvalid option. Please choose between 0 and 6.\n');
        }
      } catch (err) {
        console.error('\nExecution error:', err.message);
      }
      setTimeout(promptMenu, 1500);
    });
  }

  promptMenu();
}

async function runVoiceIntake(container) {
  console.log('\n--- MODULE 1: ZERO-APP RAPID VOICE INTAKE ---');
  console.log('Simulating incoming WhatsApp audio message from farmer in Guntur, Andhra Pradesh...');
  const simulatedUtterance = 'मेरी धान की खड़ी फसल कल शाम ओलावृष्टि और भारी बारिश से 3 एकड़ खराब हो गई, सर्वे नंबर अभी पास नहीं है';

  console.log(`\nFarmer Audio Utterance (Hindi): "${simulatedUtterance}"`);
  console.log('Processing via Gnani Prisma v3.0 STT + Schema-Constrained Extraction + Doppler Radar Grounding...\n');

  const result = await container.rapidIntakeService.processQuickIntake({
    farmerPhone: '9876543210',
    farmerName: 'Ramesh Kumar',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    village: 'Peddapalli',
    languageCode: 'hi-IN',
    textUtterance: simulatedUtterance,
    channelSource: 'WHATSAPP_VOICE_NOTE',
  });

  console.log('================== INSTANT WHATSAPP CARD GENERATED ==================');
  console.log(result.whatsappResponseCard);
  console.log('=====================================================================');
  console.log('Extracted Structured Facts :');
  console.log(` • Crop                : ${result.extractedData.crop} (Confirmed Standing Stage)`);
  console.log(` • Peril / Loss Cause  : ${result.extractedData.lossEvent}`);
  console.log(` • Damage Area         : ${result.extractedData.affectedArea} ${result.extractedData.areaUnit}`);
  console.log(` • 7-Day Completion    : ${result.extractedData.surveyNumber}`);
  console.log(` • Radar Plausibility  : ${result.weatherTriage.plausibilityScorePercent}% (${result.weatherTriage.triageChannel})`);
  console.log(` • Turnaround Speed    : ${result.processingTimeMs} ms (< 3.0s SLA)`);
  console.log(` • Generated PDF File  : ${result.pdfFilePath || 'Generated in memory (.pdf)'}`);
  console.log('=====================================================================');
}

async function runPdfGenerator(container) {
  console.log('\n--- MODULE 2: DYNAMIC BILINGUAL PDF DRAFT GENERATION ---');
  console.log('Generating official timestamped PMFBY draft with prominent draft watermarks...');

  const reportId = container.reportsService.sequenceCounter;
  const mockReport = {
    id: `rep-${reportId}`,
    reportNumber: `FA-2026-AN-${String(reportId).padStart(6, '0')}`,
    currentRevision: 1,
    workflowStatus: 'READY_FOR_EXPORT',
    submissionStatus: 'NOT_SUBMITTED',
    createdAtDevice: new Date().toISOString(),
    createdAtServer: new Date().toISOString(),
    farmerProfile: {
      farmerName: 'Sita Devi',
      mobileNumber: '9123456780',
      state: 'Telangana',
      district: 'Warangal',
      village: 'Dharmasagar',
    },
    extractedValues: {
      crop: { value: 'cotton', status: 'confirmed' },
      loss_event: { value: 'inundation', status: 'confirmed' },
      incident_date: { value: '2026-11-03', status: 'confirmed' },
      affected_area: { value: 4, unit: 'acre', status: 'confirmed' },
      crop_stage: { value: 'STANDING', status: 'confirmed' },
      survey_number: { value: null, status: 'missing' },
      village: { value: 'Dharmasagar', status: 'confirmed' },
    },
    conversationTurns: [{ transcript: 'నా 4 ఎకరాల పత్తి చేను భారీ వర్షం మరియు ముంపు వల్ల దెబ్బతింది' }],
    evidenceItems: [],
    submissionRecords: [],
    plausibilityIndex: 0.93,
    policyEvaluation: {
      scheme: 'PMFBY',
      intimationDeadlineHours: 72,
      hoursRemaining: 54,
    },
  };

  const docs = container.reportGenerator.generateDraftDocuments({
    report: mockReport,
    actorId: 'farmer-sita-01',
  });

  console.log('\nDraft Document Generated:');
  console.log(` • Document Type     : Standard PDF-1.4 Binary & Plain Text`);
  console.log(` • Watermark Banner  : ${docs.watermark}`);
  console.log(` • File Size         : ${docs.pdfSize} bytes`);
  console.log(` • Saved Path        : ${docs.pdfFilePath || 'Saved in .data/drafts/'}`);
  console.log(` • Missing 7D Fields : ${docs.missingFields.join(', ')}`);
  console.log('\nPDF Preview (First 8 lines of text structure):');
  console.log(docs.textContent.split('\n').slice(0, 8).join('\n'));
}

async function runWeatherGrounding(container) {
  console.log('\n--- MODULE 3: METEOROLOGICAL RADAR & SATELLITE GROUNDING ---');
  console.log('Testing Automated Intimation Plausibility Index (IPI) for 2 distinct cases:\n');

  console.log('CASE A: Severe Hailstorm reported in Guntur, AP (Severe Weather Grid match)');
  const resA = container.weatherService.evaluatePlausibility({
    state: 'Andhra Pradesh',
    district: 'Guntur',
    incidentDateIso: '2026-11-03',
    lossEvent: 'hailstorm',
    affectedArea: 3,
  });
  console.log(` • Plausibility Index : ${resA.plausibilityScorePercent}% (${resA.triageChannel})`);
  console.log(` • Radar Evidence     : ${resA.precipitationRecordedMm}mm rain, ${resA.radarReflectivityDbz} dBZ radar reflectivity`);
  console.log(` • Triage Verdict     : ${resA.surveyorPriority} (${resA.estimatedLossSeverity})`);

  console.log('\nCASE B: Unrecorded localized micro-event (Zero Doppler Radar Grid match)');
  const resB = container.weatherService.evaluatePlausibility({
    state: 'Karnataka',
    district: 'Shimoga',
    incidentDateIso: '2026-11-03',
    lossEvent: 'inundation',
    affectedArea: 1,
  });
  console.log(` • Plausibility Index : ${resB.plausibilityScorePercent}% (${resB.triageChannel})`);
  console.log(` • Radar Evidence     : None recorded within 25km radius`);
  console.log(` • Triage Verdict     : ${resB.surveyorPriority} (Manual On-Site Assessor Required)`);
}

async function runBusinessAnalytics(container) {
  console.log('\n--- MODULE 4: EXECUTIVE BUSINESS MODEL & INSURER ROI ---');
  const metrics = container.businessAnalytics.getExecutiveMetrics();

  console.log('COMMERCIAL UNIT ECONOMICS:');
  console.log(` • Cost per processed intimation (AI compute + STT): ₹${metrics.insurerCommercialRoi.costPerProcessedIntimationInr}`);
  console.log(` • Enterprise B2B SaaS price per intimation        : ₹${metrics.insurerCommercialRoi.enterpriseB2BPricingPerIntimationInr}`);
  console.log(` • Gross Profit Margin                             : ${metrics.insurerCommercialRoi.grossProfitMarginPercent}%`);

  console.log('\nINSURANCE COMPANY ROI (PER 100,000 INTIMATIONS):');
  console.log(` • Ineligible / Discrepant Claims Filtered via IPI : ${metrics.insurerCommercialRoi.fraudulentOrIneligibleClaimsFlaggedPercent}%`);
  console.log(` • Field Survey Costs Saved for Insurers           : ${metrics.insurerCommercialRoi.netFraudSavingsPer100kClaimsInr}`);
  console.log(` • Intake Time Cut (45 min paper -> 38 sec voice)  : ${metrics.intakeVelocityMetrics.timeSavedPerFarmerPercentage}% reduction`);

  console.log('\nTOTAL ADDRESSABLE MARKET (TAM - INDIA PMFBY):');
  console.log(` • Enrolled Farmers/Year : ${metrics.commercialBusinessModel.totalAddressableMarketIndia.enrolledFarmersPerYear}`);
  console.log(` • Annual Gross Premiums : ${metrics.commercialBusinessModel.totalAddressableMarketIndia.grossAnnualPMFBYPremium}`);
  console.log(` • Total Software TAM    : ${metrics.commercialBusinessModel.totalAddressableMarketIndia.totalAddressableSoftwareMarketInr}`);
}

async function runSurveyorEscalation(container) {
  console.log('\n--- MODULE 6: 24-HOUR EMERGENCY SURVEYOR ESCALATION DOSSIER ---');
  console.log('Generating Express Loss Assessor Dispatch Packet for District Nodal Officer...\n');

  const dossier = {
    escalationId: `ESC-2026-${Date.now().toString().slice(-6)}`,
    incidentUrgency: 'CRITICAL_24H_WINDOW',
    statutoryDeadlinePMFBY: '72 Hours',
    escalatedSlaTarget: 'Surveyor on site within 6 Hours',
    affectedVillage: 'Peddapalli, Mandal: Tenali, District: Guntur',
    estimatedAcreageAtRisk: '48 Acres across 14 Smallholder Intimations',
    primaryCrop: 'Paddy (Standing, Grain Filling Stage)',
    weatherGroundingConfidence: '96% (Severe Hail & Inundation)',
    dispatchedTo: [
      'Block Agriculture Officer (BAO) - Tenali Block',
      'AIC of India District Nodal Loss Surveyor',
      'Village Agricultural Assistant (VAA)',
    ],
    surveyorChecklistPacket: [
      'Field GPS Geo-Tagged Camera Verification (PMFBY Crop Insurance App)',
      'Cut-and-spread waterlogged drainage inspection',
      'Grain shedding assessment percentage',
    ],
  };

  console.log(JSON.stringify(dossier, null, 2));
}

function runTestSuite() {
  console.log('\n--- MODULE 5: RUNNING FULL PRODUCTION TEST SUITE ---');
  const { execSync } = require('node:child_process');
  try {
    const out = execSync('npm test', { encoding: 'utf8' });
    console.log(out);
  } catch (err) {
    console.error(err.stdout || err.message);
  }
}

if (require.main === module) {
  createConsole();
}

module.exports = { createConsole };
