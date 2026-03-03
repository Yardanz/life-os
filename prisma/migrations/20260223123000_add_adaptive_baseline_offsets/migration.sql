-- Add user-level adaptive baseline offsets (homeostatic memory layer)
ALTER TABLE "User"
ADD COLUMN "adaptiveRiskOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adaptiveRecoveryOffset" DOUBLE PRECISION NOT NULL DEFAULT 0;
