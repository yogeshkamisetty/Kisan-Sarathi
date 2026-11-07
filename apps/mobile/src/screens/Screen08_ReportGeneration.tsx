/**
 * SCREEN 08: Crop Loss Intimation Draft Generation
 * Displays "DRAFT – NOT OFFICIALLY SUBMITTED" and mandatory disclaimer.
 * Supports Download PDF, View Report, Share Report, Copy Text, Save Locally, and Continue Completing Missing Info.
 */
export function Screen08_ReportGeneration() {
  return {
    screenId: 'SCREEN_08_REPORT_GENERATION',
    prominentBanner: 'DRAFT – NOT OFFICIALLY SUBMITTED',
    disclaimer:
      'This document is a farmer-prepared information summary. It is not an official claim submission, official acknowledgement, eligibility determination or guarantee of compensation.',
    actions: [
      'DOWNLOAD_PDF',
      'VIEW_REPORT',
      'SHARE_REPORT',
      'COPY_TEXT',
      'SAVE_LOCALLY',
      'CONTINUE_COMPLETING_MISSING_INFO',
    ],
  };
}
