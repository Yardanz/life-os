import { BillingOrderStatus, Prisma, type BillingPlanCode } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { BILLING_PROVIDER, PLANS } from "@/lib/billing/config";
import { computeExpiresAt, isOperatorActive } from "@/lib/billing/entitlement";
import { createNowPaymentsInvoiceSession } from "@/lib/billing/nowpayments";
import { getPublicAppUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type PlanRecord = {
  code: BillingPlanCode;
  title: string;
  priceAmount: Prisma.Decimal;
  priceCurrency: string;
  periodDays: number;
  isActive: boolean;
};

function getUrl(path: string): string {
  const base = getPublicAppUrl().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function findPlan(code: BillingPlanCode): Promise<PlanRecord> {
  const fromDb = await prisma.billingPlan.findUnique({
    where: { code },
  });
  if (fromDb) return fromDb;
  const fallback = PLANS[code];
  if (!fallback) {
    throw new ApiError(400, "Unknown billing plan.");
  }
  return {
    code: fallback.code,
    title: fallback.title,
    priceAmount: new Prisma.Decimal(fallback.priceAmount),
    priceCurrency: fallback.priceCurrency,
    periodDays: fallback.periodDays,
    isActive: true,
  };
}

export async function createNowPaymentsCheckout(userId: string, planCode: BillingPlanCode) {
  const plan = await findPlan(planCode);
  if (!plan.isActive) {
    throw new ApiError(400, "Selected plan is not active.");
  }

  const order = await prisma.billingOrder.create({
    data: {
      userId,
      planCode,
      status: BillingOrderStatus.CREATED,
      amount: plan.priceAmount,
      currency: plan.priceCurrency,
      provider: BILLING_PROVIDER,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
    },
  });

  try {
    const statusUrl = getUrl(`/billing/status?order=${encodeURIComponent(order.id)}`);
    const invoice = await createNowPaymentsInvoiceSession({
      orderId: order.id,
      orderDescription: plan.title,
      priceAmount: order.amount.toString(),
      priceCurrency: order.currency,
      ipnCallbackUrl: getUrl("/api/webhooks/nowpayments"),
      successUrl: statusUrl,
      cancelUrl: statusUrl,
    });

    await prisma.$transaction(async (tx) => {
      await tx.billingOrder.update({
        where: { id: order.id },
        data: {
          status: BillingOrderStatus.INVOICE_CREATED,
          providerInvoiceId: invoice.providerInvoiceId ?? undefined,
          invoiceUrl: invoice.invoiceUrl,
          payCurrency: invoice.payCurrency ?? undefined,
        },
      });

      const priceAmount = new Prisma.Decimal(invoice.priceAmount || order.amount.toString());
      await tx.billingPayment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: BILLING_PROVIDER,
          providerInvoiceId: invoice.providerInvoiceId ?? undefined,
          providerPaymentId: invoice.providerPaymentId ?? undefined,
          payCurrency: invoice.payCurrency ?? undefined,
          priceAmount,
          status: "invoice_created",
          rawPayload: invoice.rawPayload as Prisma.InputJsonValue,
        },
        update: {
          providerInvoiceId: invoice.providerInvoiceId ?? undefined,
          providerPaymentId: invoice.providerPaymentId ?? undefined,
          payCurrency: invoice.payCurrency ?? undefined,
          priceAmount,
          status: "invoice_created",
          rawPayload: invoice.rawPayload as Prisma.InputJsonValue,
        },
      });
    });

    return {
      orderId: order.id,
      checkoutUrl: invoice.invoiceUrl,
      invoiceUrl: invoice.invoiceUrl,
    };
  } catch (error) {
    await prisma.billingOrder
      .update({
        where: { id: order.id },
        data: { status: BillingOrderStatus.FAILED },
      })
      .catch(() => null);
    throw error;
  }
}

export async function createInvoiceOrder(userId: string, planCode: BillingPlanCode) {
  return createNowPaymentsCheckout(userId, planCode);
}

export async function getBillingOrderForUser(userId: string, orderId: string) {
  return prisma.billingOrder.findFirst({
    where: {
      id: orderId,
      userId,
    },
    select: {
      id: true,
      planCode: true,
      status: true,
      amount: true,
      currency: true,
      provider: true,
      providerInvoiceId: true,
      invoiceUrl: true,
      payCurrency: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      payment: {
        select: {
          providerPaymentId: true,
          providerInvoiceId: true,
          status: true,
          actuallyPaid: true,
          confirmedAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function grantEntitlementFromPaidOrder(orderId: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.billingOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        planCode: true,
        paidAt: true,
      },
    });
    if (!order) throw new ApiError(404, "Billing order not found.");

    const existingEntitlement = await tx.entitlement.findUnique({
      where: { userId: order.userId },
      select: {
        id: true,
        userId: true,
        key: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        sourceOrderId: true,
      },
    });
    if (existingEntitlement?.sourceOrderId === order.id) {
      return existingEntitlement;
    }

    const plan = await tx.billingPlan.findUnique({
      where: { code: order.planCode },
      select: { periodDays: true },
    });
    const periodDays = plan?.periodDays ?? PLANS[order.planCode].periodDays;

    const paidAt = order.paidAt ?? now;
    await tx.billingOrder.update({
      where: { id: order.id },
      data: {
        status: BillingOrderStatus.PAID,
        paidAt,
      },
    });

    const baseDate =
      existingEntitlement && isOperatorActive(existingEntitlement, paidAt)
        ? existingEntitlement.expiresAt
        : paidAt;
    const nextExpiresAt = computeExpiresAt(baseDate, periodDays);
    const startsAt = existingEntitlement?.startsAt ?? paidAt;

    return tx.entitlement.upsert({
      where: { userId: order.userId },
      create: {
        userId: order.userId,
        key: "OPERATOR_LICENSE",
        status: "ACTIVE",
        startsAt: paidAt,
        expiresAt: nextExpiresAt,
        sourceOrderId: order.id,
      },
      update: {
        key: "OPERATOR_LICENSE",
        status: "ACTIVE",
        startsAt,
        expiresAt: nextExpiresAt,
        sourceOrderId: order.id,
      },
      select: {
        id: true,
        userId: true,
        key: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        sourceOrderId: true,
      },
    });
  });
}
