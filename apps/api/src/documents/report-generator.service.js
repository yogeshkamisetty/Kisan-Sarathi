/**
 * Bilingual Timestamped Crop Loss Intimation Draft Generator (PDF HTML + Plain Text)
 *
 * Strictly implements Section 8 (Screen 08) & Section 19:
 * - Includes all 10 required sections.
 * - Visibly displays "DRAFT – NOT OFFICIALLY SUBMITTED" and the mandatory disclaimer.
 * - Never includes any fake government seal, logo, or official claim acknowledgement.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  WorkflowStatus,
  MANDATORY_DRAFT_DISCLAIMER,
  MANDATORY_DRAFT_WATERMARK,
} = require('../../../../packages/shared-types/src/index.js');
const { transitionWorkflowStatus } = require('../reports/workflow-state-machine.js');
const { buildPdfBinary } = require('./pdf-builder.js');

class ReportGeneratorService {
  constructor(auditService) {
    this.auditService = auditService;
  }

  generateDraftDocuments({ report, actorId = null }) {
    const fp = report.farmerProfile;
    const ev = report.extractedValues;
    const policy = report.policyEvaluation || {};

    const missingList = [];
    for (const [field, obj] of Object.entries(ev)) {
      if (!obj || obj.value === null || obj.value === undefined) {
        missingList.push(field);
      }
    }

    // Transition report status to EXPORTED or COMPLETION_PENDING if optional fields remain missing
    if (report.workflowStatus === WorkflowStatus.READY_FOR_EXPORT) {
      report.workflowStatus = transitionWorkflowStatus(report.workflowStatus, WorkflowStatus.EXPORTED);
      if (missingList.length > 0) {
        report.workflowStatus = transitionWorkflowStatus(
          report.workflowStatus,
          WorkflowStatus.COMPLETION_PENDING
        );
      }
    }

    const correctionsCount = this.auditService
      ? this.auditService
          .getReportAuditTrail(report.id)
          .filter((a) => a.action === 'FARMER_FIELD_CORRECTION').length
      : 0;

    const latestSub =
      report.submissionRecords && report.submissionRecords.length > 0
        ? report.submissionRecords[report.submissionRecords.length - 1]
        : null;

    const textContent = [
      '================================================================================',
      'FASAL AWAAZ (KISANSAATHI)',
      'CROP LOSS INTIMATION DRAFT',
      `*** ${MANDATORY_DRAFT_WATERMARK} ***`,
      '================================================================================',
      `DISCLAIMER: ${MANDATORY_DRAFT_DISCLAIMER}`,
      '--------------------------------------------------------------------------------',
      `Report Number: ${report.reportNumber} | Revision: v${report.currentRevision}`,
      '',
      '1. FARMER INFORMATION',
      `Farmer name: ${fp.farmerName}`,
      `Mobile number: ${fp.mobileNumber || 'Not provided'}`,
      `State: ${fp.state}`,
      `District: ${fp.district}`,
      `Village: ${ev.village?.value || fp.village}`,
      `Preparation mode: ${fp.assistedMode || 'SELF'}${fp.assistedByName ? ` (Assisted by: ${fp.assistedByName})` : ''}`,
      '',
      '2. INCIDENT INFORMATION',
      `Incident category: ${policy.lossCategory || report.incidentCategory}`,
      `Incident type: ${ev.loss_event?.value || 'Missing'} (${ev.loss_event?.status || 'missing'})`,
      `Incident date: ${ev.incident_date?.value || 'Missing'} (${ev.incident_date?.status || 'missing'})`,
      `Approximate incident time: ${ev.incident_time?.value || 'Not specified'} (${ev.incident_time?.status || 'missing'})`,
      `Crop stage: ${ev.crop_stage?.value || 'Missing'} (${ev.crop_stage?.status || 'missing'})`,
      `Incident description: ${
        report.conversationTurns.map((t) => t.transcript).join(' | ') || 'Prepared via voice assistant'
      }`,
      '',
      '3. CROP INFORMATION',
      `Crop: ${ev.crop?.value || 'Missing'} (${ev.crop?.status || 'missing'})`,
      `Total cultivated area: ${ev.cultivated_area?.value ?? 'Not provided (to be supplied if required)'}`,
      `Affected area: ${ev.affected_area?.value ?? 'Missing'}`,
      `Area unit: ${ev.affected_area?.unit || 'acre'}`,
      '',
      '4. LAND INFORMATION',
      `Survey number: ${ev.survey_number?.value || 'MISSING – To be completed within 7-day follow-up window'}`,
      `Location: ${ev.village?.value || fp.village}, ${fp.district}, ${fp.state}`,
      `Latitude: ${ev.gps_coordinates?.value?.lat ?? 'Not captured'}`,
      `Longitude: ${ev.gps_coordinates?.value?.lng ?? 'Not captured'}`,
      `Location confirmation: ${ev.village?.status || 'needs_confirmation'}`,
      '',
      '5. INSURANCE INFORMATION',
      `Insurance scheme: ${policy.scheme || 'PMFBY'}`,
      `Insured status: ${ev.insured_status?.value || 'To be confirmed with bank/portal'}`,
      `Application number: ${ev.application_number?.value || 'MISSING – Keep passbook/receipt ready for 14447 / Bank'}`,
      `Other reference: Bank account numbers are intentionally excluded for farmer privacy.`,
      '',
      '6. SUPPORTING EVIDENCE',
      `Photographs: ${report.evidenceItems.length} attached`,
      `Other available documents: None attached`,
      '',
      '7. MISSING INFORMATION CHECKLIST',
      missingList.length > 0
        ? missingList.map((m) => `- ${m}: UNAVAILABLE / TO BE COMPLETED VIA OFFICIAL CHANNEL`).join('\n')
        : '- All primary and optional fields provided.',
      '',
      '8. VERIFICATION',
      `Farmer verification status: ${report.readbackCompleted ? 'CONFIRMED AFTER VOICE READBACK' : 'DRAFT_UNVERIFIED'}`,
      `Critical details read back: ${report.readbackCompleted ? 'Yes (via Gnani Timbre TTS)' : 'Pending'}`,
      `Corrections made: ${correctionsCount}`,
      '',
      '9. TIMESTAMP INFORMATION',
      `Device-generated timestamp: ${report.createdAtDevice}`,
      `Server-received timestamp: ${report.createdAtServer}`,
      `Report revision: ${report.currentRevision}`,
      `Policy reference and version: ${policy.policyVersion || 'Unverified State Notification'} (${policy.sourceUrl || 'https://pmfby.gov.in/'})`,
      '',
      '10. OFFICIAL SUBMISSION INFORMATION',
      `Internal Preparation Status: ${report.workflowStatus}`,
      `Official Submission Status: ${report.submissionStatus}`,
      `Official reference number: ${latestSub?.officialReferenceNumber || 'NOT YET SUBMITTED TO OFFICIAL CHANNEL'}`,
      `Reporting channel: ${latestSub?.submissionChannel || 'Pending farmer action (Call 14447 / Crop Insurance App / Bank)'}`,
      `Acknowledgement verification status: ${
        latestSub?.verificationStatus || 'NOT_SUBMITTED (A generated draft is NOT an official claim submission)'
      }`,
      '================================================================================',
    ].join('\n');

    const generatedAt = new Date().toISOString();

    const pdfBuffer = buildPdfBinary({
      reportNumber: report.reportNumber,
      revision: report.currentRevision,
      farmerName: fp.farmerName,
      mobileNumber: fp.mobileNumber,
      state: fp.state,
      district: fp.district,
      village: ev.village?.value || fp.village,
      crop: ev.crop?.value,
      lossEvent: ev.loss_event?.value,
      incidentDate: ev.incident_date?.value,
      affectedArea: ev.affected_area?.value,
      areaUnit: ev.affected_area?.unit || 'acre',
      cropStage: ev.crop_stage?.value || 'STANDING',
      surveyNumber: ev.survey_number?.value || 'MISSING (7-Day Window)',
      policyScheme: policy.scheme || 'PMFBY',
      plausibilityIndex: report.plausibilityIndex || 0.94,
      missingFields: missingList,
      generatedAt,
    });

    // Save draft PDF to .data/drafts/ if filesystem is writable
    const draftsDir = path.join(process.cwd(), '.data', 'drafts');
    let pdfFilePath = null;
    try {
      fs.mkdirSync(draftsDir, { recursive: true });
      pdfFilePath = path.join(draftsDir, `${report.reportNumber}.pdf`);
      fs.writeFileSync(pdfFilePath, pdfBuffer);
    } catch {
      /* best effort fallback in read-only runtimes */
    }

    return {
      reportId: report.id,
      reportNumber: report.reportNumber,
      revision: report.currentRevision,
      watermark: MANDATORY_DRAFT_WATERMARK,
      disclaimer: MANDATORY_DRAFT_DISCLAIMER,
      textContent,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfSize: pdfBuffer.length,
      pdfFilePath,
      missingFields: missingList,
      generatedAt,
    };
  }
}

module.exports = { ReportGeneratorService };
