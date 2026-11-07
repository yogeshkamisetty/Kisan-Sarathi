/**
 * Farmer Onboarding & Profile Service
 * Supports SELF, FAMILY_MEMBER, and CSC_OPERATOR assisted reporting attribution.
 * Strictly prohibits storing bank account details in the ordinary MVP workflow.
 */
const crypto = require('node:crypto');
const { AssistedMode } = require('../../../../packages/shared-types/src/index.js');

class FarmersService {
  constructor(auditService, { store = null } = {}) {
    this.auditService = auditService;
    this.store = store;
    this.profiles = new Map(Object.entries(store?.read('farmerProfiles') || {}));
  }

  _persist() {
    if (this.store) this.store.write('farmerProfiles', Object.fromEntries(this.profiles));
  }

  createProfile({
    userId,
    farmerName,
    mobileNumber = null,
    state,
    district,
    village,
    preferredLanguage = 'hi-IN',
    assistedMode = AssistedMode.SELF,
    assistedByName = null,
    assistedByOperatorId = null,
    bankAccountNumber = undefined,
  }) {
    if (bankAccountNumber !== undefined) {
      const err = new Error(
        'DATA_MINIMISATION_VIOLATION: Complete bank account numbers must not be collected in the MVP workflow.'
      );
      err.code = 'DATA_MINIMISATION_VIOLATION';
      throw err;
    }

    if (!farmerName || !state || !district || !village) {
      const err = new Error('MISSING_REQUIRED_PROFILE_FIELDS: farmerName, state, district, and village are required.');
      err.code = 'MISSING_REQUIRED_PROFILE_FIELDS';
      throw err;
    }

    if (assistedMode === AssistedMode.CSC_OPERATOR && !assistedByOperatorId) {
      const err = new Error('CSC_ATTRIBUTION_REQUIRED: CSC assisted mode requires assistedByOperatorId.');
      err.code = 'CSC_ATTRIBUTION_REQUIRED';
      throw err;
    }

    const profile = {
      id: crypto.randomUUID(),
      userId,
      farmerName: String(farmerName).trim(),
      mobileNumber: mobileNumber ? String(mobileNumber).trim() : null,
      state: String(state).trim(),
      district: String(district).trim(),
      village: String(village).trim(),
      preferredLanguage,
      assistedMode,
      assistedByName,
      assistedByOperatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(profile.id, profile);
    this._persist();
    if (this.auditService) {
      this.auditService.recordEvent({
        actorId: userId,
        action: 'FARMER_PROFILE_CREATED',
        newValue: {
          profileId: profile.id,
          state: profile.state,
          district: profile.district,
          village: profile.village,
          assistedMode: profile.assistedMode,
        },
      });
    }
    return profile;
  }

  getProfile(profileId) {
    return this.profiles.get(profileId) || null;
  }
}

module.exports = { FarmersService };
