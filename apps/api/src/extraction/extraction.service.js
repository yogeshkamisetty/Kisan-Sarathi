/**
 * Schema-Constrained Agricultural Information Extraction Engine
 *
 * Rules enforced (Section 11):
 * 1. Extracts only facts supported by the transcript or farmer-entered statement.
 * 2. Never fabricates missing fields (missing fields have value: null, confidence: 0, status: 'missing').
 * 3. Preserves original transcript and exact source_text span for every extracted value.
 * 4. Marks all extracted fields as 'needs_confirmation' or 'approximate' — never 'confirmed' without farmer confirmation.
 * 5. Supports Hindi, Telugu, Tamil, Kannada, Malayalam, English, and Hinglish code-switching.
 */
const {
  CropStage,
  AreaUnit,
  FieldExtractionStatus,
} = require('../../../../packages/shared-types/src/index.js');
const { validateExtractionSchema } = require('../../../../packages/validation/src/index.js');
const { istDateString, istDateStringOffset } = require('../common/ist-time.js');

/**
 * Builds a case-insensitive regex that matches any of the given alternatives as a whole
 * word, for scripts with no spaces-only word separation.
 *
 * ASCII `\b` does not work against Devanagari, Telugu, Tamil, Kannada or Malayalam text,
 * so a bare /कल/ also matches inside "आजकल" (nowadays) or "बिलकुल" (absolutely). The
 * lookarounds below treat any letter or combining mark as part of a word instead.
 */
function unicodeWord(alternatives) {
  return new RegExp(`(?<![\\p{L}\\p{M}])(${alternatives})(?![\\p{L}\\p{M}])`, 'iu');
}

/**
 * Future-tense and explicit "tomorrow" markers. Their presence means a relative day word
 * must not be read as a past date.
 */
const HINDI_FUTURE_MARKERS =
  /(\btomorrow\b|आने वाले|होगा|होगी|होंगे|आएगा|आएगी|आयेगा|पड़ेगा|करेंगे|रहेगा|अगले)/iu;

const CROP_LEXICON = [
  { canonical: 'paddy', patterns: [/\bpaddy\b/i, /\brice\b/i, /धान/, /వరి/, /நெல்/, /ಭತ್ತ/, /നെല്ല്/, /\bdhaan\b/i] },
  { canonical: 'wheat', patterns: [/\bwheat\b/i, /गेहूँ/, /गेहूं/, /గోధుమ/, /கோதுமை/, /ಗೋಧಿ/, /\bgehu\b/i] },
  { canonical: 'cotton', patterns: [/\bcotton\b/i, /कपास/, /పత్తి/, /பருத்தி/, /ಹತ್ತಿ/, /\bkapas\b/i] },
  { canonical: 'maize', patterns: [/\bmaize\b/i, /\bcorn\b/i, /मक्का/, /మొక్కజొన్న/, /மக்காச்சோளம்/, /ಮೆಕ್ಕೆಜೋಳ/] },
  { canonical: 'soybean', patterns: [/\bsoybean\b/i, /\bsoya\b/i, /सोयाबीन/, /సోయాబీన్/] },
  { canonical: 'groundnut', patterns: [/\bgroundnut\b/i, /\bpeanut\b/i, /मूंगफली/, /వేరుశనగ/, /நிலக்கடலை/] },
  { canonical: 'sugarcane', patterns: [/\bsugarcane\b/i, /गन्ना/, /చెరకు/, /கரும்பு/] },
  { canonical: 'chilli', patterns: [/\bchilli\b/i, /\bchili\b/i, /मिर्च/, /మిర్చి/, /மிளகாய்/] },
  { canonical: 'mustard', patterns: [/\bmustard\b/i, /सरसों/, /ఆవాలు/, /கடுகு/, /ಸಾಸಿವೆ/, /\bsarson\b/i] },
  { canonical: 'chickpea', patterns: [/\bgram\b/i, /\bchickpea\b/i, /चना/, /శనగ/, /கொண்டைக்கடலை/, /ಕಡಲೆ/, /\bchana\b/i] },
  { canonical: 'pearl_millet', patterns: [/\bbajra\b/i, /\bmillet\b/i, /बाजरा/, /సజ్జ/, /கம்பு/, /ಸಜ್ಜೆ/] },
  { canonical: 'sorghum', patterns: [/\bjowar\b/i, /\bsorghum\b/i, /ज्वार/, /జొన్న/, /சோளம்/, /ಜೋಳ/] },
  { canonical: 'pigeon_pea', patterns: [/\barhar\b/i, /\btur\b/i, /\bpulses\b/i, /अरहर/, /तूर/, /दाल/, /కందులు/, /துவரை/, /ತೊಗರಿ/] },
  { canonical: 'potato', patterns: [/\bpotato\b/i, /आलू/, /బంగాళాదుంప/, /உருளைக்கிழங்கு/, /ಆಲೂಗಡ್ಡೆ/, /\baaloo\b/i] },
  { canonical: 'onion', patterns: [/\bonion\b/i, /प्याज/, /ఉల్లిపాయ/, /வெங்காயம்/, /ಈರುಳ್ಳಿ/, /\bpyaz\b/i] },
];

