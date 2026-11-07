/**
 * SCREEN 05: AI-Guided Dynamic Conversation
 * Transcribes speech via backend Gnani Prisma proxy, extracts known fields, and asks only for missing details.
 */
export function Screen05_AIConversation() {
  return {
    screenId: 'SCREEN_05_AI_CONVERSATION',
    states: ['LISTENING', 'PROCESSING_GNANI_PRISMA', 'SPEAKING_GNANI_TIMBRE', 'WAITING_FOR_FARMER'],
    supportsPartialDraftContinuation: true,
  };
}
