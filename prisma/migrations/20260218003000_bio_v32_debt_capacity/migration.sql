-- Bio v3.2: recovery debt + adaptive capacity sync

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "recoveryDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adaptiveCapacity" DOUBLE PRECISION NOT NULL DEFAULT 50;

ALTER TABLE "BioStateSnapshot"
  ALTER COLUMN "adaptiveCapacity" SET DEFAULT 50;
