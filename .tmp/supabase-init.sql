-- migration: 20260215195038_init_lifeos
-- CreateEnum
CREATE TYPE "StatType" AS ENUM ('HEALTH', 'RELATIONSHIPS', 'CAREER', 'FINANCE', 'PERSONAL_GROWTH');

-- CreateEnum
CREATE TYPE "FactorType" AS ENUM ('SLEEP', 'EXERCISE', 'NUTRITION', 'FOCUS', 'SOCIAL', 'STRESS', 'ROUTINE', 'WORKLOAD');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('STABLE', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "systemStatus" "SystemStatus" NOT NULL,
    "mood" INTEGER,
    "stressLevel" INTEGER,
    "energyLevel" INTEGER,
    "notes" TEXT,
    "configVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "health" DECIMAL(5,2) NOT NULL,
    "relationships" DECIMAL(5,2) NOT NULL,
    "career" DECIMAL(5,2) NOT NULL,
    "finance" DECIMAL(5,2) NOT NULL,
    "personalGrowth" DECIMAL(5,2) NOT NULL,
    "lifeScore" DECIMAL(5,2) NOT NULL,
    "systemStatus" "SystemStatus" NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statType" "StatType" NOT NULL,
    "factorType" "FactorType" NOT NULL,
    "contribution" DECIMAL(8,3) NOT NULL,
    "overloadPenalty" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightConfig" (
    "id" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "decayDays" INTEGER NOT NULL DEFAULT 7,
    "healthWeight" DECIMAL(5,2) NOT NULL,
    "relationWeight" DECIMAL(5,2) NOT NULL,
    "careerWeight" DECIMAL(5,2) NOT NULL,
    "financeWeight" DECIMAL(5,2) NOT NULL,
    "growthWeight" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "level" INTEGER NOT NULL,
    "currentXp" INTEGER NOT NULL,
    "totalXp" INTEGER NOT NULL,
    "xpToNextLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiChaosPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "systemStatus" "SystemStatus" NOT NULL,
    "reasons" TEXT[],
    "actionItems" TEXT[],
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AntiChaosPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DailyCheckIn_date_idx" ON "DailyCheckIn"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckIn_userId_date_key" ON "DailyCheckIn"("userId", "date");

-- CreateIndex
CREATE INDEX "StatSnapshot_date_idx" ON "StatSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StatSnapshot_userId_date_key" ON "StatSnapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "StatContribution_userId_date_idx" ON "StatContribution"("userId", "date");

-- CreateIndex
CREATE INDEX "StatContribution_snapshotId_idx" ON "StatContribution"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "StatContribution_userId_date_statType_factorType_key" ON "StatContribution"("userId", "date", "statType", "factorType");

-- CreateIndex
CREATE UNIQUE INDEX "WeightConfig_configVersion_key" ON "WeightConfig"("configVersion");

-- CreateIndex
CREATE INDEX "XpEvent_userId_date_idx" ON "XpEvent"("userId", "date");

-- CreateIndex
CREATE INDEX "XpEvent_date_idx" ON "XpEvent"("date");

-- CreateIndex
CREATE INDEX "LevelSnapshot_date_idx" ON "LevelSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LevelSnapshot_userId_date_key" ON "LevelSnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_earnedDate_idx" ON "UserAchievement"("userId", "earnedDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "AntiChaosPlan_userId_isResolved_idx" ON "AntiChaosPlan"("userId", "isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "AntiChaosPlan_userId_date_key" ON "AntiChaosPlan"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_configVersion_fkey" FOREIGN KEY ("configVersion") REFERENCES "WeightConfig"("configVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatSnapshot" ADD CONSTRAINT "StatSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatSnapshot" ADD CONSTRAINT "StatSnapshot_configVersion_fkey" FOREIGN KEY ("configVersion") REFERENCES "WeightConfig"("configVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatContribution" ADD CONSTRAINT "StatContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatContribution" ADD CONSTRAINT "StatContribution_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelSnapshot" ADD CONSTRAINT "LevelSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiChaosPlan" ADD CONSTRAINT "AntiChaosPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- migration: 20260215233000_normalize_contribution_enums_v2
-- Normalize StatType/FactorType enums and simplify StatContribution payload storage.

-- 1) Create target enums
CREATE TYPE "StatType_new" AS ENUM ('ENERGY', 'FOCUS', 'DISCIPLINE', 'FINANCE', 'GROWTH');
CREATE TYPE "FactorType_new" AS ENUM (
  'SLEEP',
  'WORKOUT',
  'DEEP_WORK',
  'LEARNING',
  'MONEY_DELTA',
  'STRESS',
  'OVERLOAD',
  'MOMENTUM'
);

-- 2) Migrate enum values on StatContribution
ALTER TABLE "StatContribution"
  ALTER COLUMN "statType" TYPE "StatType_new"
  USING (
    CASE "statType"::text
      WHEN 'HEALTH' THEN 'ENERGY'
      WHEN 'RELATIONSHIPS' THEN 'FOCUS'
      WHEN 'CAREER' THEN 'DISCIPLINE'
      WHEN 'FINANCE' THEN 'FINANCE'
      WHEN 'PERSONAL_GROWTH' THEN 'GROWTH'
      WHEN 'ENERGY' THEN 'ENERGY'
      WHEN 'FOCUS' THEN 'FOCUS'
      WHEN 'DISCIPLINE' THEN 'DISCIPLINE'
      WHEN 'GROWTH' THEN 'GROWTH'
      ELSE 'ENERGY'
    END
  )::"StatType_new";

