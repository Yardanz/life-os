DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BillingPayment"
    WHERE "providerPaymentId" IS NOT NULL
    GROUP BY "provider", "providerPaymentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique index BillingPayment(provider, providerPaymentId): duplicates exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BillingOrder"
    WHERE "providerInvoiceId" IS NOT NULL
    GROUP BY "provider", "providerInvoiceId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique index BillingOrder(provider, providerInvoiceId): duplicates exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BillingPaymentEvent"
    WHERE "providerEventId" IS NOT NULL
    GROUP BY "orderId", "providerEventId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique index BillingPaymentEvent(orderId, providerEventId): duplicates exist.';
  END IF;
END $$;

DROP INDEX IF EXISTS "BillingPayment_provider_providerPaymentId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "BillingOrder_provider_providerInvoiceId_key"
ON "BillingOrder"("provider", "providerInvoiceId");

CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_provider_providerPaymentId_key"
ON "BillingPayment"("provider", "providerPaymentId");

CREATE UNIQUE INDEX IF NOT EXISTS "BillingPaymentEvent_orderId_providerEventId_key"
ON "BillingPaymentEvent"("orderId", "providerEventId");
