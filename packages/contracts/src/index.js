/**
 * @fasal-awaaz/contracts
 * Shared API DTO factories and Verified Official Reporting Channel Directory.
 */

const OFFICIAL_PMFBY_CHANNELS = Object.freeze([
  {
    id: 'KRPH_HELPLINE_14447',
    name: 'Krishi Rakshak Portal & Helpline (KRPH)',
    channelType: 'TELEPHONE_HELPLINE',
    contactNumber: '14447',
    RequiresExplicitUserTapToCall: true,
    worksWithoutInternet: true,
    officialUrl: 'https://pmfby.gov.in/',
    verifiedAt: '2026-11-04',
    description:
      'Centralised toll-free helpline (14447) operated under PMFBY to register crop-loss intimations within 72 hours and receive an SMS ticket number.',
  },
  {
    id: 'CROP_INSURANCE_MOBILE_APP',
    name: 'Official Crop Insurance Mobile App (MoA&FW)',
    channelType: 'MOBILE_APP',
    androidPackage: 'in.farmguide.farmerapp.central',
    worksWithoutInternet: false,
    officialUrl: 'https://pmfby.gov.in/',
    verifiedAt: '2026-11-04',
    description:
      'Official Government of India Android application for direct crop-loss intimation and geo-tagged field photo submission.',
  },
  {
    id: 'NATIONAL_CROP_INSURANCE_PORTAL',
    name: 'National Crop Insurance Portal (NCIP)',
    channelType: 'WEB_PORTAL',
    officialUrl: 'https://pmfby.gov.in/',
    worksWithoutInternet: false,
    verifiedAt: '2026-11-04',
    description:
      'Official PMFBY web portal for farmer login, policy status lookup, and online loss intimation.',
  },
  {
    id: 'CONCERNED_BANK_OR_CSC',
    name: 'Concerned Bank Branch / PACS / Common Service Centre (CSC)',
    channelType: 'IN_PERSON_INSTITUTION',
    worksWithoutInternet: true,
    officialUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04',
    description:
      'Present your printed or saved Crop Loss Intimation Draft at the bank branch where your crop loan/insurance is held or at an authorised CSC.',
  },
  {
    id: 'LOCAL_AGRICULTURE_DEPARTMENT',
    name: 'Local Agriculture / Revenue Official (Block Agriculture Officer / Gram Sevak / Patwari)',
    channelType: 'IN_PERSON_OFFICIAL',
    worksWithoutInternet: true,
    officialUrl: 'https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf',
    verifiedAt: '2026-11-04',
    description:
      'Submit written crop-loss intimation to local agriculture or revenue officials if phone or internet connectivity is disrupted.',
  },
  {
    id: 'KISAN_CALL_CENTRE_18001801551',
    name: 'Kisan Call Centre (General Advisory Only)',
    channelType: 'ADVISORY_HELPLINE',
    contactNumber: '1800-180-1551',
    RequiresExplicitUserTapToCall: true,
    worksWithoutInternet: true,
    officialUrl: 'https://pmfby.gov.in/',
    verifiedAt: '2026-11-04',
    description:
      'General agricultural guidance helpline. Note: Use 14447 specifically for registering PMFBY insurance loss intimations.',
  },
]);

module.exports = {
  OFFICIAL_PMFBY_CHANNELS,
};
