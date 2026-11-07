/**
 * Typed surface for the Fasal Awaaz backend API client.
 *
 * The implementation lives in ./client.js so the Node test suite and the Expo bundler
 * share exactly one copy — the other .ts/.js twins in this repo duplicate logic and can
 * drift apart, which is deliberately avoided here.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FasalAwaazApiClient: Impl, ApiError: ApiErrorImpl } = require('./client.js');

export type ConsentType =
  | 'AUDIO_RECORDING'
  | 'GNANI_CLOUD_VOICE_PROCESSING'
  | 'PERSONAL_DATA_STORAGE'
  | 'GPS_LOCATION_CAPTURE'
  | 'PHOTO_EVIDENCE_UPLOAD';

export interface TokenStore {
  getToken(): Promise<string | null> | string | null;
  setSession(session: { accessToken: string | null; refreshToken: string | null }): void;
  clear(): void;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore?: TokenStore | null;
  fetchImpl?: typeof fetch | null;
  timeoutMs?: number;
}

export interface AuthSession {
  user: { id: string; role: string; preferredLanguage: string };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TranscriptionResult {
  success: boolean;
  requestId: string;
  transcript: string;
  detectedLanguageCode: string;
  /** 'LIVE_GNANI' or 'MOCK_DEVELOPMENT' — decided by the server, never the client. */
  providerMode: string;
  providerNotice?: string;
}

export interface FasalAwaazApiClient {
  setSession(session: { accessToken?: string | null; refreshToken?: string | null }): void;
  clearSession(): void;
  health(): Promise<any>;
  listLanguages(): Promise<{ languages: any[] }>;
  voiceProviderHealth(): Promise<any>;
  requestOtp(mobileNumber: string): Promise<any>;
  verifyOtp(params: {
    mobileNumber: string;
    otp: string;
    preferredLanguage?: string;
  }): Promise<AuthSession>;
  grantConsent(consentType: ConsentType): Promise<any>;
  grantConsents(consentTypes: ConsentType[]): Promise<any[]>;
  createFarmerProfile(profile: Record<string, unknown>): Promise<any>;
  createReport(params: {
    farmerProfile: Record<string, unknown>;
    createdAtDevice?: string | null;
    idempotencyKey: string;
  }): Promise<any>;
  getReport(reportId: string): Promise<any>;
  submitConversationTurn(params: {
    reportId: string;
    transcript: string;
    language?: string;
    audioTranscribed?: boolean;
  }): Promise<any>;
  correctField(params: {
    reportId: string;
    fieldName: string;
    newValue: unknown;
    unit?: string | null;
    reason?: string;
  }): Promise<any>;
  requestVoiceReadback(params: { reportId: string; languageCode?: string }): Promise<any>;
  confirmAfterReadback(reportId: string): Promise<any>;
  generateDraftDocuments(reportId: string): Promise<any>;
  recordOfficialSubmissionReference(params: {
    reportId: string;
    submissionChannel: string;
    officialReferenceNumber?: string | null;
    submissionDateIso?: string | null;
  }): Promise<any>;
  transcribeAudio(params: {
    audioBase64: string;
    languageCode?: string;
    audioFormat?: string;
    durationSeconds?: number;
    previousText?: string | null;
  }): Promise<TranscriptionResult>;
  synthesizeSpeech(params: { text: string; languageCode?: string }): Promise<any>;
}

export const FasalAwaazApiClient: new (options: ApiClientOptions) => FasalAwaazApiClient = Impl;
export const ApiError: new (message: string, meta?: { code?: string; status?: number }) => Error & {
  code: string;
  status: number;
} = ApiErrorImpl;
