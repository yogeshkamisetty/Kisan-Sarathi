/**
 * Localized Spoken Labels for Canonical Field Values
 *
 * Extraction normalises what the farmer said into canonical English keys (`paddy`,
 * `hailstorm`, `STANDING`) so validation and policy matching stay deterministic. The
 * voice readback, however, is the farmer's only chance to catch a mistake before the
 * draft is finalised — reading "paddy" and "hailstorm" into an otherwise Hindi sentence
 * defeats that check for exactly the farmers this app exists for.
 *
 * Every label below is the term already used by the extraction lexicon for that language,
 * so what the farmer hears matches the words they would have spoken.
 */

const { CropStage, AreaUnit } = require('../../../../packages/shared-types/src/index.js');

const SUPPORTED_READBACK_LANGUAGES = Object.freeze([
  'hi-IN',
  'te-IN',
  'ta-IN',
  'kn-IN',
  'ml-IN',
  'en-IN',
]);

const CROP_LABELS = Object.freeze({
  paddy: {
    'hi-IN': 'धान',
    'te-IN': 'వరి',
    'ta-IN': 'நெல்',
    'kn-IN': 'ಭತ್ತ',
    'ml-IN': 'നെല്ല്',
    'en-IN': 'paddy',
  },
  wheat: {
    'hi-IN': 'गेहूँ',
    'te-IN': 'గోధుమ',
    'ta-IN': 'கோதுமை',
    'kn-IN': 'ಗೋಧಿ',
    'ml-IN': 'ഗോതമ്പ്',
    'en-IN': 'wheat',
  },
  cotton: {
    'hi-IN': 'कपास',
    'te-IN': 'పత్తి',
    'ta-IN': 'பருத்தி',
    'kn-IN': 'ಹತ್ತಿ',
    'ml-IN': 'പരുത്തി',
    'en-IN': 'cotton',
  },
  maize: {
    'hi-IN': 'मक्का',
    'te-IN': 'మొక్కజొన్న',
    'ta-IN': 'மக்காச்சோளம்',
    'kn-IN': 'ಮೆಕ್ಕೆಜೋಳ',
    'ml-IN': 'ചോളം',
    'en-IN': 'maize',
  },
  soybean: {
    'hi-IN': 'सोयाबीन',
    'te-IN': 'సోయాబీన్',
    'ta-IN': 'சோயாபீன்',
    'kn-IN': 'ಸೋಯಾಬೀನ್',
    'ml-IN': 'സോയാബീൻ',
    'en-IN': 'soybean',
  },
  groundnut: {
    'hi-IN': 'मूंगफली',
    'te-IN': 'వేరుశనగ',
    'ta-IN': 'நிலக்கடலை',
    'kn-IN': 'ಶೇಂಗಾ',
    'ml-IN': 'നിലക്കടല',
    'en-IN': 'groundnut',
  },
  sugarcane: {
    'hi-IN': 'गन्ना',
    'te-IN': 'చెరకు',
    'ta-IN': 'கரும்பு',
    'kn-IN': 'ಕಬ್ಬು',
    'ml-IN': 'കരിമ്പ്',
    'en-IN': 'sugarcane',
  },
  chilli: {
    'hi-IN': 'मिर्च',
    'te-IN': 'మిర్చి',
    'ta-IN': 'மிளகாய்',
    'kn-IN': 'ಮೆಣಸಿನಕಾಯಿ',
    'ml-IN': 'മുളക്',
    'en-IN': 'chilli',
  },
  mustard: {
    'hi-IN': 'सरसों',
    'te-IN': 'ఆవాలు',
    'ta-IN': 'கடுகு',
    'kn-IN': 'ಸಾಸಿವೆ',
    'ml-IN': 'കടുക്',
    'en-IN': 'mustard',
  },
});