const LOSS_EVENT_LEXICON = [
  { canonical: 'hailstorm', patterns: [/\bhailstorm\b/i, /\bhail\b/i, /ओलावृष्टि/, /ओले/, /వడగళ్ల/, /వడగళ్ళ/, /ஆலங்கட்டி/, /ಆಲಿಕಲ್ಲು/, /ആലിപ്പഴം/, /\bola\b/i] },
  { canonical: 'inundation', patterns: [/\binundation\b/i, /\bwaterlogging\b/i, /\bflood\b/i, /जलभराव/, /बाढ़/, /पानी भर/, /ముంపు/, /వరద/, /வெள்ளம்/, /ಜಲಾವೃತ/] },
  { canonical: 'unseasonal_rain', patterns: [/\bunseasonal rain\b/i, /\bheavy rain\b/i, /\bcyclonic rain\b/i, /भारी बारिश/, /बेमौसम बारिश/, /अतिवृष्टि/, /భారీ వర్షం/, /अकाली वर्షం/, /கனமழை/, /ಭಾರಿ ಮಳೆ/, /കനത്ത മഴ/, /\bbarish\b/i] },
  { canonical: 'landslide', patterns: [/\blandslide\b/i, /भूस्खलन/, /కొండచరియలు/, /நிலச்சரிவு/] },
  { canonical: 'cloudburst', patterns: [/\bcloudburst\b/i, /बादल फटना/, /बादल फटने/, /మేఘవిస్ఫోటనం/] },
  { canonical: 'natural_fire_lightning', patterns: [/\blightning\b/i, /\bnatural fire\b/i, /आकाशीय बिजली/, /बिजली गिरने/, /పిడుగు/] },
];

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'दस': 10,
  'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'ஒரு': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4,
  'ഒന്ന്': 1, 'രണ്ട്': 2, 'മൂന്ന്': 3,
});

class InformationExtractionService {
  /**
   * @param {object} options
   * @param {string|null} options.referenceDateIso Fixes "now" for deterministic tests and
   *   the synthetic demo. Left null in production so relative dates such as "yesterday"
   *   resolve against the actual current time rather than a date baked in at build time.
   */
  constructor({ referenceDateIso = null } = {}) {
    this.referenceDateIso = referenceDateIso;
  }

  extractFields({ transcript, existingFields = {}, referenceDateIso = null }) {
    const text = String(transcript || '').trim();
    // Resolved per call: a long-lived service instance must not freeze "today".
    const refDate = new Date(referenceDateIso || this.referenceDateIso || Date.now());

    const raw = {
      crop: this._extractCrop(text),
      loss_event: this._extractLossEvent(text),
      incident_date: this._extractIncidentDate(text, refDate),
      incident_time: this._extractIncidentTime(text),
      crop_stage: this._extractCropStage(text),
      cultivated_area: this._extractCultivatedArea(text),
      affected_area: this._extractAffectedArea(text),
      village: this._extractVillage(text),
      survey_number: this._extractSurveyNumber(text),
      insured_status: this._extractInsuredStatus(text),
      application_number: this._extractApplicationNumber(text),
    };

    const validated = validateExtractionSchema(raw);
    return {
      transcriptPreserved: text,
      extracted: validated.sanitized,
      schemaValidationErrors: validated.errors,
    };
  }

  _emptyField() {
    return {
      value: null,
      unit: null,
      confidence: 0,
      source_text: null,
      status: FieldExtractionStatus.MISSING,
    };
  }

