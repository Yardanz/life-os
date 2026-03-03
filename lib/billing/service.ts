import { BillingOrderStatus, Prisma, type BillingPlanCode } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { BILLING_PROVIDER, PLANS } from "@/lib/billing/config";
import { computeExpiresAt, isOperatorActive } from "@/lib/billing/entitlement";
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

export async function createInvoiceOrder(userId: string, planCode: BillingPlanCode) {
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
    },
  });

  const invoiceUrl = `${getPublicAppUrl().replace(/\/+$/, "")}/billing/mock-invoice?order=${order.id}`;
  // TODO(nowpayments): replace placeholder URL with invoice URL returned by NOWPayments API.
  await prisma.billingOrder.update({
    where: { id: order.id },
    data: {
      status: BillingOrderStatus.INVOICE_CREATED,
      invoiceUrl,
    },
  });
  return { orderId: order.id, invoiceUrl };
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

    // Idempotency guard: repeated PAID notifications for the same order
    // must not extend entitlement more than once.
    if (order.status === BillingOrderStatus.PAID) {
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
      if (existingEntitlement) {
        return existingEntitlement;
      }
    }

    const plan = await tx.billingPlan.findUnique({
      where: { code: order.planCode },
      select: { periodDays: true },
    });
    const periodDays = plan?.periodDays ?? PLANS[order.planCode].periodDays;

    await tx.billingOrder.update({
      where: { id: order.id },
      data: {
        status: BillingOrderStatus.PAID,
        paidAt: order.paidAt ?? now,
      },
    });

    const existing = await tx.entitlement.findUnique({
      where: { userId: order.userId },
      select: {
        id: true,
        key: true,
        status: true,
        startsAt: true,
        expiresAt: true,
      },
    });

    const baseDate = existing && isOperatorActive(existing, now) ? existing.expiresAt : now;
    const nextExpiresAt = computeExpiresAt(baseDate, periodDays);
    const startsAt = existing?.startsAt ?? now;

    return tx.entitlement.upsert({
      where: { userId: order.userId },
      create: {
        userId: order.userId,
        key: "OPERATOR_LICENSE",
        status: "ACTIVE",
        startsAt: now,
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