ALTER TABLE "StatContribution"
  ALTER COLUMN "factorType" TYPE "FactorType_new"
  USING (
    CASE "factorType"::text
      WHEN 'SLEEP' THEN 'SLEEP'
      WHEN 'EXERCISE' THEN 'WORKOUT'
      WHEN 'FOCUS' THEN 'DEEP_WORK'
      WHEN 'WORKLOAD' THEN 'MONEY_DELTA'
      WHEN 'ROUTINE' THEN 'LEARNING'
      WHEN 'NUTRITION' THEN 'MONEY_DELTA'
      WHEN 'STRESS' THEN 'STRESS'
      WHEN 'SOCIAL' THEN 'OVERLOAD'
      WHEN 'MOMENTUM' THEN 'MOMENTUM'
      WHEN 'WORKOUT' THEN 'WORKOUT'
      WHEN 'DEEP_WORK' THEN 'DEEP_WORK'
      WHEN 'LEARNING' THEN 'LEARNING'
      WHEN 'MONEY_DELTA' THEN 'MONEY_DELTA'
      WHEN 'OVERLOAD' THEN 'OVERLOAD'
      ELSE 'STRESS'
    END
  )::"FactorType_new";

-- 3) Swap enums
DROP TYPE "StatType";
ALTER TYPE "StatType_new" RENAME TO "StatType";

DROP TYPE "FactorType";
ALTER TYPE "FactorType_new" RENAME TO "FactorType";

-- 4) Keep only one contribution value column for write path compatibility
ALTER TABLE "StatContribution" DROP COLUMN IF EXISTS "rawContribution";
ALTER TABLE "StatContribution" DROP COLUMN IF EXISTS "effectiveContribution";
ALTER TABLE "StatContribution" DROP COLUMN IF EXISTS "momentumContribution";
ALTER TABLE "StatContribution" DROP COLUMN IF EXISTS "overloadPenalty";


-- migration: 20260216001000_add_bio_state_v3
-- Add v3 bio-simulator state persistence and bio config defaults

