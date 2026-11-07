/**
 * Section 12.2: Network Recovery & Idempotent Offline Synchronisation Queue
 * Uses Idempotency-Key headers to guarantee retries never create duplicate server reports.
 *
 * Typed surface only; the implementation lives in ./syncEngine.js so Node tests and the
 * Expo bundler share one copy.
 */
import { OfflineDraftStore } from '../database/sqliteDraftStorage';
import { FasalAwaazApiClient } from '../api/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OfflineSyncEngine: Impl } = require('./syncEngine.js');

export interface SyncTransportResponse {
  ok: boolean;
  status?: number;
}

export type SyncTransport = (
  url: string,
  options: { headers: Record<string, string>; body: string }
) => Promise<SyncTransportResponse>;

export interface SyncResult {
  syncedCount: number;
  status: 'OFFLINE_SAVED_LOCALLY' | 'SYNCHRONISED_WITH_SERVER';
  offlineNotice?: string;
}

export interface OfflineSyncEngine {
  /**
   * @param transport Optional override; when omitted an authenticated request is sent
   *   through the API client supplied to the constructor.
   */
  syncPendingDrafts(isOnline: boolean, transport?: SyncTransport | null): Promise<SyncResult>;
}

export const OfflineSyncEngine: new (
  localStore: OfflineDraftStore,
  apiBaseUrl?: string,
  apiClient?: FasalAwaazApiClient | null
) => OfflineSyncEngine = Impl;
