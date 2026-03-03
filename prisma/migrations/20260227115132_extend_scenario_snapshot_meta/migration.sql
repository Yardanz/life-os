-- AlterTable
ALTER TABLE "ScenarioSnapshot" ADD COLUMN     "horizonDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "tags" TEXT;
