/**
 * SCREEN 10: Official Acknowledgement Reference Entry
 * Allows farmer to record official submission date, channel, and ticket/reference number.
 * Explicitly labels manually entered numbers as "Farmer-Reported — Not Independently Government-Verified".
 */
export function Screen10_OfficialReferenceEntry() {
  return {
    screenId: 'SCREEN_10_OFFICIAL_REFERENCE_ENTRY',
    fields: ['submissionDate', 'officialReferenceNumber', 'reportingChannel', 'acknowledgementDocument'],
    verificationBadge: 'FARMER_REPORTED_NOT_INDEPENDENTLY_VERIFIED',
  };
}