-- WeightConfig bio parameters
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "momentumWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "reserveSleepGain" DOUBLE PRECISION NOT NULL DEFAULT 0.06;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "reserveWorkCost" DOUBLE PRECISION NOT NULL DEFAULT 0.03;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "reserveStressCost" DOUBLE PRECISION NOT NULL DEFAULT 0.04;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "fatigueCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.92;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "fatigueWorkGain" DOUBLE PRECISION NOT NULL DEFAULT 0.025;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "fatigueStressGain" DOUBLE PRECISION NOT NULL DEFAULT 0.03;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "fatigueSleepRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0.045;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "strainCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.90;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "strainFatigueWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.45;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "overloadLevel1Threshold" DOUBLE PRECISION NOT NULL DEFAULT 45;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "overloadLevel2Threshold" DOUBLE PRECISION NOT NULL DEFAULT 70;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "overloadRecoverThreshold" DOUBLE PRECISION NOT NULL DEFAULT 35;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "baseFocus" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "focusFromEnergy" DOUBLE PRECISION NOT NULL DEFAULT 0.11;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "focusFromFatigue" DOUBLE PRECISION NOT NULL DEFAULT 0.09;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "focusFromStress" DOUBLE PRECISION NOT NULL DEFAULT 0.12;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "optLoadMin" DOUBLE PRECISION NOT NULL DEFAULT 0.35;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "optLoadMax" DOUBLE PRECISION NOT NULL DEFAULT 0.75;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "adaptGain" DOUBLE PRECISION NOT NULL DEFAULT 0.03;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "burnoutPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0.06;
ALTER TABLE "WeightConfig" ADD COLUMN IF NOT EXISTS "disciplineCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.96;

-- BioStateSnapshot model
CREATE TABLE IF NOT EXISTS "BioStateSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "energyReserve" DOUBLE PRECISION NOT NULL,
  "cognitiveFatigue" DOUBLE PRECISION NOT NULL,
  "strainIndex" DOUBLE PRECISION NOT NULL,
  "overloadLevel" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BioStateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BioStateSnapshot_userId_date_key" ON "BioStateSnapshot"("userId", "date");
CREATE INDEX IF NOT EXISTS "BioStateSnapshot_userId_date_idx" ON "BioStateSnapshot"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BioStateSnapshot_userId_fkey'
  ) THEN
    ALTER TABLE "BioStateSnapshot"
      ADD CONSTRAINT "BioStateSnapshot_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- migration: 20260217090000_add_bio_state_v32_layers
-- LIFE OS v3.2 long-term adaptation layers

ALTER TABLE "WeightConfig"
  ADD COLUMN IF NOT EXISTS "debtCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.96,
  ADD COLUMN IF NOT EXISTS "debtRecoveryFactor" DOUBLE PRECISION NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "adaptiveCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.98;

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "recoveryDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adaptiveCapacity" DOUBLE PRECISION NOT NULL DEFAULT 50;


-- migration: 20260218003000_bio_v32_debt_capacity
-- Bio v3.2: recovery debt + adaptive capacity sync

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "recoveryDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adaptiveCapacity" DOUBLE PRECISION NOT NULL DEFAULT 50;

ALTER TABLE "BioStateSnapshot"
  ALTER COLUMN "adaptiveCapacity" SET DEFAULT 50;


-- migration: 20260218010000_bio_v33_sleep_buffer
-- Bio v3.3: delayed recovery via sleep buffer

ALTER TABLE "WeightConfig"
  ADD COLUMN IF NOT EXISTS "bufferGain" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS "bufferCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS "bufferSpendMax" DOUBLE PRECISION NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS "reserveFromBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS "fatigueFromBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0.45;

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "sleepBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0;


-- migration: 20260218023000_repair_v3x_columns
-- Repair migration for environments where v3.x columns were added in code but not in DB.
-- Safe to run multiple times.

ALTER TABLE "WeightConfig"
  ADD COLUMN IF NOT EXISTS "debtCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.96,
  ADD COLUMN IF NOT EXISTS "debtRecoveryFactor" DOUBLE PRECISION NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "adaptiveCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.98,
  ADD COLUMN IF NOT EXISTS "bufferGain" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS "bufferCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS "bufferSpendMax" DOUBLE PRECISION NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS "reserveFromBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS "fatigueFromBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0.45;

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "recoveryDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adaptiveCapacity" DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "sleepBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "BioStateSnapshot"
  ALTER COLUMN "adaptiveCapacity" SET DEFAULT 50;


-- migration: 20260218032000_bio_v34_circadian_regularity
-- Bio v3.4: circadian alignment + sleep regularity

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "circadianAlignment" DOUBLE PRECISION NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS "sleepRegularity" DOUBLE PRECISION NOT NULL DEFAULT 70;


-- migration: 20260218043000_bio_v35_v36_stress_training
-- Bio v3.5 / v3.6: stress carry-over + training adaptation lag

