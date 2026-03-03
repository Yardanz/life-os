-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calibrationCheckinsDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calibrationCheckinsNeeded" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
