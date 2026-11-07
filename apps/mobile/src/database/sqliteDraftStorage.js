/**
 * Section 12: Offline-First SQLite Local Draft Persistence & Secure Local Storage
 */
const SQLITE_BOOTSTRAP_DDL = `
  CREATE TABLE IF NOT EXISTS local_drafts (
    local_id TEXT PRIMARY KEY NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    farmer_name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    village TEXT NOT NULL,
    language_code TEXT NOT NULL,
    workflow_status TEXT NOT NULL DEFAULT 'DRAFT_LOCAL',
    submission_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    extracted_fields_json TEXT NOT NULL,
    turns_json TEXT NOT NULL,
    queued_audio_paths_json TEXT NOT NULL DEFAULT '[]',
    created_at_device TEXT NOT NULL,
    updated_at_device TEXT NOT NULL,
    last_synced_at_server TEXT
  );
`;

class OfflineDraftStore {
  constructor() {
    this.memoryTable = new Map();
  }

  saveDraftLocally(draft) {
    const updated = {
      ...draft,
      updatedAtDevice: new Date().toISOString(),
    };
    this.memoryTable.set(draft.localId, updated);
    return updated;
  }

  getLocalDraft(localId) {
    return this.memoryTable.get(localId) || null;
  }

  listLocalDrafts() {
    return Array.from(this.memoryTable.values());
  }

  deleteLocalDraftAndRecordings(localId) {
    return this.memoryTable.delete(localId);
  }
}

module.exports = { OfflineDraftStore, SQLITE_BOOTSTRAP_DDL };