ALTER TABLE "WeightConfig"
  ADD COLUMN IF NOT EXISTS "stressCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS "stressGain" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS "stressRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS "trainingIn" DOUBLE PRECISION NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS "trainingCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS "trainingSpendMax" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "trainingReserveBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS "trainingDisciplineBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.28,
  ADD COLUMN IF NOT EXISTS "trainingAdaptiveBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS "workoutSameDayCostReserve" DOUBLE PRECISION NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "workoutSameDayCostFatigue" DOUBLE PRECISION NOT NULL DEFAULT 6;

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "stressLoad" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "trainingBuffer" DOUBLE PRECISION NOT NULL DEFAULT 0;


-- migration: 20260218054000_bio_v37_temporal_coherence
-- Bio v3.7: temporal coherence layers

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "homeostasisBias" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "cognitiveSaturation" DOUBLE PRECISION NOT NULL DEFAULT 0;


-- migration: 20260219093000_bio_v38_autonomic_balance
-- v3.8 Autonomic Balance model
ALTER TABLE "BioStateSnapshot"
ADD COLUMN "sympatheticDrive" DOUBLE PRECISION NOT NULL DEFAULT 40,
ADD COLUMN "parasympatheticDrive" DOUBLE PRECISION NOT NULL DEFAULT 40,
ADD COLUMN "autonomicBalance" DOUBLE PRECISION NOT NULL DEFAULT 50;

ALTER TABLE "WeightConfig"
ADD COLUMN "sympCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.78,
ADD COLUMN "paraCarry" DOUBLE PRECISION NOT NULL DEFAULT 0.78,
ADD COLUMN "sympFromStress" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
ADD COLUMN "sympFromLoad" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
ADD COLUMN "sympFromStrain" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
ADD COLUMN "paraFromSleep" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
ADD COLUMN "paraFromRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
ADD COLUMN "paraFromCircadian" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
ADD COLUMN "paraSuppressedByStressLoad" DOUBLE PRECISION NOT NULL DEFAULT 0.25;


-- migration: 20260219101500_bio_v39_hormesis
-- v3.9 Hormesis model
ALTER TABLE "BioStateSnapshot"
ADD COLUMN "hormeticSignal" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN "overstressSignal" DOUBLE PRECISION NOT NULL DEFAULT 10;


-- migration: 20260219111000_bio_v40_burnout_spiral
-- v4.0 Burnout Spiral model
ALTER TABLE "BioStateSnapshot"
ADD COLUMN "burnoutRiskIndex" DOUBLE PRECISION NOT NULL DEFAULT 15,
ADD COLUMN "resilienceIndex" DOUBLE PRECISION NOT NULL DEFAULT 50;


-- migration: 20260220103000_add_sleep_timing_to_daily_checkin
-- Add sleep timing fields for circadian/regularity modeling.
ALTER TABLE "DailyCheckIn"
ADD COLUMN "bedtimeMinutes" INTEGER,
ADD COLUMN "wakeTimeMinutes" INTEGER;



-- migration: 20260223123000_add_adaptive_baseline_offsets
-- Add user-level adaptive baseline offsets (homeostatic memory layer)
ALTER TABLE "User"
ADD COLUMN "adaptiveRiskOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adaptiveRecoveryOffset" DOUBLE PRECISION NOT NULL DEFAULT 0;


-- migration: 20260224161843_auth_init
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
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

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "ScenarioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseDateISO" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inputModifiers" JSONB NOT NULL,
    "projectionResult" JSONB NOT NULL,
    "patternContext" JSONB NOT NULL,
    "calibrationConfidence" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScenarioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "ScenarioSnapshot_userId_idx" ON "ScenarioSnapshot"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioSnapshot" ADD CONSTRAINT "ScenarioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- migration: 20260225205918_setup_state_flags
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calibrationCheckinsDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calibrationCheckinsNeeded" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;


-- migration: 20260226202624_add_protocol_runs
-- CreateTable
CREATE TABLE "ProtocolRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizonHours" INTEGER NOT NULL,
    "guardrailState" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "inputs" JSONB NOT NULL,
    "protocol" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "ProtocolRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolRun_userId_createdAt_idx" ON "ProtocolRun"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProtocolRun" ADD CONSTRAINT "ProtocolRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- migration: 20260226204423_add_protocol_outcome
