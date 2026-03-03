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
