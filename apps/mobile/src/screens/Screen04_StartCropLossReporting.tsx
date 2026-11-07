/**
 * SCREEN 04: Start Crop-Loss Reporting
 * Large 112dp microphone button, start/stop/replay/retry recording, manual typing fallback, and offline draft support.
 */
export function Screen04_StartCropLossReporting() {
  return {
    screenId: 'SCREEN_04_START_CROP_LOSS_REPORTING',
    mainPrompt: 'Tell us what happened to your crop.',
    actions: [
      'START_RECORDING',
      'STOP_RECORDING',
      'REPLAY_RECORDING',
      'RETRY_RECORDING',
      'TYPE_MANUALLY',
      'CONTINUE_WITH_PARTIAL_DRAFT',
    ],
  };
}
