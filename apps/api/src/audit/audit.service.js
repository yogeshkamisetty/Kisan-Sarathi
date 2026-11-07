/**
 * Immutable Audit Event Service
 * Records all changes to farmer-confirmed fields, workflow states, consent, and policy rules.
 */
const crypto = require('node:crypto');
const { UserRole } = require('../../../../packages/shared-types/src/index.js');

class AuditService {
  constructor({ store = null } = {}) {
    this.store = store;
    this.events = store?.read('auditEvents') || [];
  }

  recordEvent({
    actorId,
    actorRole = UserRole.FARMER,
    reportId = null,
    action,
    fieldName = null,
    previousValue = null,
    newValue = null,
    reason = null,
    source = 'MOBILE_APP',
  }) {
    if (!actorId || !action) {
      throw new Error('AuditEvent requires actorId and action.');
    }

    // Rule 4D: Administrators cannot alter individual farmer report fields without an explicit traceable reason
    if (actorRole === UserRole.ADMIN && reportId && fieldName && !reason) {
      throw new Error(
        'SECURITY_VIOLATION: Administrators cannot modify farmer report fields without an explicit audit justification.'
      );
    }

    const event = Object.freeze({
      id: crypto.randomUUID(),
      actorId,
      actorRole,
      reportId,
      action,
      fieldName,
      previousValue,
      newValue,
      reason,
      source,
      timestamp: new Date().toISOString(),
    });

    this.events.push(event);
    // The audit trail is append-only and must outlive the process.
    if (this.store) this.store.write('auditEvents', this.events);
    return event;
  }

  getReportAuditTrail(reportId) {
    return this.events.filter((e) => e.reportId === reportId);
  }

  getAllEvents() {
    return [...this.events];
  }
}

module.exports = { AuditService };
