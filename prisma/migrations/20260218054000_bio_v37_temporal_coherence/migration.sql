-- Bio v3.7: temporal coherence layers

ALTER TABLE "BioStateSnapshot"
  ADD COLUMN IF NOT EXISTS "homeostasisBias" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "cognitiveSaturation" DOUBLE PRECISION NOT NULL DEFAULT 0;
