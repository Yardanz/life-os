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
