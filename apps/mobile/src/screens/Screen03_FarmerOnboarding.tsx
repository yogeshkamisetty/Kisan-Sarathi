/**
 * SCREEN 03: Farmer Onboarding & Assisted Reporting Attribution
 * Captures minimum required fields (Name, Mobile, State, District, Village, Language) and Assisted Mode.
 * Strictly excludes bank account details.
 */
export function Screen03_FarmerOnboarding() {
  return {
    screenId: 'SCREEN_03_FARMER_ONBOARDING',
    fields: ['farmerName', 'mobileNumber', 'state', 'district', 'village', 'preferredLanguage', 'assistedMode'],
    collectsBankAccountDetails: false,
    supportedAssistedModes: ['SELF', 'FAMILY_MEMBER', 'CSC_OPERATOR'],
  };
}