const LOSS_EVENT_LABELS = Object.freeze({
  hailstorm: {
    'hi-IN': 'ओलावृष्टि',
    'te-IN': 'వడగళ్ల వాన',
    'ta-IN': 'ஆலங்கட்டி மழை',
    'kn-IN': 'ಆಲಿಕಲ್ಲು ಮಳೆ',
    'ml-IN': 'ആലിപ്പഴ വർഷം',
    'en-IN': 'hailstorm',
  },
  inundation: {
    'hi-IN': 'जलभराव',
    'te-IN': 'ముంపు',
    'ta-IN': 'வெள்ளம்',
    'kn-IN': 'ಜಲಾವೃತ',
    'ml-IN': 'വെള്ളക്കെട്ട്',
    'en-IN': 'inundation',
  },
  unseasonal_rain: {
    'hi-IN': 'बेमौसम भारी बारिश',
    'te-IN': 'అకాల భారీ వర్షం',
    'ta-IN': 'பருவமற்ற கனமழை',
    'kn-IN': 'ಅಕಾಲಿಕ ಭಾರಿ ಮಳೆ',
    'ml-IN': 'അകാല കനത്ത മഴ',
    'en-IN': 'unseasonal heavy rain',
  },
  cyclonic_rain: {
    'hi-IN': 'चक्रवाती बारिश',
    'te-IN': 'తుఫాను వర్షం',
    'ta-IN': 'புயல் மழை',
    'kn-IN': 'ಚಂಡಮಾರುತ ಮಳೆ',
    'ml-IN': 'ചുഴലിക്കാറ്റ് മഴ',
    'en-IN': 'cyclonic rain',
  },
  landslide: {
    'hi-IN': 'भूस्खलन',
    'te-IN': 'కొండచరియలు విరిగిపడటం',
    'ta-IN': 'நிலச்சரிவு',
    'kn-IN': 'ಭೂಕುಸಿತ',
    'ml-IN': 'മണ്ണിടിച്ചിൽ',
    'en-IN': 'landslide',
  },
  cloudburst: {
    'hi-IN': 'बादल फटना',
    'te-IN': 'మేఘ విస్ఫోటనం',
    'ta-IN': 'மேகவெடிப்பு',
    'kn-IN': 'ಮೇಘಸ್ಫೋಟ',
    'ml-IN': 'മേഘവിസ്ഫോടനം',
    'en-IN': 'cloudburst',
  },
  natural_fire_lightning: {
    'hi-IN': 'आकाशीय बिजली से प्राकृतिक आग',
    'te-IN': 'పిడుగు వల్ల సహజ అగ్ని',
    'ta-IN': 'மின்னலால் ஏற்பட்ட இயற்கை தீ',
    'kn-IN': 'ಸಿಡಿಲಿನಿಂದ ಸಹಜ ಬೆಂಕಿ',
    'ml-IN': 'മിന്നലേറ്റ സ്വാഭാവിക തീ',
    'en-IN': 'natural fire from lightning',
  },
});

const CROP_STAGE_LABELS = Object.freeze({
  [CropStage.STANDING]: {
    'hi-IN': 'खेत में खड़ी फसल',
    'te-IN': 'పొలంలో నిలబడి ఉన్న పంట',
    'ta-IN': 'வயலில் நின்ற பயிர்',
    'kn-IN': 'ಹೊಲದಲ್ಲಿ ನಿಂತ ಬೆಳೆ',
    'ml-IN': 'വയലിൽ നിൽക്കുന്ന വിള',
    'en-IN': 'standing crop in the field',
  },
  [CropStage.HARVESTED_IN_FIELD_DRYING]: {
    'hi-IN': 'कटी हुई फसल जो खेत में सुखाने के लिए रखी थी',
    'te-IN': 'కోసి పొలంలో ఆరబెట్టిన పంట',
    'ta-IN': 'அறுவடை செய்து வயலில் உலர்த்த வைக்கப்பட்ட பயிர்',
    'kn-IN': 'ಕಟಾವು ಮಾಡಿ ಹೊಲದಲ್ಲಿ ಒಣಗಿಸಲು ಇಟ್ಟ ಬೆಳೆ',
    'ml-IN': 'കൊയ്ത് വയലിൽ ഉണക്കാൻ ഇട്ട വിള',
    'en-IN': 'harvested crop left in the field for drying',
  },
  [CropStage.HARVESTED_STORED]: {
    'hi-IN': 'कटी हुई फसल जो गोदाम या घर में रखी थी',
    'te-IN': 'కోసి గోదాములో నిల్వ చేసిన పంట',
    'ta-IN': 'அறுவடை செய்து சேமிக்கப்பட்ட பயிர்',
    'kn-IN': 'ಕಟಾವು ಮಾಡಿ ಸಂಗ್ರಹಿಸಿದ ಬೆಳೆ',
    'ml-IN': 'കൊയ്ത് സംഭരിച്ച വിള',
    'en-IN': 'harvested crop in storage',
  },
});

