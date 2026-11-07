/**
 * Section 18.2: Farmer Dashboard
 * Simple, high-contrast rural interface with large "Report Crop Loss" button, draft counts, and deadline reminders.
 */
export function FarmerDashboardScreen() {
  return {
    screenId: 'FARMER_DASHBOARD',
    components: [
      'GREETING_AND_LANGUAGE_BADGE',
      'LARGE_REPORT_CROP_LOSS_CTA',
      'SAVED_LOCAL_DRAFTS_COUNT',
      'PENDING_7_DAY_COMPLETION_REPORTS',
      'RECENT_REPORTS_LIST',
      'POLICY_DEADLINE_GUIDANCE_CARD',
      'OFFICIAL_HELPLINE_14447_HELP_CARD',
    ],
  };
}
