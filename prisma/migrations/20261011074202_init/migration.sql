-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATHLETE', 'PERFORMANCE', 'MEDICAL', 'COACH', 'EXECUTIVE', 'ADMIN');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('QB', 'SKILL', 'TRENCH', 'LB_TE', 'ST', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'RESTRICTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PRACTICE', 'GAME', 'RECOVERY', 'TESTING', 'TRAVEL');

-- CreateEnum
CREATE TYPE "BaselineStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PENDING', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ValidityStatus" AS ENUM ('VALID', 'LIMITED', 'WITHHELD', 'RETEST', 'INSUFFICIENT_BASELINE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ValidityCheckStatus" AS ENUM ('PASSED', 'FAILED', 'WARNING', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InterventionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('OPEN', 'ASSIGNED', 'UNDER_REVIEW', 'FOLLOW_UP_REQUIRED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athletes" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" "PositionType" NOT NULL,
    "rosterRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "grantedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_configurations" (
    "id" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "description" TEXT,
    "defaultModelConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_records" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL,
    "nextCalibrationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "deviceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "metadata" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER,
    "processedRows" INTEGER,
    "errorRows" INTEGER,
    "log" JSONB,
    "importedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL DEFAULT 'PRACTICE',
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "intensity" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "football_contexts" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT,
    "trainingSessionId" TEXT,
    "gameId" TEXT,
    "opponent" TEXT,
    "quarter" INTEGER,
    "drive" INTEGER,
    "snap" INTEGER,
    "drill" TEXT,
    "repetition" INTEGER,
    "venue" TEXT,
    "surface" TEXT,
    "isIndoor" BOOLEAN,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "airQualityIndex" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "travelLeg" TEXT,
    "timeZoneChangeHrs" DOUBLE PRECISION,
    "daysSinceTravel" INTEGER,
    "sensorConfig" TEXT,
    "returnToPlayContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "football_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_baselines" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "baselineType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "BaselineStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_observations" (
    "id" TEXT NOT NULL,
    "athleteBaselineId" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baseline_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_configuration_versions" (
    "id" TEXT NOT NULL,
    "performanceModelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weights" JSONB NOT NULL,
    "normalizationRules" JSONB,
    "validityRules" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_configuration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_scores" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "performanceModelId" TEXT NOT NULL,
    "modelConfigurationVersionId" TEXT NOT NULL,
    "athleteBaselineId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "scoreBand" TEXT,
    "confidence" DOUBLE PRECISION,
    "validityStatus" "ValidityStatus" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "validityReason" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_components" (
    "id" TEXT NOT NULL,
    "performanceScoreId" TEXT NOT NULL,
    "observationId" TEXT,
    "componentName" TEXT NOT NULL,
    "normalizedValue" DOUBLE PRECISION NOT NULL,
    "originalValue" DOUBLE PRECISION,
    "originalUnit" TEXT,
    "weightApplied" DOUBLE PRECISION NOT NULL,
    "contributionToScore" DOUBLE PRECISION NOT NULL,
    "validityStatus" "ValidityStatus" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "validityReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_drivers" (
    "id" TEXT NOT NULL,
    "performanceScoreId" TEXT NOT NULL,
    "driverType" "DriverType" NOT NULL,
    "description" TEXT NOT NULL,
    "strength" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validity_checks" (
    "id" TEXT NOT NULL,
    "performanceScoreId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "status" "ValidityCheckStatus" NOT NULL DEFAULT 'FAILED',
    "reason" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "triggeringScoreId" TEXT,
    "exceptionKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "priority" "InterventionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "InterventionStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "suggestedWindow" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_reviews" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangeTo" "InterventionStatus" NOT NULL,
    "notes" TEXT,
    "followUpAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "parameters" JSONB,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_userId_teamId_key" ON "team_memberships"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "athletes_externalId_key" ON "athletes"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "position_configurations_positionType_key" ON "position_configurations"("positionType");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serialNumber_key" ON "devices"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "performance_models_name_key" ON "performance_models"("name");

-- CreateIndex
CREATE UNIQUE INDEX "model_configuration_versions_performanceModelId_versionNumb_key" ON "model_configuration_versions"("performanceModelId", "versionNumber");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "football_contexts" ADD CONSTRAINT "football_contexts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "football_contexts" ADD CONSTRAINT "football_contexts_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_baselines" ADD CONSTRAINT "athlete_baselines_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_observations" ADD CONSTRAINT "baseline_observations_athleteBaselineId_fkey" FOREIGN KEY ("athleteBaselineId") REFERENCES "athlete_baselines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_configuration_versions" ADD CONSTRAINT "model_configuration_versions_performanceModelId_fkey" FOREIGN KEY ("performanceModelId") REFERENCES "performance_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_performanceModelId_fkey" FOREIGN KEY ("performanceModelId") REFERENCES "performance_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_modelConfigurationVersionId_fkey" FOREIGN KEY ("modelConfigurationVersionId") REFERENCES "model_configuration_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_scores" ADD CONSTRAINT "performance_scores_athleteBaselineId_fkey" FOREIGN KEY ("athleteBaselineId") REFERENCES "athlete_baselines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_components" ADD CONSTRAINT "score_components_performanceScoreId_fkey" FOREIGN KEY ("performanceScoreId") REFERENCES "performance_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_components" ADD CONSTRAINT "score_components_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_drivers" ADD CONSTRAINT "score_drivers_performanceScoreId_fkey" FOREIGN KEY ("performanceScoreId") REFERENCES "performance_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validity_checks" ADD CONSTRAINT "validity_checks_performanceScoreId_fkey" FOREIGN KEY ("performanceScoreId") REFERENCES "performance_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_reviews" ADD CONSTRAINT "intervention_reviews_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
