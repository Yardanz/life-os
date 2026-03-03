-- Bio v3.4: circadian alignment + sleep regularity

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "circadianAlignment" DOUBLE PRECISION NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS "sleepRegularity" DOUBLE PRECISION NOT NULL DEFAULT 70;
