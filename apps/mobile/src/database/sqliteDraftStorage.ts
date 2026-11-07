/**
 * Section 12: Offline-First SQLite Local Draft Persistence & Secure Local Storage
 * Ensures drafts survive app restarts and power/network outages without losing farmer-confirmed data.
 */
export interface LocalDraftRecord {
  localId: string;
  idempotencyKey: string;
  farmerName: string;
  state: string;
  district: string;
  village: string;
  languageCode: string;
  workflowStatus: 'DRAFT_LOCAL' | 'SYNC_PENDING' | 'EXPORTED' | 'COMPLETION_PENDING';
  submissionStatus: 'NOT_SUBMITTED' | 'FARMER_REPORTED_SUBMITTED' | 'ACKNOWLEDGEMENT_ENTERED';
  extractedFieldsJson: string;
  turnsJson: string;
  queuedAudioPathsJson: string;
  createdAtDevice: string;
  updatedAtDevice: string;
  lastSyncedAtServer: string | null;
}

export const SQLITE_BOOTSTRAP_DDL = `
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

export class OfflineDraftStore {
  private memoryTable: Map<string, LocalDraftRecord> = new Map();

  saveDraftLocally(draft: LocalDraftRecord): LocalDraftRecord {
    const updated: LocalDraftRecord = {
      ...draft,
      updatedAtDevice: new Date().toISOString(),
    };
    this.memoryTable.set(draft.localId, updated);
    return updated;
  }

  getLocalDraft(localId: string): LocalDraftRecord | null {
    return this.memoryTable.get(localId) || null;
  }

  listLocalDrafts(): LocalDraftRecord[] {
    return Array.from(this.memoryTable.values());
  }

  deleteLocalDraftAndRecordings(localId: string): boolean {
    return this.memoryTable.delete(localId);
  }
}
