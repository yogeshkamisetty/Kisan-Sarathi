/**
 * SCREEN 02: Welcome and Granular Consent
 * Requests explicit permission before recording audio, sending audio to Gnani AI, capturing GPS, or saving data.
 * Never starts recording automatically.
 */
import React from 'react';

export function Screen02_WelcomeAndConsent({ onGrantConsents }: { onGrantConsents: (consents: string[]) => void }) {
  return {
    screenId: 'SCREEN_02_WELCOME_AND_CONSENT',
    header: 'Kisan Sarathi — Speak. Verify. Prepare. Report.',
    mandatoryNotice:
      'Kisan Sarathi helps you prepare crop-loss information using your voice. It does not officially submit an insurance claim.',
    autoRecordingEnabled: false,
    requiredConsents: [
      'AUDIO_RECORDING',
      'GNANI_CLOUD_VOICE_PROCESSING',
      'PERSONAL_DATA_STORAGE',
    ],
    optionalConsents: ['GPS_LOCATION_CAPTURE', 'PHOTO_EVIDENCE_UPLOAD'],
    confirmConsent: (grantedList: string[]) => onGrantConsents(grantedList),
  };
}
