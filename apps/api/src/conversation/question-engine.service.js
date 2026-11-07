/**
 * Dynamic Question Selection Engine (Deterministic State Machine)
 *
 * Rules (Section 5.3 & Section 9):
 * - Never forces farmers through a fixed sequence of every question.
 * - Reads currently captured/confirmed fields and asks only for the highest-priority missing or uncertain field.
 * - Priority order: incident_date -> village -> crop -> loss_event -> crop_stage -> affected_area -> insured_status -> optional (survey_number / application_number).
 * - Allows partial draft preparation immediately once critical fields are captured, even if survey_number is unknown.
 */
const { FieldExtractionStatus } = require('../../../../packages/shared-types/src/index.js');

const QUESTION_PRIORITY_ORDER = Object.freeze([
  { field: 'crop', critical: true },
  { field: 'loss_event', critical: true },
  { field: 'incident_date', critical: true },
  { field: 'village', critical: true },
  { field: 'affected_area', critical: true },
  { field: 'crop_stage', critical: true },
  { field: 'insured_status', critical: false },
  { field: 'survey_number', critical: false, skippableForInitialDraft: true },
  { field: 'application_number', critical: false, skippableForInitialDraft: true },
]);

const LOCALIZED_QUESTIONS = Object.freeze({
  crop: {
    'hi-IN': 'आपकी कौन सी फसल को नुकसान हुआ है? (जैसे धान, गेहूँ, कपास)',
    'te-IN': 'మీ ఏ పంటకు నష్టం జరిగింది? (ఉదాహరణకు వరి, పత్తి, మొక్కజొన్న)',
    'ta-IN': 'உங்கள் எந்தப் பயிருக்கு சேதம் ஏற்பட்டது? (எ.கா. நெல், பருத்தி)',
    'kn-IN': 'ನಿಮ್ಮ ಯಾವ ಬೆಳೆಗೆ ಹಾನಿಯಾಗಿದೆ? (ಉದಾ: ಭತ್ತ, ಹತ್ತಿ)',
    'ml-IN': 'നിങ്ങളുടെ ഏത് വിളയ്ക്കാണ് നാശനഷ്ടം സംഭവിച്ചത്?',
    'en-IN': 'Which crop was damaged? (For example: paddy, wheat, or cotton)',
  },
  loss_event: {
    'hi-IN': 'फसल को नुकसान किस कारण से हुआ? (जैसे ओलावृष्टि, भारी बारिश, जलभराव या भूस्खलन)',
    'te-IN': 'పంట నష్టం ఏ కారణం వల్ల జరిగింది? (ఉదా: వడగళ్ల వాన, భారీ వర్షం, ముంపు)',
    'ta-IN': 'பயிர் சேதம் எதனால் ஏற்பட்டது? (ஆலங்கட்டி மழை, கனமழை, வெள்ளம்)',
    'kn-IN': 'ಬೆಳೆ ಹಾನಿ ಯಾವ ಕಾರಣದಿಂದ ಆಯಿತು? (ಆಲಿಕಲ್ಲು ಮಳೆ, ಭಾರಿ ಮಳೆ, ಜಲಾವೃತ)',
    'ml-IN': 'എന്തുകൊണ്ടാണ് വിള നാശം സംഭവിച്ചത്? (ആലിപ്പഴം, കനത്ത മഴ, വെള്ളക്കെട്ട്)',
    'en-IN': 'What caused the crop damage? (For example: hailstorm, heavy rain, inundation, or landslide)',
  },
  incident_date: {
    'hi-IN': 'यह नुकसान किस तारीख या किस दिन हुआ? (जैसे कल शाम या आज सुबह)',
    'te-IN': 'ఈ పంట నష్టం ఎప్పుడు జరిగింది? (ఉదాహరణకు నిన్న సాయంత్రం లేదా ఈరోజు)',
    'ta-IN': 'இந்த சேதம் எப்போது ஏற்பட்டது? (நேற்று மாலை அல்லது இன்று காலை)',
    'kn-IN': 'ಈ ಹಾನಿ ಯಾವಾಗ ಸಂಭವಿಸಿತು? (ನಿನ್ನೆ ಸಂಜೆ ಅಥವಾ ಇಂದು ಬೆಳಿಗ್ಗೆ)',
    'ml-IN': 'ഈ നാശനഷ്ടം എപ്പോഴാണ് സംഭവിച്ചത്? (ഇന്നലെ വൈകുന്നേരം അല്ലെങ്കിൽ ഇന്ന്)',
    'en-IN': 'When did the crop damage happen? (You can say yesterday evening, today, or the date)',
  },
  village: {
    'hi-IN': 'आपका खेत किस गाँव में स्थित है?',
    'te-IN': 'మీ పొలం ఏ గ్రామంలో ఉంది?',
    'ta-IN': 'உங்கள் வயல் எந்த கிராமத்தில் உள்ளது?',
    'kn-IN': 'ನಿಮ್ಮ ಜಮೀನು ಯಾವ ಗ್ರಾಮದಲ್ಲಿದೆ?',
    'ml-IN': 'നിങ്ങളുടെ കൃഷിയിടം ഏത് ഗ്രാമത്തിലാണ്?',
    'en-IN': 'Which village is your field located in?',
  },
  affected_area: {
    'hi-IN': 'लगभग कितनी भूमि (कितने एकड़ या हेक्टेयर) में फसल खराब हुई है?',
    'te-IN': 'సుమారు ఎంత భూమిలో (ఎన్ని ఎకరాల్లో) పంట నష్టపోయింది?',
    'ta-IN': 'சுமார் எவ்வளவு நிலத்தில் (எத்தனை ஏக்கர்) பயிர் சேதமடைந்தது?',
    'kn-IN': 'ಅಂದಾಜು ಎಷ್ಟು ಭೂಮಿಯಲ್ಲಿ (ಎಷ್ಟು ಎಕರೆ) ಬೆಳೆ ಹಾನಿಯಾಗಿದೆ?',
    'ml-IN': 'ഏകദേശം എത്ര ഏക്കർ സ്ഥലത്തെ വിളയാണ് നശിച്ചത്?',
    'en-IN': 'Approximately how much land was damaged (in acres or hectares)?',
  },
  crop_stage: {
    'hi-IN': 'क्या फसल खेत में खड़ी थी, या काट कर खेत में सुखाने के लिए रखी गई थी?',
    'te-IN': 'పంట పొలంలో నిలబడి ఉందా, లేక కోసి ఎండబెట్టడానికి పొలంలో ఉంచారా?',
    'ta-IN': 'பயிர் வயலில் நின்றிருந்ததா அல்லது அறுவடை செய்து உலர்த்த வைக்கப்பட்டிருந்ததா?',
    'kn-IN': 'ಬೆಳೆ ಹೊಲದಲ್ಲಿ ನಿಂತಿತ್ತೇ ಅಥವಾ ಕಟಾವು ಮಾಡಿ ಒಣಗಿಸಲು ಇಡಲಾಗಿತ್ತೇ?',
    'ml-IN': 'വിള വയലിൽ നിൽക്കുകയായിരുന്നോ അതോ കൊയ്ത് ഉണക്കാൻ ഇട്ടിരിക്കുകയായിരുന്നോ?',
    'en-IN': 'Was the crop standing in the field, or had it already been harvested and left in the field for drying?',
  },
  insured_status: {
    'hi-IN': 'क्या आपकी इस फसल का प्रधानमंत्री फसल बीमा योजना (PMFBY) के तहत बीमा हुआ है?',
    'te-IN': 'మీ పంటకు ప్రధానమంత్రి ఫసల్ బీమా యోజన (PMFBY) కింద బీమా ఉందా?',
    'ta-IN': 'உங்கள் பயிருக்கு PMFBY பயிர் காப்பீடு செய்யப்பட்டுள்ளதா?',
    'kn-IN': 'ನಿಮ್ಮ ಬೆಳೆಗೆ PMFBY ಅಡಿಯಲ್ಲಿ ವಿಮೆ ಮಾಡಿಸಲಾಗಿದೆಯೇ?',
    'ml-IN': 'നിങ്ങളുടെ വിളയ്ക്ക് PMFBY ഇൻഷുറൻസ് ഉണ്ടോ?',
    'en-IN': 'Is your crop insured under Pradhan Mantri Fasal Bima Yojana (PMFBY)?',
  },
  survey_number: {
    'hi-IN': 'यदि आपके पास खसरा / सर्वे नंबर उपलब्ध है तो बताएं, अन्यथा आप इसे बाद में (7 दिनों के भीतर) भी जोड़ सकते हैं।',
    'te-IN': 'మీ వద్ద సర్వే నంబర్ అందుబాటులో ఉంటే చెప్పండి, లేకపోతే ఇప్పుడు దాటవేసి తర్వాత కూడా చేర్చవచ్చు.',
    'ta-IN': 'உங்களிடம் சர்வே எண் இருந்தால் கூறவும்; இல்லையென்றால் பிறகு சேர்க்கலாம்.',
    'kn-IN': 'ನಿಮ್ಮ ಬಳಿ ಸರ್ವೆ ನಂಬರ್ ಇದ್ದರೆ ತಿಳಿಸಿ, ಇಲ್ಲದಿದ್ದರೆ ನಂತರವೂ ಸೇರಿಸಬಹುದು.',
    'ml-IN': 'സർവ്വേ നമ്പർ ലഭ്യമാണെങ്കിൽ പറയുക, അല്ലെങ്കിൽ പിന്നീട് ചേർക്കാവുന്നതാണ്.',
    'en-IN': 'If you have your land survey/khasra number available, please share it—or you can skip this now and complete it later.',
  },
  application_number: {
    'hi-IN': 'यदि आपके पास बीमा आवेदन / पॉलिसी रसीद नंबर है तो बताएं, या अभी आगे बढ़ें।',
    'te-IN': 'మీ వద్ద బీమా అప్లికేషన్ నంబర్ ఉంటే చెప్పండి, లేదా ఇప్పుడే డ్రాఫ్ట్ సిద్ధం చేయవచ్చు.',
    'ta-IN': 'காப்பீட்டு விண்ணப்ப எண் இருந்தால் கூறவும், அல்லது இப்போது தொடரலாம்.',
    'kn-IN': 'ವಿಮಾ ಅರ್ಜಿ ಸಂಖ್ಯೆ ಇದ್ದರೆ ತಿಳಿಸಿ, ಅಥವಾ ಈಗ ಮುಂದುವರಿಯಬಹುದು.',
    'ml-IN': 'ഇൻഷുറൻസ് അപേക്ഷാ നമ്പർ ഉണ്ടെങ്കിൽ പറയുക, അല്ലെങ്കിൽ തുടരാം.',
    'en-IN': 'If you have your PMFBY application or policy number handy, please share it—or continue directly to review your draft.',
  },
});