  _extractCrop(text) {
    for (const item of CROP_LEXICON) {
      for (const regex of item.patterns) {
        const match = text.match(regex);
        if (match) {
          return {
            value: item.canonical,
            confidence: 0.97,
            source_text: match[0],
            status: FieldExtractionStatus.NEEDS_CONFIRMATION,
          };
        }
      }
    }
    return this._emptyField();
  }

  _extractLossEvent(text) {
    for (const item of LOSS_EVENT_LEXICON) {
      for (const regex of item.patterns) {
        const match = text.match(regex);
        if (match) {
          return {
            value: item.canonical,
            confidence: 0.95,
            source_text: match[0],
            status: FieldExtractionStatus.NEEDS_CONFIRMATION,
          };
        }
      }
    }
    return this._emptyField();
  }

  _extractIncidentDate(text, refDate) {
    // Explicit ISO date YYYY-MM-DD
    const isoMatch = text.match(/\b(202\d-\d{2}-\d{2})\b/);
    if (isoMatch) {
      return {
        value: isoMatch[1],
        confidence: 0.98,
        source_text: isoMatch[1],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // "Day before yesterday" is checked before "yesterday", because the Tamil phrase
    // "நேற்று முன் தினம்" contains the Tamil word for yesterday.
    const dayBeforeRegex = unicodeWord(
      'day before yesterday|परसों|मोन्न|మొన్న|நேற்று முன் தினம்|முன்தினம்|ಮೊನ್ನೆ|മിന്നാന്ന്|pars[oō]n'
    );
    const dbMatch = text.match(dayBeforeRegex);
    if (dbMatch) {
      return {
        value: istDateStringOffset(refDate, -2),
        confidence: 0.92,
        source_text: dbMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // Unambiguous "yesterday" in every supported language except Hindi/Hinglish.
    const yesterdayRegex = unicodeWord('yesterday|నిన్న|நேற்று|ನಿನ್ನೆ|ഇന്നലെ');
    const yMatch = text.match(yesterdayRegex);
    if (yMatch) {
      return {
        value: istDateStringOffset(refDate, -1),
        confidence: 0.94,
        source_text: yMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // Today patterns. Word-bounded so "आजकल" (nowadays) does not read as "आज" (today).
    const todayRegex = unicodeWord('today|आज|ఈరోజు|இன்று|ಇಂದು|ഇന്ന്|aaj');
    const tMatch = text.match(todayRegex);
    if (tMatch) {
      return {
        value: istDateString(refDate),
        confidence: 0.95,
        source_text: tMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    /**
     * Hindi "कल" (and Hinglish "kal") means BOTH yesterday and tomorrow; only context
     * distinguishes them. Dating an incident a day wrong can push a farmer outside the
     * 72-hour PMFBY window, so this is never resolved silently:
     *   - an explicit future marker means no date is extracted at all
     *   - otherwise the past reading is offered at low confidence, flagged as ambiguous
     *     so the readback asks the farmer to confirm the actual date
     */
    const kalRegex = unicodeWord('कल|kal');
    const kalMatch = text.match(kalRegex);
    if (kalMatch) {
      if (HINDI_FUTURE_MARKERS.test(text)) {
        return this._emptyField();
      }
      return {
        value: istDateStringOffset(refDate, -1),
        confidence: 0.62,
        source_text: kalMatch[0],
        status: FieldExtractionStatus.UNCERTAIN,
        ambiguous: true,
        ambiguityReason:
          'AMBIGUOUS_RELATIVE_DAY: "कल" can mean yesterday or tomorrow. Interpreted as yesterday; the farmer must confirm the exact date.',
      };
    }

    return this._emptyField();
  }

  _extractIncidentTime(text) {
    const patterns = [
      { value: 'evening (approx. 17:00-20:00)', regex: /(\bevening\b|शाम|సాయంత్రం|மாலை|ಸಂಜೆ|വൈകുന്നേരം|\bshaam\b)/i },
      { value: 'morning (approx. 06:00-10:00)', regex: /(\bmorning\b|सुबह|ఉదయం|காலை|ಬೆಳಿಗ್ಗೆ|രാവിലെ|\bsubah\b)/i },
      { value: 'night (approx. 20:00-04:00)', regex: /(\bnight\b|रात|రాత్రి|இரவு|ರಾತ್ರಿ|രാത്രി|\braat\b)/i },
      { value: 'afternoon (approx. 12:00-16:00)', regex: /(\bafternoon\b|दोपहर|మధ్యాహ్నం|மதியம்|\bdopahar\b)/i },
    ];
    for (const p of patterns) {
      const m = text.match(p.regex);
      if (m) {
        return {
          value: p.value,
          confidence: 0.9,
          source_text: m[0],
          status: FieldExtractionStatus.APPROXIMATE,
        };
      }
    }
    return this._emptyField();
  }

  _extractCropStage(text) {
    // Post-harvest cut and spread for drying in field
    const dryingRegex = /(cut and spread|left in.*field.*drying|harvested.*drying|काट कर खेत में सुखाने|कटी हुई फसल खेत में|सूखने के लिए|కోసి పొలంలో ఆరబెట్టిన|அறுவடை செய்து உலர்த்த)/i;
    const dMatch = text.match(dryingRegex);
    if (dMatch) {
      return {
        value: CropStage.HARVESTED_IN_FIELD_DRYING,
        confidence: 0.95,
        source_text: dMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // Stored in warehouse/godown
    const storedRegex = /(stored in godown|warehouse|गोदाम में|घर में रखी)/i;
    const sMatch = text.match(storedRegex);
    if (sMatch) {
      return {
        value: CropStage.HARVESTED_STORED,
        confidence: 0.93,
        source_text: sMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // Standing crop
    const standingRegex = /(\bstanding\b|खड़ी फसल|खेत में खड़ी|నిలబడి ఉన్న పంట|పొలంలో ఉన్న పంట|நிற்கும் பயிர்|ನಿಂತಿರುವ ಬೆಳೆ|\bkhadi\b)/i;
    const stMatch = text.match(standingRegex);
    if (stMatch) {
      return {
        value: CropStage.STANDING,
        confidence: 0.96,
        source_text: stMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    return this._emptyField();
  }

  _extractAffectedArea(text) {
    const unitMap = [
      { unit: AreaUnit.ACRE, regex: /(acres?|एकड़|ఎకరాలు|ఎకరాల|ஏக்கர்|ಎಕರೆ|ഏക്കർ|\bacre\b)/i },
      { unit: AreaUnit.HECTARE, regex: /(hectares?|हेक्टेयर|హెక్టార్లు|ஹெக்டேர்|ಹೆಕ್ಟೇರ್)/i },
      { unit: AreaUnit.BIGHA, regex: /(bighas?|बीघा)/i },
      { unit: AreaUnit.GUNTHA, regex: /(gunthas?|गुंठा|గుంటలు)/i },
    ];

    // Check explicit digit + unit (excluding "total land is X acres" when matched separately)
    const digitUnitRegex = /(?:damaged|affected|नुकसान|खराब|నష్టపోయింది|damage)?[^.\d]*?(\d+(?:\.\d+)?)\s*(acres?|एकड़|ఎకరాలు|ఎకరాల|ஏக்கர்|ಎಕರೆ|ഏക്കർ|hectares?|हेक्टेयर|bighas?|बीघा|gunthas?|गुंठा)/i;
    const mDigit = text.match(digitUnitRegex);
    if (mDigit) {
      const val = Number(mDigit[1]);
      const rawUnit = mDigit[2];
      let resolvedUnit = AreaUnit.ACRE;
      for (const u of unitMap) {
        if (u.regex.test(rawUnit)) resolvedUnit = u.unit;
      }
      return {
        value: val,
        unit: resolvedUnit,
        confidence: 0.98,
        source_text: mDigit[0].trim(),
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    // Check number words + unit
    for (const [word, num] of Object.entries(NUMBER_WORDS)) {
      for (const u of unitMap) {
        const pattern = new RegExp(`(${word})\\s*${u.regex.source}`, 'i');
        const mWord = text.match(pattern);
        if (mWord) {
          return {
            value: num,
            unit: u.unit,
            confidence: 0.96,
            source_text: mWord[0].trim(),
            status: FieldExtractionStatus.NEEDS_CONFIRMATION,
          };
        }
      }
    }

    return this._emptyField();
  }

  _extractCultivatedArea(text) {
    const totalRegex = /(?:total|कुल|మొత్తం)[^.\d]*?(\d+(?:\.\d+)?)\s*(acres?|एकड़|हेक्टेयर|hectares?|bighas?|बीघा)/i;
    const m = text.match(totalRegex);
    if (m) {
      return {
        value: Number(m[1]),
        unit: /hectare|हेक्टेयर/i.test(m[2]) ? AreaUnit.HECTARE : AreaUnit.ACRE,
        confidence: 0.95,
        source_text: m[0].trim(),
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }
    return this._emptyField();
  }

  _extractVillage(text) {
    const patterns = [
      /(?:village\s+is|in\s+village|village)\s+([A-Z][a-zA-Z]+)(?!\s+is\b)/i,
      /([A-Z][a-zA-Z]+)\s+village\b/i,
      /(?:गाँव|गांव)\s+([^\s,।.]+)(?:\s+है)?/,
      /([^\s,।.]+)\s+(?:गाँव|गांव)(?:\s+में|\s+से)?/,
      /(?:గ్రామం)\s+([^\s,.]+)/,
      /([^\s,.]+)\s+(?:గ్రామం|గ్రామంలో)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1] && !['this', 'my', 'इस', 'मेरा', 'है', 'में', 'से'].includes(m[1].toLowerCase())) {
        return {
          value: m[1].trim(),
          confidence: 0.92,
          source_text: m[0].trim(),
          status: FieldExtractionStatus.NEEDS_CONFIRMATION,
        };
      }
    }
    return this._emptyField();
  }

  _extractSurveyNumber(text) {
    if (/(don't know.*survey|do not know.*survey|survey.*not available|abhi yaad nahi|याद नहीं|पता नहीं|తెలియదు)/i.test(text)) {
      return this._emptyField();
    }
    const m = text.match(/(?:survey\s*(?:number|no\.?)|सर्वे\s*नंबर|खसरा\s*नंबर|సర్వే\s*నంబర్)\s*[:#-]?\s*([A-Za-z0-9/-]+)/i);
    if (m && m[1]) {
      return {
        value: m[1],
        confidence: 0.94,
        source_text: m[0].trim(),
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }
    return this._emptyField();
  }

  _extractInsuredStatus(text) {
    // A negative answer must be checked first, so "बीमा नहीं है" is not read as insured
    // by the affirmative pattern below.
    const NOT_INSURED =
      /(not insured|no insurance|बीमा नहीं|बीमा नहीं करवाया|बीमा नहीं है|బీమా లేదు|காப்பீடு இல்லை|ವಿಮೆ ಇಲ್ಲ|ഇൻഷുറൻസ് ഇല്ല)/i;
    const notInsuredMatch = text.match(NOT_INSURED);
    if (notInsuredMatch) {
      return {
        value: 'NOT_INSURED',
        confidence: 0.9,
        source_text: notInsuredMatch[0],
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }

    /**
     * Affirmative phrasing varies a lot in speech ("बीमा है", "बीमा करवाया है",
     * "बीमा करवाया हुआ है", "बीमा कराया था"), so the verb is matched loosely rather than
     * as one fixed sentence.
     */
    const INSURED =
      /(insured under pmfby|pmfby insured|\bis insured\b|crop insurance (?:is )?(?:taken|done)|(?:फसल\s*)?बीमा\s*(?:करवा(?:या|ई)|करा(?:या|ई)|कर लिया)?\s*(?:हुआ\s*)?(?:है|था|हूँ)|బీమా (?:ఉంది|చేయించాను)|காப்பீடு (?:உள்ளது|செய்துள்ளேன்)|ವಿಮೆ (?:ಇದೆ|ಮಾಡಿಸಿದ್ದೇನೆ)|ഇൻഷുറൻസ് (?:ഉണ്ട്|എടുത്തിട്ടുണ്ട്))/i;
    const m = text.match(INSURED);
    if (m) {
      return {
        value: 'YES_INSURED',
        confidence: 0.94,
        source_text: m[0].trim(),
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }
    return this._emptyField();
  }

  _extractApplicationNumber(text) {
    const m = text.match(/(?:application\s*(?:number|no\.?)|पॉलिसी\s*नंबर|आवेदन\s*संख्या)\s*[:#-]?\s*([A-Za-z0-9-]{6,24})/i);
    if (m && m[1]) {
      return {
        value: m[1],
        confidence: 0.95,
        source_text: m[0].trim(),
        status: FieldExtractionStatus.NEEDS_CONFIRMATION,
      };
    }
    return this._emptyField();
  }
}

module.exports = { InformationExtractionService };