-- AlterTable
ALTER TABLE "ProtocolRun" ADD COLUMN     "outcome" JSONB;


-- migration: 20260227112650_add_protocol_mode
-- AlterTable
ALTER TABLE "ProtocolRun" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'STANDARD';


-- migration: 20260227115132_extend_scenario_snapshot_meta
-- AlterTable
ALTER TABLE "ScenarioSnapshot" ADD COLUMN     "horizonDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "tags" TEXT;


-- migration: 20260227130500_add_protocol_integrity_at_end
-- AlterTable
ALTER TABLE "ProtocolRun"
ADD COLUMN "integrityAtEnd" JSONB;



-- migration: 20260302000409_add_system_snapshot
-- CreateTable
CREATE TABLE "SystemSnapshot" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,

    CONSTRAINT "SystemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSnapshot_token_key" ON "SystemSnapshot"("token");

-- CreateIndex
CREATE INDEX "SystemSnapshot_userId_createdAt_idx" ON "SystemSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SystemSnapshot" ADD CONSTRAINT "SystemSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- migration: 20260302001018_add_snapshot_expiry
/*
  Warnings:

  - Added the required column `expiresAt` to the `SystemSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SystemSnapshot" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;


-- migration: 20260302223647_add_user_role
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';


-- migration: 20260303120000_add_billing_nowpayments
-- Billing enums
CREATE TYPE "BillingPlanCode" AS ENUM ('OPERATOR_MONTHLY', 'OPERATOR_YEARLY');
CREATE TYPE "BillingOrderStatus" AS ENUM ('CREATED', 'INVOICE_CREATED', 'PENDING', 'PARTIAL', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');
CREATE TYPE "EntitlementKey" AS ENUM ('OPERATOR_LICENSE');
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- Billing tables
CREATE TABLE "BillingPlan" (
  "id" TEXT NOT NULL,
  "code" "BillingPlanCode" NOT NULL,
  "title" TEXT NOT NULL,
  "priceAmount" DECIMAL(18,2) NOT NULL,
  "priceCurrency" TEXT NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCode" "BillingPlanCode" NOT NULL,
  "status" "BillingOrderStatus" NOT NULL DEFAULT 'CREATED',
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'NOWPAYMENTS',
  "providerInvoiceId" TEXT,
  "invoiceUrl" TEXT,
  "payAddress" TEXT,
  "payCurrency" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPaymentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "providerEventId" TEXT,
  "statusRaw" TEXT NOT NULL,
  "signature" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Entitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" "EntitlementKey" NOT NULL,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sourceOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPlan_code_key" ON "BillingPlan"("code");
CREATE INDEX "BillingOrder_userId_createdAt_idx" ON "BillingOrder"("userId", "createdAt");
CREATE INDEX "BillingOrder_status_createdAt_idx" ON "BillingOrder"("status", "createdAt");
CREATE INDEX "BillingPaymentEvent_orderId_receivedAt_idx" ON "BillingPaymentEvent"("orderId", "receivedAt");
CREATE UNIQUE INDEX "Entitlement_userId_key" ON "Entitlement"("userId");
CREATE INDEX "Entitlement_key_status_idx" ON "Entitlement"("key", "status");
CREATE INDEX "Entitlement_expiresAt_idx" ON "Entitlement"("expiresAt");

ALTER TABLE "BillingOrder"
  ADD CONSTRAINT "BillingOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPaymentEvent"
  ADD CONSTRAINT "BillingPaymentEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_sourceOrderId_fkey"
  FOREIGN KEY ("sourceOrderId") REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Initial plans
INSERT INTO "BillingPlan" ("id", "code", "title", "priceAmount", "priceCurrency", "periodDays", "isActive", "createdAt", "updatedAt")
VALUES
  ('plan_operator_monthly', 'OPERATOR_MONTHLY', 'Operator License - Monthly', 19.00, 'USD', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_operator_yearly', 'OPERATOR_YEARLY', 'Operator License - Yearly', 190.00, 'USD', 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "priceAmount" = EXCLUDED."priceAmount",
  "priceCurrency" = EXCLUDED."priceCurrency",
  "periodDays" = EXCLUDED."periodDays",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;


