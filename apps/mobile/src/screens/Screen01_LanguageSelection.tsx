/**
 * SCREEN 01: Language Selection
 * Displays only languages that have passed Gnani Prisma STT & Timbre TTS voice workflow tests.
 */
import React from 'react';
import { VERIFIED_LANGUAGES } from '../../../../packages/shared-types/src/index';

export function Screen01_LanguageSelection({ onSelectLanguage }: { onSelectLanguage: (code: string) => void }) {
  const testedLanguages = VERIFIED_LANGUAGES.filter((l: any) => l.active && l.voiceWorkflowTested);
  return {
    screenId: 'SCREEN_01_LANGUAGE_SELECTION',
    title: 'Select Your Language / अपनी भाषा चुनें / మీ భాషను ఎంచుకోండి',
    testedLanguages,
    select: (code: string) => onSelectLanguage(code),
  };
}
