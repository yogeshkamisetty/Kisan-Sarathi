/**
 * SCREEN 09: Verified Official Reporting Guidance
 * Displays verified PMFBY channels (Helpline 14447, Krishi Rakshak Portal, Crop Insurance App, Bank, Agriculture Office).
 * Telephone dialer only launches when the farmer explicitly taps the Call button.
 */
export function Screen09_OfficialReportingGuidance() {
  return {
    screenId: 'SCREEN_09_OFFICIAL_REPORTING_GUIDANCE',
    guidanceMessage:
      'Your information has been prepared. You must now provide your intimation through the applicable official reporting channel.',
    autoDialProhibited: true,
    primaryHelpline: '14447',
  };
}
