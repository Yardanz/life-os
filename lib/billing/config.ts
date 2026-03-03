import type { BillingPlanCode } from "@prisma/client";

export const BILLING_PROVIDER = "NOWPAYMENTS" as const;
export const DEFAULT_PRICE_CURRENCY = "USD" as const;

export const PLANS: Record<
  BillingPlanCode,
  {
    code: BillingPlanCode;
    title: string;
    priceAmount: string;
    priceCurrency: string;
    periodDays: number;
  }
> = {
  OPERATOR_MONTHLY: {
    code: "OPERATOR_MONTHLY",
    title: "Operator License - Monthly",
    priceAmount: "19.00",
    priceCurrency: DEFAULT_PRICE_CURRENCY,
    periodDays: 30,
  },
  OPERATOR_YEARLY: {
    code: "OPERATOR_YEARLY",
    title: "Operator License - Yearly",
    priceAmount: "190.00",
    priceCurrency: DEFAULT_PRICE_CURRENCY,
    periodDays: 365,
  },
};

