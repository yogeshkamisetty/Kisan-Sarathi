/**
 * Dual-Track Report Workflow & Official Submission State Machine
 *
 * Strictly separates internal draft preparation status from external official submission status (Section 15).
 */
const {
  WorkflowStatus,
  SubmissionStatus,
  CRITICAL_CONFIRMATION_FIELDS,
  FieldExtractionStatus,
} = require('../../../../packages/shared-types/src/index.js');

const ALLOWED_WORKFLOW_TRANSITIONS = Object.freeze({
  [WorkflowStatus.DRAFT_LOCAL]: [WorkflowStatus.SYNC_PENDING, WorkflowStatus.IN_PROGRESS, WorkflowStatus.CANCELLED],
  [WorkflowStatus.SYNC_PENDING]: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.NEEDS_REVIEW, WorkflowStatus.CANCELLED],
  [WorkflowStatus.IN_PROGRESS]: [WorkflowStatus.NEEDS_REVIEW, WorkflowStatus.READY_FOR_EXPORT, WorkflowStatus.CANCELLED],
  [WorkflowStatus.NEEDS_REVIEW]: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.READY_FOR_EXPORT, WorkflowStatus.CANCELLED],
  [WorkflowStatus.READY_FOR_EXPORT]: [WorkflowStatus.EXPORTED, WorkflowStatus.NEEDS_REVIEW, WorkflowStatus.CANCELLED],
  [WorkflowStatus.EXPORTED]: [WorkflowStatus.COMPLETION_PENDING, WorkflowStatus.COMPLETED, WorkflowStatus.NEEDS_REVIEW],
  [WorkflowStatus.COMPLETION_PENDING]: [WorkflowStatus.COMPLETED, WorkflowStatus.EXPORTED, WorkflowStatus.NEEDS_REVIEW],
  [WorkflowStatus.COMPLETED]: [WorkflowStatus.NEEDS_REVIEW],
  [WorkflowStatus.CANCELLED]: [],
});

function transitionWorkflowStatus(currentStatus, targetStatus) {
  const allowed = ALLOWED_WORKFLOW_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    const err = new Error(
      `INVALID_WORKFLOW_TRANSITION: Cannot transition report workflow status from "${currentStatus}" to "${targetStatus}".`
    );
    err.code = 'INVALID_WORKFLOW_TRANSITION';
    throw err;
  }
  return targetStatus;
}

/**
 * Enforces Rule 15.2: OFFICIALLY_VERIFIED may ONLY be set when an authorised government integration
 * confirms the acknowledgement. Manual farmer/operator entry is capped at ACKNOWLEDGEMENT_ENTERED.
 */
function transitionSubmissionStatus(currentStatus, targetStatus, { isAuthorisedGovernmentIntegration = false } = {}) {
  if (targetStatus === SubmissionStatus.OFFICIALLY_VERIFIED && !isAuthorisedGovernmentIntegration) {
    const err = new Error(
      'UNVERIFIED_SUBMISSION_STATUS_FORBIDDEN: Manual reference entry cannot set OFFICIALLY_VERIFIED. Use ACKNOWLEDGEMENT_ENTERED (labelled farmer-reported, not government-verified).'
    );
    err.code = 'UNVERIFIED_SUBMISSION_STATUS_FORBIDDEN';
    throw err;
  }
  return targetStatus;
}

/**
 * Verifies that all critical fields have values and have been read back and confirmed by the farmer
 * before allowing report finalisation.
 */
function verifyCriticalFieldsForFinalisation(report) {
  const unconfirmedCritical = [];
  for (const field of CRITICAL_CONFIRMATION_FIELDS) {
    const entry = report.extractedValues ? report.extractedValues[field] : null;
    if (
      !entry ||
      entry.value === null ||
      entry.value === undefined ||
      ![FieldExtractionStatus.CONFIRMED, FieldExtractionStatus.CORRECTED].includes(entry.status)
    ) {
      unconfirmedCritical.push(field);
    }
  }

  if (!report.readbackCompleted) {
    return {
      ready: false,
      reason: 'VOICE_READBACK_REQUIRED: Critical details must be read back to the farmer and confirmed before finalisation.',
      unconfirmedCritical,
    };
  }

  if (unconfirmedCritical.length > 0) {
    return {
      ready: false,
      reason: `UNCONFIRMED_CRITICAL_FIELDS: The following critical fields require farmer confirmation: ${unconfirmedCritical.join(', ')}`,
      unconfirmedCritical,
    };
  }

  return {
    ready: true,
    reason: null,
    unconfirmedCritical: [],
  };
}

module.exports = {
  ALLOWED_WORKFLOW_TRANSITIONS,
  transitionWorkflowStatus,
  transitionSubmissionStatus,
  verifyCriticalFieldsForFinalisation,
};
