/**
 * Section 18: Rural-First Accessible UI/UX Design System
 * High-contrast palette with >= 56dp touch targets and zero reliance on colour alone.
 */
export const FasalTheme = {
  colors: {
    primaryGreen: '#1B5E20',       // Deep agricultural green for primary actions
    darkHeadingGreen: '#0D3B10',   // Dark green for important headings
    backgroundCream: '#FAF8F5',    // Light cream / off-white background
    surfaceCard: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#4B5563',      // Muted grey for supporting information
    urgentAmber: '#B45309',        // Amber for urgent 72-hour reminders
    urgentAmberBg: '#FEF3C7',
    errorRed: '#B91C1C',           // Red for warnings / NOT OFFICIALLY SUBMITTED banner
    errorRedBg: '#FEE2E2',
    infoBlue: '#1D4ED8',           // Blue for informational messages
    infoBlueBg: '#DBEAFE',
    borderSubtle: '#D1D5DB',
  },
  touchTargets: {
    minHeightDp: 56,
    microphoneButtonSizeDp: 112,
  },
  typography: {
    titlePt: 22,
    headingPt: 18,
    bodyPt: 16,
    captionPt: 14,
  },
} as const;
