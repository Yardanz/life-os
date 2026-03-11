import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { BILLING_PROVIDER } from "@/lib/billing/config";
import {
  hashNowPaymentsPayload,
  isNowPaymentsConfirmed,
  mapNowPaymentsStatusToOrderStatus,
  normalizeNowPaymentsStatus,
  resolveNextOrderStatus,
  verifyNowPaymentsSignature,
} from "@/lib/billing/nowpayments";
import { grantEntitlementFromPaidOrder } from "@/lib/billing/service";
import { getNowPaymentsIpnSecret } from "@/lib/env.server";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { prisma } from "@/lib/prisma";

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function readDecimal(payload: Record<string, unknown>, ...keys: string[]): Prisma.Decimal | null {
  const raw = readString(payload, ...keys);
  if (!raw) return null;
  try {
    return new Prisma.Decimal(raw);
  } catch {
    return null;
  }
}

function isUniqueConstraintError(error: unknown, targetFields?: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  if (!targetFields || targetFields.length === 0) {
    return true;
  }
  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.map((value) => String(value))
    : [];
  return targetFields.every((field) => target.includes(field));
}

async function findOrderForWebhook(params: {
  orderId: string | null;
  providerInvoiceId: string | null;
  providerPaymentId: string | null;
}) {
  const clauses: Prisma.BillingOrderWhereInput[] = [];
  if (params.orderId) {
    clauses.push({ id: params.orderId });
  }
  if (params.providerInvoiceId) {
    clauses.push({ provider: BILLING_PROVIDER, providerInvoiceId: params.providerInvoiceId });
    clauses.push({
      payment: { is: { provider: BILLING_PROVIDER, providerInvoiceId: params.providerInvoiceId } },
    });
  }
  if (params.providerPaymentId) {
    clauses.push({
      payment: { is: { provider: BILLING_PROVIDER, providerPaymentId: params.providerPaymentId } },
    });
  }
  if (clauses.length === 0) {
    return null;
  }

  return prisma.billingOrder.findFirst({
    where: {
      OR: clauses,
    },
    select: {
      id: true,
      userId: true,
    },
  });
}

export async function handleNowPaymentsWebhook(request: Request, routePath: string) {
  const secret = getNowPaymentsIpnSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
  }

  let payload: Record<string, unknown> | null = null;
  let signature: string | null = null;

  try {
    const raw = await request.text();
    signature = request.headers.get("x-nowpayments-sig");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    payload = readObject(parsed);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    if (!verifyNowPaymentsSignature(payload, signature, secret)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orderId = readString(payload, "order_id", "orderId");
    const providerInvoiceId = readString(payload, "invoice_id", "invoiceId", "id");
    const providerPaymentId = readString(payload, "payment_id", "paymentId");
    const paymentStatusRaw = readString(payload, "payment_status", "paymentStatus");
    const normalizedStatus = normalizeNowPaymentsStatus(paymentStatusRaw);

    const order = await findOrderForWebhook({
      orderId,
      providerInvoiceId,
      providerPaymentId,
    });
    if (!order) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const payloadHash = hashNowPaymentsPayload(payload);
    const providerEventId = `${providerPaymentId ?? "-"}:${providerInvoiceId ?? "-"}:${normalizedStatus}:${payloadHash}`;

    const mappedStatus = mapNowPaymentsStatusToOrderStatus(normalizedStatus);
    const receivedAt = new Date();
    const priceAmount = readDecimal(payload, "price_amount", "priceAmount");
    const actuallyPaid = readDecimal(
      payload,
      "actually_paid",
      "actuallyPaid",
      "pay_amount",
      "payAmount"
    );
    const payCurrency = readString(payload, "pay_currency", "payCurrency");
    const payAddress = readString(payload, "pay_address", "payAddress");
    const payloadForStore = payload as Prisma.InputJsonValue;

    const result = await prisma.$transaction(async (tx) => {
      try {
        await tx.billingPaymentEvent.create({
          data: {
            orderId: order.id,
            providerEventId,
            statusRaw: normalizedStatus,
            signature,
            payload: payloadForStore,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error, ["orderId", "providerEventId"])) {
          return { duplicate: true as const, nextStatus: null, paidAt: null };
        }
        throw error;
      }

      await tx.billingPayment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: BILLING_PROVIDER,
          providerPaymentId: providerPaymentId ?? undefined,
          providerInvoiceId: providerInvoiceId ?? undefined,
          payCurrency: payCurrency ?? undefined,
          priceAmount: priceAmount ?? undefined,
          actuallyPaid: actuallyPaid ?? undefined,
          status: normalizedStatus,
          rawPayload: payloadForStore,
          confirmedAt: isNowPaymentsConfirmed(normalizedStatus) ? receivedAt : null,
        },
        update: {
          providerPaymentId: providerPaymentId ?? undefined,
          providerInvoiceId: providerInvoiceId ?? undefined,
          payCurrency: payCurrency ?? undefined,
          priceAmount: priceAmount ?? undefined,
          actuallyPaid: actuallyPaid ?? undefined,
          status: normalizedStatus,
          rawPayload: payloadForStore,
          confirmedAt: isNowPaymentsConfirmed(normalizedStatus) ? receivedAt : undefined,
        },
      });

      const currentOrder = await tx.billingOrder.findUnique({
        where: { id: order.id },
        select: { status: true, paidAt: true },
      });
      if (!currentOrder) {
        throw new ApiError(404, "Billing order not found.");
      }

      const nextStatus = resolveNextOrderStatus(currentOrder.status, mappedStatus);
      const paidAt =
        nextStatus === "PAID" ? (currentOrder.paidAt ?? receivedAt) : (currentOrder.paidAt ?? null);
      await tx.billingOrder.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          providerInvoiceId: providerInvoiceId ?? undefined,
          payCurrency: payCurrency ?? undefined,
          payAddress: payAddress ?? undefined,
          paidAt: nextStatus === "PAID" ? paidAt : undefined,
        },
      });

      return {
        duplicate: false as const,
        nextStatus,
        paidAt,
      };
    });

    if (result.duplicate) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (result.nextStatus === "PAID" && isNowPaymentsConfirmed(normalizedStatus)) {
      await grantEntitlementFromPaidOrder(order.id, result.paidAt ?? new Date());
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.billing.nowpayments.webhook.POST",
      message: error instanceof Error ? error.message : "Failed to process NOWPayments webhook.",
      path: routePath,
      meta: {
        hasPayload: Boolean(payload),
        hasSignature: Boolean(signature),
      },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
