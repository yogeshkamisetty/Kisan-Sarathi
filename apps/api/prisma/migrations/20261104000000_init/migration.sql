-- ============================================================================
-- KISANSAATHI — FASAL AWAAZ INITIAL POSTGRESQL MIGRATION (14 CORE ENTITIES)
-- Migration ID: 20261104000000_init
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('FARMER', 'FAMILY_HELPER', 'CSC_OPERATOR', 'ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "AssistedMode" AS ENUM ('SELF', 'FAMILY_MEMBER', 'CSC_OPERATOR');
CREATE TYPE "ConsentType" AS ENUM ('AUDIO_RECORDING', 'GNANI_CLOUD_VOICE_PROCESSING', 'PERSONAL_DATA_STORAGE', 'GPS_LOCATION_CAPTURE', 'PHOTO_EVIDENCE_UPLOAD');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT_LOCAL', 'SYNC_PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW', 'READY_FOR_EXPORT', 'EXPORTED', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'FARMER_REPORTED_SUBMITTED', 'ACKNOWLEDGEMENT_ENTERED', 'OFFICIALLY_VERIFIED');
CREATE TYPE "IncidentCategory" AS ENUM ('LOCALISED_CALAMITY', 'POST_HARVEST_LOSS', 'OTHER_UNCLASSIFIED');
CREATE TYPE "CropStage" AS ENUM ('STANDING', 'HARVESTED_IN_FIELD_DRYING', 'HARVESTED_STORED', 'OTHER_MANUAL_CLARIFICATION');
CREATE TYPE "TimePrecision" AS ENUM ('EXACT', 'APPROXIMATE', 'UNKNOWN');
CREATE TYPE "ConfirmationStatus" AS ENUM ('NEEDS_CONFIRMATION', 'CONFIRMED', 'CORRECTED', 'MISSING', 'APPROXIMATE', 'UNCERTAIN');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "mobile_number" VARCHAR(20) UNIQUE,
  "role" "UserRole" NOT NULL DEFAULT 'FARMER',
  "preferred_language" VARCHAR(16) NOT NULL DEFAULT 'hi-IN',
  "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "farmer_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "farmer_name" VARCHAR(150) NOT NULL,
  "mobile_number" VARCHAR(20),
  "state" VARCHAR(100) NOT NULL,
  "district" VARCHAR(100) NOT NULL,
  "village" VARCHAR(150) NOT NULL,
  "preferred_language" VARCHAR(16) NOT NULL DEFAULT 'hi-IN',
  "assisted_mode" "AssistedMode" NOT NULL DEFAULT 'SELF',
  "assisted_by_name" VARCHAR(150),
  "assisted_by_operator_id" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_farmer_profiles_user_id" ON "farmer_profiles"("user_id");
CREATE INDEX "idx_farmer_profiles_location" ON "farmer_profiles"("state", "district", "village");

CREATE TABLE "consent_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "consent_type" "ConsentType" NOT NULL,
  "purpose" TEXT NOT NULL,
  "consent_version" VARCHAR(32) NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "withdrawn_at" TIMESTAMPTZ
);
CREATE INDEX "idx_consent_user_type" ON "consent_records"("user_id", "consent_type");

CREATE TABLE "policy_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "state" VARCHAR(100) NOT NULL,
  "district_scope" VARCHAR(100) NOT NULL DEFAULT 'ALL',
  "season" VARCHAR(50) NOT NULL,
  "crop" VARCHAR(100) NOT NULL,
  "scheme" VARCHAR(64) NOT NULL DEFAULT 'PMFBY',
  "loss_category" "IncidentCategory" NOT NULL,
  "eligible_event_categories" JSONB NOT NULL,
  "intimation_deadline_hours" INTEGER NOT NULL DEFAULT 72,
  "completion_deadline_hours" INTEGER NOT NULL DEFAULT 168,
  "post_harvest_max_drying_days" INTEGER NOT NULL DEFAULT 14,
  "deadline_rule_explanation" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "verified_at" TIMESTAMPTZ NOT NULL,
  "effective_from" TIMESTAMPTZ NOT NULL,
  "effective_until" TIMESTAMPTZ NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX "idx_policy_lookup" ON "policy_versions"("state", "season", "crop", "active");

