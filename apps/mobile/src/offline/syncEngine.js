/**
 * Section 12.2: Network Recovery & Idempotent Offline Synchronisation Queue
 */
class OfflineSyncEngine {
  /**
   * @param {object} localStore Local SQLite draft store.
   * @param {string} apiBaseUrl Backend origin.
   * @param {object|null} apiClient FasalAwaazApiClient, used to supply the auth token
   *   when no explicit transport is injected. The API now rejects unauthenticated
   *   writes, so a sync without a token would silently fail forever.
   */
  constructor(localStore, apiBaseUrl = 'http://localhost:3000', apiClient = null) {
    this.localStore = localStore;
    this.apiBaseUrl = apiBaseUrl;
    this.apiClient = apiClient;
  }

  /**
   * Default transport: a real authenticated POST through the API client.
   */
  async _defaultTransport(url, options) {
    if (!this.apiClient) {
      throw new Error(
        'SYNC_TRANSPORT_MISSING: Provide an apiClient or an explicit transport function.'
      );
    }
    const token = await this.apiClient._token();
    if (!token) {
      // Not signed in: keep the draft local rather than dropping it.
      return { ok: false, status: 401 };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
      body: options.body,
    });
    return { ok: res.ok, status: res.status };
  }

  async syncPendingDrafts(isOnline, transport = null) {
    const send = transport || ((url, options) => this._defaultTransport(url, options));

    if (!isOnline) {
      return {
        syncedCount: 0,
        status: 'OFFLINE_SAVED_LOCALLY',
        offlineNotice:
          'You are offline. Your information has been saved on this device. It has NOT been sent to the official insurance reporting channel.',
      };
    }

    const drafts = this.localStore
      .listLocalDrafts()
      .filter((d) => d.workflowStatus === 'DRAFT_LOCAL' || d.workflowStatus === 'SYNC_PENDING');

    let syncedCount = 0;
    for (const draft of drafts) {
      const response = await send(`${this.apiBaseUrl}/api/v1/reports`, {
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': draft.idempotencyKey,
        },
        body: JSON.stringify(draft),
      });
      if (response && response.ok) {
        this.localStore.saveDraftLocally({
          ...draft,
          workflowStatus: 'SYNC_PENDING',
          lastSyncedAtServer: new Date().toISOString(),
        });
        syncedCount += 1;
      }
    }

    return { syncedCount, status: 'SYNCHRONISED_WITH_SERVER' };
  }
}

module.exports = { OfflineSyncEngine };