const AREA_UNIT_LABELS = Object.freeze({
  [AreaUnit.ACRE]: {
    'hi-IN': 'एकड़',
    'te-IN': 'ఎకరాలు',
    'ta-IN': 'ஏக்கர்',
    'kn-IN': 'ಎಕರೆ',
    'ml-IN': 'ഏക്കർ',
    'en-IN': 'acres',
  },
  [AreaUnit.HECTARE]: {
    'hi-IN': 'हेक्टेयर',
    'te-IN': 'హెక్టార్లు',
    'ta-IN': 'ஹெக்டேர்',
    'kn-IN': 'ಹೆಕ್ಟೇರ್',
    'ml-IN': 'ഹെക്ടർ',
    'en-IN': 'hectares',
  },
  [AreaUnit.BIGHA]: {
    'hi-IN': 'बीघा',
    'te-IN': 'బీఘా',
    'ta-IN': 'பிகா',
    'kn-IN': 'ಬೀಘಾ',
    'ml-IN': 'ബീഘ',
    'en-IN': 'bigha',
  },
  [AreaUnit.GUNTHA]: {
    'hi-IN': 'गुंठा',
    'te-IN': 'గుంఠా',
    'ta-IN': 'குந்தா',
    'kn-IN': 'ಗುಂಟೆ',
    'ml-IN': 'ഗുണ്ഠ',
    'en-IN': 'guntha',
  },
});

/** Month names, so a readback date is spoken rather than read out as "2026-11-03". */
const MONTH_LABELS = Object.freeze({
  'hi-IN': ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  'te-IN': ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'],
  'ta-IN': ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'],
  'kn-IN': ['ಜನವರಿ', 'ಫೆಬ್ರವರಿ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿಲ್', 'ಮೇ', 'ಜೂನ್', 'ಜುಲೈ', 'ಆಗಸ್ಟ್', 'ಸೆಪ್ಟೆಂಬರ್', 'ಅಕ್ಟೋಬರ್', 'ನವೆಂಬರ್', 'ಡಿಸೆಂಬರ್'],
  'ml-IN': ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'],
  'en-IN': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
});

/** Falls back to en-IN, then to the canonical value itself — never fabricates a label. */
function label(table, value, languageCode) {
  if (value === null || value === undefined || value === '') return null;
  const row = table[value];
  if (!row) return String(value);
  return row[languageCode] || row['en-IN'] || String(value);
}

function cropLabel(value, languageCode) {
  return label(CROP_LABELS, value, languageCode);
}

function lossEventLabel(value, languageCode) {
  return label(LOSS_EVENT_LABELS, value, languageCode);
}

function cropStageLabel(value, languageCode) {
  return label(CROP_STAGE_LABELS, value, languageCode);
}

function areaUnitLabel(value, languageCode) {
  return label(AREA_UNIT_LABELS, String(value || '').toLowerCase(), languageCode);
}

/**
 * Renders a YYYY-MM-DD date as a spoken date in the farmer's language.
 * Anything that is not a plain date is returned unchanged.
 */
function spokenDate(value, languageCode) {
  const raw = String(value || '');
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw || null;
  const [, year, month, day] = m;
  const months = MONTH_LABELS[languageCode] || MONTH_LABELS['en-IN'];
  const monthName = months[Number(month) - 1];
  if (languageCode === 'en-IN') return `${Number(day)} ${monthName} ${year}`;
  return `${Number(day)} ${monthName} ${year}`;
}

module.exports = {
  SUPPORTED_READBACK_LANGUAGES,
  CROP_LABELS,
  LOSS_EVENT_LABELS,
  CROP_STAGE_LABELS,
  AREA_UNIT_LABELS,
  MONTH_LABELS,
  cropLabel,
  lossEventLabel,
  cropStageLabel,
  areaUnitLabel,
  spokenDate,
};
