/**
 * Hindi Number-to-Words Conversion for Text-to-Speech
 *
 * Gnani's TTS documentation recommends passing numbers, dates and currency as spoken
 * words to avoid mispronunciation. The readback sentence a farmer hears contains the
 * figures they must verify — the damaged area and the hours left before the PMFBY
 * deadline — so a mispronounced "15" or a silently skipped "2.5" is a correctness problem,
 * not a polish issue.
 *
 * Hindi numerals from 1 to 99 are irregular and cannot be composed from a tens word plus
 * a units word, so 0-99 is an explicit table. Above that, the Indian numbering system
 * (सौ / हज़ार / लाख) composes cleanly.
 */

const ONES_TO_NINETY_NINE = Object.freeze([
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सतासी', 'अठासी', 'नवासी',
  'नब्बे', 'इक्यानबे', 'बानबे', 'तिरानबे', 'चौरानबे', 'पंचानबे', 'छियानबे', 'सत्तानबे', 'अट्ठानबे', 'निन्यानबे',
]);

const DECIMAL_POINT_WORD = 'दशमलव';

/**
 * Spells out a non-negative integer in Hindi using the Indian numbering system.
 * @param {number} n
 * @returns {string|null} null when the value is out of the supported range.
 */
function hindiIntegerToWords(n) {
  if (!Number.isInteger(n) || n < 0) return null;
  if (n < 100) return ONES_TO_NINETY_NINE[n];

  // Beyond a crore the figures are not ones a farmer verifies by ear; leave as digits.
  if (n >= 10000000) return null;

  const parts = [];
  const units = [
    { value: 100000, word: 'लाख' },
    { value: 1000, word: 'हज़ार' },
    { value: 100, word: 'सौ' },
  ];

  let remaining = n;
  for (const { value, word } of units) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      const countWords = hindiIntegerToWords(count);
      if (countWords === null) return null;
      parts.push(`${countWords} ${word}`);
      remaining %= value;
    }
  }

  if (remaining > 0) parts.push(ONES_TO_NINETY_NINE[remaining]);
  return parts.join(' ');
}

/**
 * Spells out a number in Hindi, including decimals ("2.5" -> "दो दशमलव पाँच").
 * Decimal digits are read individually, as is conventional in spoken Hindi.
 */
function hindiNumberToWords(raw) {
  const text = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;

  const negative = text.startsWith('-');
  const [intPart, fracPart] = text.replace('-', '').split('.');

  const intWords = hindiIntegerToWords(Number(intPart));
  if (intWords === null) return null;

  let words = intWords;
  if (fracPart) {
    const fracWords = fracPart
      .split('')
      .map((d) => ONES_TO_NINETY_NINE[Number(d)])
      .join(' ');
    words = `${words} ${DECIMAL_POINT_WORD} ${fracWords}`;
  }

  return negative ? `ऋण ${words}` : words;
}

/**
 * Replaces every standalone number in a string with its Hindi spoken form.
 *
 * Word boundaries use Unicode lookarounds: ASCII `\b` does not separate digits from
 * Devanagari text, so the previous implementation both missed and mangled numbers that sat
 * against Hindi characters (for example the "2" in "2 एकड़" or a date like "2026-11-03").
 * Numbers that are part of a longer token (a survey number such as "123/4A", an ISO date)
 * are deliberately left alone — spelling those out would make them harder to verify.
 */
function normalizeHindiNumbersInText(text) {
  return String(text).replace(
    /(?<![\p{L}\p{M}\p{N}\/\-.])(\d+(?:\.\d+)?)(?![\p{L}\p{M}\p{N}\/\-.])/gu,
    (match) => hindiNumberToWords(match) || match
  );
}

module.exports = {
  ONES_TO_NINETY_NINE,
  hindiIntegerToWords,
  hindiNumberToWords,
  normalizeHindiNumbersInText,
};
