CREATE TABLE "BillingPayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'NOWPAYMENTS',
  "providerPaymentId" TEXT,
  "providerInvoiceId" TEXT,
  "payCurrency" TEXT,
  "priceAmount" DECIMAL(18,2),
  "actuallyPaid" DECIMAL(18,8),
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "rawPayload" JSONB,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPayment_orderId_key" ON "BillingPayment"("orderId");
CREATE INDEX "BillingPayment_provider_providerPaymentId_idx" ON "BillingPayment"("provider", "providerPaymentId");
CREATE INDEX "BillingPayment_providerInvoiceId_idx" ON "BillingPayment"("providerInvoiceId");

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