class DynamicQuestionEngine {
  selectNextQuestion({ fields = {}, languageCode = 'hi-IN', skippedFields = [] }) {
    const skippedSet = new Set(skippedFields);
    const criticalMissing = [];
    const optionalMissing = [];
    const uncertainFields = [];

    for (const item of QUESTION_PRIORITY_ORDER) {
      const entry = fields[item.field];
      const hasValue = entry && entry.value !== null && entry.value !== undefined && entry.value !== '';

      if (entry && entry.status === FieldExtractionStatus.UNCERTAIN) {
        uncertainFields.push(item.field);
      }

      if (!hasValue) {
        if (item.critical) {
          criticalMissing.push(item);
        } else if (!skippedSet.has(item.field)) {
          optionalMissing.push(item);
        }
      }
    }

    const canPreparePartialDraft = criticalMissing.length === 0;
    const lang = LOCALIZED_QUESTIONS.crop[languageCode] ? languageCode : 'en-IN';

    // 1. Ask to clarify any uncertain field first
    if (uncertainFields.length > 0) {
      const target = uncertainFields[0];
      return {
        nextFieldToAsk: target,
        questionText: LOCALIZED_QUESTIONS[target][lang],
        isCritical: true,
        reason: 'CLARIFY_UNCERTAIN_TRANSCRIPTION',
        canPreparePartialDraft,
        criticalMissingFields: criticalMissing.map((i) => i.field),
        optionalMissingFields: optionalMissing.map((i) => i.field),
      };
    }

    // 2. Ask highest-priority missing critical field
    if (criticalMissing.length > 0) {
      const nextItem = criticalMissing[0];
      return {
        nextFieldToAsk: nextItem.field,
        questionText: LOCALIZED_QUESTIONS[nextItem.field][lang],
        isCritical: true,
        reason: 'COLLECT_CRITICAL_FIELD',
        canPreparePartialDraft: false,
        criticalMissingFields: criticalMissing.map((i) => i.field),
        optionalMissingFields: optionalMissing.map((i) => i.field),
      };
    }

    // 3. Critical fields are complete! Offer optional field or transition to readback
    if (optionalMissing.length > 0) {
      const nextOpt = optionalMissing[0];
      return {
        nextFieldToAsk: nextOpt.field,
        questionText: LOCALIZED_QUESTIONS[nextOpt.field][lang],
        isCritical: false,
        skippableForInitialDraft: Boolean(nextOpt.skippableForInitialDraft),
        reason: 'COLLECT_OPTIONAL_OR_PROCEED_TO_DRAFT',
        canPreparePartialDraft: true,
        criticalMissingFields: [],
        optionalMissingFields: optionalMissing.map((i) => i.field),
      };
    }

    return {
      nextFieldToAsk: null,
      questionText: null,
      isCritical: false,
      reason: 'READY_FOR_REVIEW_AND_VOICE_READBACK',
      canPreparePartialDraft: true,
      criticalMissingFields: [],
      optionalMissingFields: [],
    };
  }
}

module.exports = { DynamicQuestionEngine, QUESTION_PRIORITY_ORDER, LOCALIZED_QUESTIONS };
