/**
 * Indian Standard Time (Asia/Kolkata, UTC+05:30) Date Helpers
 *
 * Every date a farmer speaks ("yesterday", "today") and every PMFBY deadline is an IST
 * calendar date. Deriving those from `Date#toISOString()` silently uses UTC, so a farmer
 * reporting at 02:00 IST would have their incident dated to the previous day — and a
 * 72-hour intimation window is short enough that one wrong day matters.
 *
 * These helpers do the arithmetic in IST explicitly, with no dependency on the server's
 * local timezone (which in production is usually UTC).
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** PMFBY crop seasons. */
const CropSeason = Object.freeze({
  KHARIF: 'KHARIF',
  RABI: 'RABI',
  /** Summer / Zaid season between Rabi harvest and Kharif sowing. */
  ZAID: 'ZAID',
});

function toDate(value) {
  if (value instanceof Date) return value;
  if (value === null || value === undefined || value === '') return new Date();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`INVALID_DATE: "${value}" is not a valid date.`);
    err.code = 'INVALID_DATE';
    throw err;
  }
  return d;
}

/** Shifts an instant so that UTC field accessors read IST wall-clock values. */
function istShifted(value) {
  return new Date(toDate(value).getTime() + IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * The IST calendar date of an instant, as YYYY-MM-DD.
 * @param {Date|string} [value] Defaults to now.
 */
function istDateString(value) {
  return istShifted(value).toISOString().slice(0, 10);
}

/**
 * The IST calendar date `days` before (negative) or after (positive) an instant.
 */
function istDateStringOffset(value, days) {
  return new Date(istShifted(value).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 1-12 month number of an instant in IST. */
function istMonth(value) {
  return istShifted(value).getUTCMonth() + 1;
}

/** Full year of an instant in IST. */
function istYear(value) {
  return istShifted(value).getUTCFullYear();
}

/**
 * Converts an IST calendar date (YYYY-MM-DD) to a full ISO instant at the given IST
 * wall-clock time. A bare date string parsed by `new Date()` is treated as UTC midnight,
 * which is 05:30 IST the same day — close enough to mislead deadline arithmetic, so the
 * conversion is made explicit here.
 *
 * @param {string} dateString YYYY-MM-DD
 * @param {string} [istClockTime] HH:MM in IST; defaults to midday to avoid day-boundary
 *   ambiguity when only a date (and no time) is known.
 */
function istDateStringToIso(dateString, istClockTime = '12:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))) {
    const err = new Error(`INVALID_IST_DATE: Expected YYYY-MM-DD, received "${dateString}".`);
    err.code = 'INVALID_IST_DATE';
    throw err;
  }
  const [hh, mm] = String(istClockTime).split(':');
  return `${dateString}T${String(hh).padStart(2, '0')}:${String(mm || '00').padStart(2, '0')}:00+05:30`;
}

/**
 * Normalises any incident date value to a full ISO instant.
 * A bare YYYY-MM-DD is anchored in IST rather than UTC.
 */
function normalizeIncidentDateToIso(value, istClockTime = '12:00') {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return istDateStringToIso(raw, istClockTime);
  return toDate(raw).toISOString();
}

/**
 * Derives the PMFBY crop season from the incident's IST date.
 *
 * Kharif (monsoon) and Rabi (winter) have different notified crops, cut-off dates and
 * insurance windows, so assuming one of them is a correctness bug, not a default.
 *
 * Boundaries follow the standard PMFBY seasonal split:
 *   - Kharif: June – October (sown with the monsoon, harvested Sept–Oct)
 *   - Rabi:   November – March (sown post-monsoon, harvested Feb–Mar)
 *   - Zaid:   April – May (short summer season between Rabi and Kharif)
 *
 * Seasons overlap in practice: Kharif paddy is still being harvested in November while
 * Rabi sowing has begun. So boundary months also report an `alternateSeason`, which the
 * policy engine falls back to before declaring a rule unavailable.
 *
 * @returns {{season: string|null, alternateSeason: string|null, seasonYear: number|null,
 *   confident: boolean, note: string|null}}
 */
function deriveCropSeason(incidentDateIso) {
  if (!incidentDateIso) {
    return {
      season: null,
      alternateSeason: null,
      seasonYear: null,
      confident: false,
      note: 'Incident date is unknown, so the crop season cannot be derived.',
    };
  }

  const month = istMonth(incidentDateIso);
  const year = istYear(incidentDateIso);
  const BOUNDARY_NOTE =
    'This date falls near a Kharif/Rabi season boundary; the applicable season depends on the state notification and the crop stage.';

  if (month >= 6 && month <= 10) {
    const boundary = month === 6 || month === 10;
    return {
      season: CropSeason.KHARIF,
      alternateSeason: boundary ? CropSeason.RABI : null,
      seasonYear: year,
      confident: !boundary,
      note: boundary ? BOUNDARY_NOTE : null,
    };
  }

  if (month === 11 || month === 12) {
    // November still carries late Kharif harvests, so Kharif remains a live alternative.
    return {
      season: CropSeason.RABI,
      alternateSeason: month === 11 ? CropSeason.KHARIF : null,
      seasonYear: year,
      confident: month === 12,
      note: month === 11 ? BOUNDARY_NOTE : null,
    };
  }

  if (month >= 1 && month <= 3) {
    // A Rabi season starting in November is labelled by its starting year.
    return {
      season: CropSeason.RABI,
      alternateSeason: null,
      seasonYear: year - 1,
      confident: true,
      note: null,
    };
  }

  return {
    season: CropSeason.ZAID,
    alternateSeason: CropSeason.RABI,
    seasonYear: year,
    confident: false,
    note: 'April–May falls in the short Zaid/summer season, which many states do not notify under PMFBY.',
  };
}

module.exports = {
  CropSeason,
  IST_OFFSET_MINUTES,
  istDateString,
  istDateStringOffset,
  istDateStringToIso,
  istMonth,
  istYear,
  normalizeIncidentDateToIso,
  deriveCropSeason,
};
