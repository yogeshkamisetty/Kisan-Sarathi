/**
 * Field Evidence & Presigned Upload Service (S3 / MinIO Compatible)
 */
const crypto = require('node:crypto');

const ALLOWED_EVIDENCE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

class EvidenceService {
  constructor({ env = process.env, auditService } = {}) {
    this.endpoint = env.OBJECT_STORAGE_ENDPOINT || 'http://localhost:9000';
    this.bucket = env.OBJECT_STORAGE_BUCKET || 'fasal-awaaz-artifacts';
    this.auditService = auditService;
    this.items = new Map();
  }

  createPresignedUploadUrl({ reportId, actorId, fileType, fileSize, latitude = null, longitude = null }) {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(fileType)) {
      const err = new Error(`UNSUPPORTED_EVIDENCE_TYPE: ${fileType}`);
      err.code = 'UNSUPPORTED_EVIDENCE_TYPE';
      throw err;
    }
    if (!fileSize || fileSize <= 0 || fileSize > MAX_EVIDENCE_FILE_BYTES) {
      const err = new Error('INVALID_EVIDENCE_SIZE: File must be between 1 byte and 8 MB.');
      err.code = 'INVALID_EVIDENCE_SIZE';
      throw err;
    }

    const id = crypto.randomUUID();
    const ext = fileType.split('/')[1] || 'bin';
    const storageKey = `reports/${reportId}/evidence/${id}.${ext}`;
    const item = {
      id,
      reportId,
      storageKey,
      fileType,
      fileSize,
      uploadStatus: 'PENDING_UPLOAD',
      captureTime: new Date().toISOString(),
      latitude,
      longitude,
      farmerConfirmed: false,
    };
    this.items.set(id, item);

    return {
      evidenceId: id,
      storageKey,
      presignedPutUrl: `${this.endpoint}/${this.bucket}/${storageKey}?signature=presigned-${id}`,
      expiresInSeconds: 600,
    };
  }

  confirmUpload({ evidenceId, actorId, farmerConfirmed = true }) {
    const item = this.items.get(evidenceId);
    if (!item) throw new Error('EVIDENCE_NOT_FOUND');
    item.uploadStatus = 'UPLOADED';
    item.farmerConfirmed = Boolean(farmerConfirmed);
    if (this.auditService) {
      this.auditService.recordEvent({
        actorId,
        reportId: item.reportId,
        action: 'EVIDENCE_UPLOAD_CONFIRMED',
        newValue: { evidenceId: item.id, storageKey: item.storageKey },
      });
    }
    return item;
  }
}

module.exports = { EvidenceService };
