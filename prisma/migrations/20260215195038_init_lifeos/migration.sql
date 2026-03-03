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
