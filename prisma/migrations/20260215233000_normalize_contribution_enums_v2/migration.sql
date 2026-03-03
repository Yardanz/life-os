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
