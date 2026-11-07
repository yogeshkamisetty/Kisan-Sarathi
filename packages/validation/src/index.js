/**
 * @fasal-awaaz/validation
 * Deterministic agricultural, temporal, area, and policy-boundary validators.
 * Never fabricates missing fields or silently modifies units.
 */

const {
  CropStage,
  IncidentCategory,
  AreaUnit,
  FieldExtractionStatus,
} = require('../../shared-types/src/index.js');

const AREA_TO_ACRE_FACTORS = Object.freeze({
  [AreaUnit.ACRE]: 1.0,
  [AreaUnit.HECTARE]: 2.47105,
  [AreaUnit.BIGHA]: 0.625, // Standard conversion; original unit is always preserved
  [AreaUnit.GUNTHA]: 0.025,
});

const ELIGIBLE_LOCALISED_PERILS = Object.freeze([
  'hailstorm',
  'landslide',
  'inundation',
  'cloudburst',
  'natural_fire_lightning',
]);

const ELIGIBLE_POST_HARVEST_PERILS = Object.freeze([
  'unseasonal_rain',
  'cyclonic_rain',
  'hailstorm',
]);

/**
 * Validates land area values without silently altering units.
 */
function validateLandArea({ affectedArea, cultivatedArea, unit }) {
  const errors = [];
  const warnings = [];

  if (affectedArea !== null && affectedArea !== undefined) {
    const numAffected = Number(affectedArea);
    if (Number.isNaN(numAffected) || numAffected <= 0) {
      errors.push({
        code: 'INVALID_AFFECTED_AREA',
        field: 'affected_area',
        message: 'Affected land area must be a positive number greater than zero.',
      });
    } else if (numAffected > 500) {
      warnings.push({
        code: 'UNUSUALLY_LARGE_AREA_CONFIRM_REQUIRED',
        field: 'affected_area',
        message: 'Reported affected area exceeds 500 units. Explicit farmer confirmation required.',
      });
    }

    if (cultivatedArea !== null && cultivatedArea !== undefined) {
      const numCultivated = Number(cultivatedArea);
      if (Number.isNaN(numCultivated) || numCultivated <= 0) {
        errors.push({
          code: 'INVALID_CULTIVATED_AREA',
          field: 'cultivated_area',
          message: 'Total cultivated area must be greater than zero.',
        });
      } else if (numAffected > numCultivated) {
        errors.push({
          code: 'AFFECTED_EXCEEDS_CULTIVATED',
          field: 'affected_area',
          message: `Affected area (${numAffected} ${unit || 'acre'}) cannot exceed total cultivated area (${numCultivated} ${unit || 'acre'}) without an explicit explanation.`,
        });
      }
    }
  }

  const normalizedUnit = unit ? String(unit).toLowerCase() : AreaUnit.ACRE;
  if (!Object.values(AreaUnit).includes(normalizedUnit)) {
    errors.push({
      code: 'UNSUPPORTED_AREA_UNIT',
      field: 'area_unit',
      message: `Unsupported area unit "${unit}". Supported units: acre, hectare, bigha, guntha.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    preservedUnit: normalizedUnit,
    equivalentAcres:
      affectedArea && AREA_TO_ACRE_FACTORS[normalizedUnit]
        ? Number((Number(affectedArea) * AREA_TO_ACRE_FACTORS[normalizedUnit]).toFixed(4))
        : null,
  };
}

/**
 * Validates incident date and post-harvest drying window against reference timestamp.
 */
function validateIncidentTiming({
  incidentDateIso,
  referenceNowIso,
  cropStage,
  harvestDateIso,
  intimationWindowHours = 72,
  maxPostHarvestDryingDays = 14,
}) {
  const errors = [];
  const warnings = [];
  const now = referenceNowIso ? new Date(referenceNowIso) : new Date();

  if (!incidentDateIso) {
    return {
      valid: true,
      isMissing: true,
      errors,
      warnings,
      hoursElapsed: null,
      withinInitialWindow: null,
    };
  }

  const incidentDate = new Date(incidentDateIso);
  if (Number.isNaN(incidentDate.getTime())) {
    errors.push({
      code: 'INVALID_INCIDENT_DATE',
      field: 'incident_date',
      message: `Incident date "${incidentDateIso}" is not a valid calendar date.`,
    });
    return { valid: false, isMissing: false, errors, warnings, hoursElapsed: null, withinInitialWindow: null };
  }

  const diffMs = now.getTime() - incidentDate.getTime();
  if (diffMs < -5 * 60 * 1000) {
    errors.push({
      code: 'FUTURE_INCIDENT_DATE',
      field: 'incident_date',
      message: 'Incident date cannot be in the future.',
    });
    return { valid: false, isMissing: false, errors, warnings, hoursElapsed: null, withinInitialWindow: false };
  }

  const hoursElapsed = Math.max(0, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
  const withinInitialWindow = hoursElapsed <= intimationWindowHours;

  if (!withinInitialWindow) {
    warnings.push({
      code: 'INITIAL_WINDOW_ELAPSED',
      field: 'incident_date',
      message: `Incident occurred approximately ${Math.round(hoursElapsed)} hours ago, which exceeds the standard ${intimationWindowHours}-hour initial intimation rule where applicable. Contact official channels (14447 / Bank / Agriculture Dept) immediately.`,
    });
  }

  if (cropStage === CropStage.HARVESTED_IN_FIELD_DRYING && harvestDateIso) {
    const harvestDate = new Date(harvestDateIso);
    if (!Number.isNaN(harvestDate.getTime())) {
      const dryingDays = (incidentDate.getTime() - harvestDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dryingDays < 0) {
        errors.push({
          code: 'HARVEST_AFTER_INCIDENT',
          field: 'harvest_date',
          message: 'Harvest date prior to post-harvest drying damage cannot be after the incident date.',
        });
      } else if (dryingDays > maxPostHarvestDryingDays) {
        warnings.push({
          code: 'POST_HARVEST_DRYING_LIMIT_EXCEEDED',
          field: 'harvest_date',
          message: `Harvested crop was in the field for ${Math.round(dryingDays)} days, which exceeds the standard ${maxPostHarvestDryingDays}-day PMFBY post-harvest cut-and-spread drying provision.`,
        });
      }
    }
  }

  if (cropStage === CropStage.HARVESTED_STORED) {
    warnings.push({
      code: 'STORED_CROP_NOT_ELIGIBLE_POST_HARVEST',
      field: 'crop_stage',
      message: 'Crops already bundled and stored in a warehouse/godown are typically outside PMFBY cut-and-spread field drying post-harvest coverage. Please clarify with official channels.',
    });
  }

  return {
    valid: errors.length === 0,
    isMissing: false,
    errors,
    warnings,
    hoursElapsed,
    hoursRemaining: Math.max(0, Number((intimationWindowHours - hoursElapsed).toFixed(2))),
    withinInitialWindow,
  };
}

/**
 * Validates that an extraction payload adheres strictly to schema rules and never invents values.
 */
function validateExtractionSchema(extractedPayload) {
  const errors = [];
  const sanitized = {};

  const allowedFields = [
    'farmer_name',
    'village',
    'district',
    'state',
    'crop',
    'loss_event',
    'incident_date',
    'incident_time',
    'crop_stage',
    'cultivated_area',
    'affected_area',
    'survey_number',
    'insured_status',
    'application_number',
  ];

  for (const field of allowedFields) {
    const entry = extractedPayload ? extractedPayload[field] : null;
    if (!entry || entry.value === null || entry.value === undefined || entry.value === '') {
      sanitized[field] = {
        value: null,
        unit: entry && entry.unit ? entry.unit : null,
        confidence: 0,
        source_text: null,
        status: FieldExtractionStatus.MISSING,
      };
      continue;
    }

    // Rule: Every non-null extracted value MUST carry source_text from the farmer's statement
    if (!entry.source_text || String(entry.source_text).trim().length === 0) {
      errors.push({
        code: 'UNGROUNDED_EXTRACTION_REJECTED',
        field,
        message: `Field "${field}" had a value ("${entry.value}") without a supporting source_text span and was rejected to prevent fabrication.`,
      });
      sanitized[field] = {
        value: null,
        unit: null,
        confidence: 0,
        source_text: null,
        status: FieldExtractionStatus.MISSING,
      };
      continue;
    }

    const confidence = typeof entry.confidence === 'number' ? Math.min(1, Math.max(0, entry.confidence)) : 0.5;
    let status = entry.status || FieldExtractionStatus.NEEDS_CONFIRMATION;

    // Never allow AI extraction to mark a field as already 'confirmed' without farmer action
    if (status === FieldExtractionStatus.CONFIRMED && !entry.farmerExplicitlyConfirmed) {
      status = FieldExtractionStatus.NEEDS_CONFIRMATION;
    }
    if (confidence < 0.75 && status === FieldExtractionStatus.NEEDS_CONFIRMATION) {
      status = FieldExtractionStatus.UNCERTAIN;
    }

    sanitized[field] = {
      value: entry.value,
      unit: entry.unit || null,
      confidence,
      source_text: String(entry.source_text).trim(),
      status,
      // Ambiguity metadata is preserved so the readback can ask the farmer about the
      // specific problem ("कल" meaning both yesterday and tomorrow) instead of only
      // reporting a generic low-confidence value. The allow-list above still governs
      // which fields exist and what their values may be.
      ...(entry.ambiguous ? { ambiguous: true, ambiguityReason: entry.ambiguityReason || null } : {}),
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = {
  AREA_TO_ACRE_FACTORS,
  ELIGIBLE_LOCALISED_PERILS,
  ELIGIBLE_POST_HARVEST_PERILS,
  validateLandArea,
  validateIncidentTiming,
  validateExtractionSchema,
};
