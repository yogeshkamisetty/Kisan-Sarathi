/**
 * Granular Versioned Consent Management Service
 * Ensures audio recording, Gnani AI cloud processing, GPS, and personal data storage are explicitly consented.
 */
const crypto = require('node:crypto');
const { ConsentType } = require('../../../../packages/shared-types/src/index.js');

const CURRENT_CONSENT_VERSION = 'v1.0-2026-11';

const CONSENT_PURPOSES = Object.freeze({
  [ConsentType.AUDIO_RECORDING]:
    'Record your spoken description of crop damage on this device so you do not have to type.',
  [ConsentType.GNANI_CLOUD_VOICE_PROCESSING]:
    'Send your voice recording securely to Gnani AI (api.vachana.ai) for speech-to-text transcription and spoken readback.',
  [ConsentType.PERSONAL_DATA_STORAGE]:
    'Save your name, village, crop damage details, and draft report so you can review and share them with official PMFBY channels.',
  [ConsentType.GPS_LOCATION_CAPTURE]:
    'Capture optional field GPS coordinates to help identify your agricultural plot.',
  [ConsentType.PHOTO_EVIDENCE_UPLOAD]:
    'Attach optional field photographs of crop damage to your intimation draft.',
});

class ConsentService {
  constructor(auditService, { store = null } = {}) {
    this.auditService = auditService;
    this.store = store;
    this.records = store?.read('consents') || [];
  }

  _persist() {
    if (this.store) this.store.write('consents', this.records);
  }

  grantConsent({ userId, consentType, consentVersion = CURRENT_CONSENT_VERSION, source = 'MOBILE_APP' }) {
    if (!Object.values(ConsentType).includes(consentType)) {
      throw new Error(`Unsupported consent type: ${consentType}`);
    }

    const record = {
      id: crypto.randomUUID(),
      userId,
      consentType,
      purpose: CONSENT_PURPOSES[consentType],
      consentVersion,
      granted: true,
      grantedAt: new Date().toISOString(),
      withdrawnAt: null,
    };

    this.records.push(record);
    this._persist();
    if (this.auditService) {
      this.auditService.recordEvent({
        actorId: userId,
        action: 'CONSENT_GRANTED',
        fieldName: consentType,
        newValue: { consentVersion, grantedAt: record.grantedAt },
        source,
      });
    }
    return record;
  }

  withdrawConsent({ userId, consentType, source = 'MOBILE_APP' }) {
    const active = this.records.filter(
      (r) => r.userId === userId && r.consentType === consentType && r.granted && !r.withdrawnAt
    );
    const now = new Date().toISOString();
    for (const r of active) {
      r.granted = false;
      r.withdrawnAt = now;
    }
    this._persist();
    if (this.auditService) {
      this.auditService.recordEvent({
        actorId: userId,
        action: 'CONSENT_WITHDRAWN',
        fieldName: consentType,
        newValue: { withdrawnAt: now },
        source,
      });
    }
    return { withdrawnCount: active.length, withdrawnAt: now };
  }

  hasActiveConsent(userId, consentType) {
    return this.records.some(
      (r) => r.userId === userId && r.consentType === consentType && r.granted && !r.withdrawnAt
    );
  }

  requireConsent(userId, consentType) {
    if (!this.hasActiveConsent(userId, consentType)) {
      const err = new Error(
        `CONSENT_REQUIRED: Explicit farmer consent for "${consentType}" is required before performing this action.`
      );
      err.code = 'CONSENT_REQUIRED';
      throw err;
    }
    return true;
  }

  getUserConsents(userId) {
    return this.records.filter((r) => r.userId === userId);
  }
}

module.exports = { ConsentService, CURRENT_CONSENT_VERSION, CONSENT_PURPOSES };
