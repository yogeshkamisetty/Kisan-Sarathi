/**
 * SCREEN 07: Voice Readback via Gnani Timbre TTS
 * Reads back all critical fields (crop, loss event, incident date, crop stage, affected area, village)
 * and requires explicit farmer confirmation before report finalisation.
 */
export function Screen07_VoiceReadback() {
  return {
    screenId: 'SCREEN_07_VOICE_READBACK',
    actions: ['CONFIRM_ALL_CRITICAL_DETAILS', 'CORRECT_INFORMATION', 'REPLAY_AUDIO', 'RETURN_TO_EDITING'],
    alwaysShowsReadableTextFallback: true,
  };
}