CREATE TABLE "reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotency_key" VARCHAR(128) NOT NULL UNIQUE,
  "farmer_id" UUID NOT NULL REFERENCES "farmer_profiles"("id") ON DELETE CASCADE,
  "report_number" VARCHAR(64) NOT NULL UNIQUE,
  "workflow_status" "WorkflowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "submission_status" "SubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "incident_category" "IncidentCategory" NOT NULL DEFAULT 'LOCALISED_CALAMITY',
  "policy_version_id" UUID REFERENCES "policy_versions"("id"),
  "readback_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "farmer_verified_at" TIMESTAMPTZ,
  "created_at_device" TIMESTAMPTZ NOT NULL,
  "created_at_server" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finalised_at" TIMESTAMPTZ,
  "current_revision" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "idx_reports_farmer_status" ON "reports"("farmer_id", "workflow_status");

CREATE TABLE "incident_details" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
  "incident_type" VARCHAR(100),
  "incident_date" TIMESTAMPTZ,
  "incident_time" VARCHAR(64),
  "time_precision" "TimePrecision" NOT NULL DEFAULT 'APPROXIMATE',
  "crop_stage" "CropStage" NOT NULL DEFAULT 'STANDING',
  "harvest_date" TIMESTAMPTZ,
  "event_description" TEXT,
  "farmer_confirmed" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "crop_details" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
  "crop_name" VARCHAR(100),
  "crop_variety" VARCHAR(100),
  "cultivated_area" DOUBLE PRECISION CHECK ("cultivated_area" IS NULL OR "cultivated_area" > 0),
  "affected_area" DOUBLE PRECISION CHECK ("affected_area" IS NULL OR "affected_area" > 0),
  "area_unit" VARCHAR(32) NOT NULL DEFAULT 'acre',
  "crop_season" VARCHAR(32) NOT NULL DEFAULT 'KHARIF',
  "farmer_confirmed" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "field_details" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
  "state" VARCHAR(100) NOT NULL,
  "district" VARCHAR(100) NOT NULL,
  "village" VARCHAR(150) NOT NULL,
  "survey_number" VARCHAR(100),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "location_source" VARCHAR(50) NOT NULL DEFAULT 'FARMER_SPOKEN',
  "location_confirmed" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "insurance_references" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
  "insurance_scheme" VARCHAR(64) NOT NULL DEFAULT 'PMFBY',
  "insured_status" VARCHAR(32) NOT NULL DEFAULT 'UNSURE',
  "application_number" VARCHAR(100),
  "policy_reference" VARCHAR(100),
  "non_sensitive_notes" TEXT,
  "verification_status" VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED'
);

CREATE TABLE "conversation_turns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "turn_index" INTEGER NOT NULL,
  "speaker" VARCHAR(32) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "transcript" TEXT NOT NULL,
  "processing_status" VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  "provider" VARCHAR(64) NOT NULL DEFAULT 'gnani-prisma-v3.0',
  "provider_mode" VARCHAR(32) NOT NULL DEFAULT 'LIVE_GNANI',
  "provider_request_id" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_turns_report_idx" ON "conversation_turns"("report_id", "turn_index");

CREATE TABLE "extracted_values" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "field_name" VARCHAR(64) NOT NULL,
  "extracted_value" TEXT,
  "unit" VARCHAR(32),
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source_text" TEXT,
  "source_turn_id" UUID REFERENCES "conversation_turns"("id") ON DELETE SET NULL,
  "confirmation_status" "ConfirmationStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
  "confirmed_at" TIMESTAMPTZ
);
CREATE INDEX "idx_extracted_report_field" ON "extracted_values"("report_id", "field_name");

CREATE TABLE "evidence_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "storage_key" TEXT NOT NULL,
  "file_type" VARCHAR(64) NOT NULL,
  "file_size" INTEGER NOT NULL,
  "upload_status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "capture_time" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "farmer_confirmed" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "official_submission_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "submission_channel" VARCHAR(100) NOT NULL,
  "farmer_reported_submission_date" TIMESTAMPTZ NOT NULL,
  "official_reference_number" VARCHAR(128),
  "acknowledgement_file_id" VARCHAR(128),
  "verification_status" VARCHAR(64) NOT NULL DEFAULT 'FARMER_REPORTED_UNVERIFIED',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "audit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_role" "UserRole" NOT NULL DEFAULT 'FARMER',
  "report_id" UUID REFERENCES "reports"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "field_name" VARCHAR(64),
  "previous_value" JSONB,
  "new_value" JSONB,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "source" VARCHAR(64) NOT NULL DEFAULT 'MOBILE_APP'
);
CREATE INDEX "idx_audit_report_time" ON "audit_events"("report_id", "timestamp");
