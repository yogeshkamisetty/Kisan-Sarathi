/**
 * Pilot Districts Directory Service
 * 
 * Provides verified administrative hierarchies, notified PMFBY crops,
 * insurance company cluster assignments, and Doppler agromet weather station
 * coordinates for targeted pilot districts (e.g. Anantapur, AP and Amravati, MH).
 */

const PILOT_DISTRICTS = Object.freeze([
  {
    id: 'DIST_AP_ATP',
    districtName: 'Anantapur',
    state: 'Andhra Pradesh',
    stateCode: 'AP',
    insuranceCluster: 'Cluster II (Rayalaseema)',
    assignedInsurer: {
      name: 'Agriculture Insurance Company of India (AIC)',
      shortCode: 'AIC',
      tollFree: '1800-116-515',
      claimsEmail: 'claims.ap@aicofindia.com',
      portalUrl: 'https://aicofindia.com',
    },
    districtNodalOfficer: {
      designation: 'Joint Director of Agriculture (JDA)',
      officeLocation: 'Collectorate Complex, Anantapur',
      contactPhone: '08554-220455',
    },
    subDistrictsOrMandals: [
      'Anantapur Urban',
      'Anantapur Rural',
      'Dharmavaram',
      'Kadiri',
      'Kalyandurg',
      'Gooty',
      'Tadipatri',
      'Penukonda',
      'Hindupur',
      'Uravakonda',
      'Madakasira',
      'Rayadurg',
    ],
    notifiedCrops: [
      { crop: 'groundnut', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 850 },
      { crop: 'redgram', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 620 },
      { crop: 'cotton', season: 'KHARIF', indemnityLevel: '70%', thresholdYieldKgHa: 1450 },
      { crop: 'paddy', season: 'KHARIF', indemnityLevel: '90%', thresholdYieldKgHa: 3200 },
      { crop: 'bengal_gram', season: 'RABI', indemnityLevel: '80%', thresholdYieldKgHa: 980 },
    ],
    weatherRadarStations: [
      { stationId: 'AWS_ATP_01', name: 'Anantapur IMD Agromet Station', type: 'DOPPLER_POLARIMETRIC', lat: 14.6819, lon: 77.6006 },
      { stationId: 'AWS_GOOTY_02', name: 'Gooty Doppler Telemetry Hub', type: 'AWS_RAIN_GAUGE', lat: 15.1167, lon: 77.6333 },
      { stationId: 'AWS_KADIRI_03', name: 'Kadiri South Catchment Monitor', type: 'AWS_RAIN_GAUGE', lat: 14.1167, lon: 78.1667 },
    ],
    activeAlerts: [
      { peril: 'inundation', severity: 'RED_ALERT', description: 'Heavy localized cyclonic depression resulting in field waterlogging' },
    ],
  },
  {
    id: 'DIST_MH_AMR',
    districtName: 'Amravati',
    state: 'Maharashtra',
    stateCode: 'MH',
    insuranceCluster: 'Vidarbha Cluster III',
    assignedInsurer: {
      name: 'HDFC ERGO General Insurance Co. Ltd.',
      shortCode: 'HDFC_ERGO',
      tollFree: '1800-266-0700',
      claimsEmail: 'pmfby.support@hdfcergo.com',
      portalUrl: 'https://hdfcergo.com/pmfby',
    },
    districtNodalOfficer: {
      designation: 'District Superintending Agriculture Officer (SDAO)',
      officeLocation: 'Kisan Bhawan, Camp, Amravati',
      contactPhone: '0721-2662341',
    },
    subDistrictsOrMandals: [
      'Amravati',
      'Achalpur',
      'Chandur Bazar',
      'Warud',
      'Morshi',
      'Daryapur',
      'Anjangaon Surji',
      'Nandgaon Khandeshwar',
      'Teosa',
      'Dhamangaon Railway',
      'Chikhaldara',
    ],
    notifiedCrops: [
      { crop: 'cotton', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 1350 },
      { crop: 'soybean', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 1680 },
      { crop: 'pigeonpea', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 890 },
      { crop: 'jowar', season: 'KHARIF', indemnityLevel: '70%', thresholdYieldKgHa: 1200 },
      { crop: 'gram', season: 'RABI', indemnityLevel: '80%', thresholdYieldKgHa: 1050 },
      { crop: 'wheat', season: 'RABI', indemnityLevel: '90%', thresholdYieldKgHa: 2400 },
    ],
    weatherRadarStations: [
      { stationId: 'AWS_AMR_01', name: 'Amravati IMD Doppler Radar', type: 'DOPPLER_S_BAND', lat: 20.9374, lon: 77.7796 },
      { stationId: 'AWS_ACH_02', name: 'Achalpur Agromet Station', type: 'AWS_RAIN_GAUGE', lat: 21.2575, lon: 77.5085 },
      { stationId: 'AWS_MOR_03', name: 'Morshi Citrus Belt Sensor Grid', type: 'AWS_RAIN_GAUGE', lat: 21.3167, lon: 78.0167 },
    ],
    activeAlerts: [
      { peril: 'hailstorm', severity: 'ORANGE_ALERT', description: 'Severe pre-winter squall line and localized hailstones recorded aloft' },
    ],
  },
  {
    id: 'DIST_HR_ROH',
    districtName: 'Rohtak',
    state: 'Haryana',
    stateCode: 'HR',
    insuranceCluster: 'Haryana Zone II',
    assignedInsurer: {
      name: 'SBI General Insurance Co. Ltd.',
      shortCode: 'SBI_GEN',
      tollFree: '1800-102-1111',
      claimsEmail: 'pmfby.claims@sbigeneral.in',
      portalUrl: 'https://sbigeneral.in',
    },
    districtNodalOfficer: {
      designation: 'Deputy Director of Agriculture (DDA)',
      officeLocation: 'Krishi Bhawan, Rohtak',
      contactPhone: '01262-278144',
    },
    subDistrictsOrMandals: ['Rohtak', 'Sampla', 'Meham', 'Kalanaur'],
    notifiedCrops: [
      { crop: 'mustard', season: 'RABI', indemnityLevel: '85%', thresholdYieldKgHa: 1850 },
      { crop: 'wheat', season: 'RABI', indemnityLevel: '90%', thresholdYieldKgHa: 4800 },
      { crop: 'paddy', season: 'KHARIF', indemnityLevel: '90%', thresholdYieldKgHa: 3600 },
      { crop: 'bajra', season: 'KHARIF', indemnityLevel: '80%', thresholdYieldKgHa: 2100 },
    ],
    weatherRadarStations: [
      { stationId: 'AWS_ROH_01', name: 'Rohtak Agromet Radar Unit', type: 'DOPPLER_C_BAND', lat: 28.8955, lon: 76.6066 },
    ],
    activeAlerts: [
      { peril: 'frost', severity: 'YELLOW_ALERT', description: 'Ground frost and localized unseasonal chilling injury' },
    ],
  },
]);

class PilotDistrictsService {
  constructor(districts = PILOT_DISTRICTS) {
    this.districts = districts;
  }

  getAllDistricts() {
    return this.districts;
  }

  getDistrictById(id) {
    return this.districts.find((d) => d.id === id || d.districtName.toLowerCase() === String(id).toLowerCase()) || null;
  }

  getDistrictByNameAndState(name, state) {
    const cleanName = String(name || '').trim().toLowerCase();
    const cleanState = String(state || '').trim().toLowerCase();
    return (
      this.districts.find(
        (d) =>
          d.districtName.toLowerCase() === cleanName &&
          (!cleanState || d.state.toLowerCase() === cleanState)
      ) || null
    );
  }
}

module.exports = {
  PilotDistrictsService,
  PILOT_DISTRICTS,
};
