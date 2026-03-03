-- Billing enums
CREATE TYPE "BillingPlanCode" AS ENUM ('OPERATOR_MONTHLY', 'OPERATOR_YEARLY');
CREATE TYPE "BillingOrderStatus" AS ENUM ('CREATED', 'INVOICE_CREATED', 'PENDING', 'PARTIAL', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');
CREATE TYPE "EntitlementKey" AS ENUM ('OPERATOR_LICENSE');
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- Billing tables
CREATE TABLE "BillingPlan" (
  "id" TEXT NOT NULL,
  "code" "BillingPlanCode" NOT NULL,
  "title" TEXT NOT NULL,
  "priceAmount" DECIMAL(18,2) NOT NULL,
  "priceCurrency" TEXT NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCode" "BillingPlanCode" NOT NULL,
  "status" "BillingOrderStatus" NOT NULL DEFAULT 'CREATED',
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'NOWPAYMENTS',
  "providerInvoiceId" TEXT,
  "invoiceUrl" TEXT,
  "payAddress" TEXT,
  "payCurrency" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPaymentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "providerEventId" TEXT,
  "statusRaw" TEXT NOT NULL,
  "signature" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Entitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" "EntitlementKey" NOT NULL,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sourceOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPlan_code_key" ON "BillingPlan"("code");
CREATE INDEX "BillingOrder_userId_createdAt_idx" ON "BillingOrder"("userId", "createdAt");
CREATE INDEX "BillingOrder_status_createdAt_idx" ON "BillingOrder"("status", "createdAt");
CREATE INDEX "BillingPaymentEvent_orderId_receivedAt_idx" ON "BillingPaymentEvent"("orderId", "receivedAt");
CREATE UNIQUE INDEX "Entitlement_userId_key" ON "Entitlement"("userId");
CREATE INDEX "Entitlement_key_status_idx" ON "Entitlement"("key", "status");
CREATE INDEX "Entitlement_expiresAt_idx" ON "Entitlement"("expiresAt");

ALTER TABLE "BillingOrder"
  ADD CONSTRAINT "BillingOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPaymentEvent"
  ADD CONSTRAINT "BillingPaymentEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_sourceOrderId_fkey"
  FOREIGN KEY ("sourceOrderId") REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Initial plans
INSERT INTO "BillingPlan" ("id", "code", "title", "priceAmount", "priceCurrency", "periodDays", "isActive", "createdAt", "updatedAt")
VALUES
  ('plan_operator_monthly', 'OPERATOR_MONTHLY', 'Operator License - Monthly', 19.00, 'USD', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_operator_yearly', 'OPERATOR_YEARLY', 'Operator License - Yearly', 190.00, 'USD', 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "priceAmount" = EXCLUDED."priceAmount",
  "priceCurrency" = EXCLUDED."priceCurrency",
  "periodDays" = EXCLUDED."periodDays",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
