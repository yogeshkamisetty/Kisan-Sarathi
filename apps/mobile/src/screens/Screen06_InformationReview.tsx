/**
 * SCREEN 06: Information Review Cards
 * Displays each field with explicit status badge (CONFIRMED, NEEDS_CONFIRMATION, MISSING, APPROXIMATE, UNCERTAIN),
 * Edit option, and Speak-to-Correct option. Never displays uncertain values as verified.
 */
export function Screen06_InformationReview() {
  return {
    screenId: 'SCREEN_06_INFORMATION_REVIEW',
    cardActions: ['EDIT_MANUALLY', 'SPEAK_TO_CORRECT', 'CONFIRM_FIELD'],
    distinguishesUncertainFromVerified: true,
  };
}
