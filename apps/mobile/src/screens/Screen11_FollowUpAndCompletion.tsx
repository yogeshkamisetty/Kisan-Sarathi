/**
 * SCREEN 11: Follow-Up and 7-Day Completion
 * Allows farmer to return later to supply missing survey/application numbers or photos.
 * Every change creates a new revision and AuditEvent without silently altering confirmed data.
 */
export function Screen11_FollowUpAndCompletion() {
  return {
    screenId: 'SCREEN_11_FOLLOW_UP_AND_COMPLETION',
    displays: [
      'ORIGINAL_REPORT',
      'MISSING_INFORMATION_CHECKLIST',
      'PENDING_EVIDENCE',
      'OFFICIAL_REFERENCE_NUMBER',
      'APPLICABLE_DEADLINE_REMINDER',
      'COMPLETION_STATUS',
    ],
    createsAuditRevisionOnEveryEdit: true,
  };
}
