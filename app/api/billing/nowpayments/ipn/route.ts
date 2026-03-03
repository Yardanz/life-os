import crypto from "node:crypto";
import { BillingOrderStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { grantEntitlementFromPaidOrder } from "@/lib/billing/service";
import { getNowPaymentsIpnSecret } from "@/lib/env";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { prisma } from "@/lib/prisma";

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      output[key] = stableObject(input[key]);
    }
    return output;
  }
  return value;
}

function verifySignature(payload: unknown, provided: string | null, secret: string): boolean {
  if (!provided || provided.length === 0) return false;
  const canonical = JSON.stringify(stableObject(payload));
  const expected = crypto.createHmac("sha512", secret).update(canonical).digest("hex");
  const normalized = provided.trim().toLowerCase();
  if (!/^[a-f0-9]+$/.test(normalized)) return false;
  return safeEqualHex(expected, normalized);
}

function mapPaymentStatus(statusRaw: string): BillingOrderStatus {
  const value = statusRaw.trim().toLowerCase();
  if (value === "partially_paid") return BillingOrderStatus.PARTIAL;
  if (value === "finished") return BillingOrderStatus.PAID;
  if (value === "failed" || value === "expired") return BillingOrderStatus.FAILED;
  if (value === "refunded") return BillingOrderStatus.REFUNDED;
  return BillingOrderStatus.PENDING;
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

export async function POST(request: Request) {
  const secret = getNowPaymentsIpnSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
  }

  let payload: Record<string, unknown> | null = null;
  let signature: string | null = null;
  try {
    const raw = await request.text();
    signature = request.headers.get("x-nowpayments-sig");
    payload = JSON.parse(raw) as Record<string, unknown>;

    if (!verifySignature(payload, signature, secret)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orderId = readString(payload, "order_id", "orderId");
    const invoiceId = readString(payload, "invoice_id", "payment_id", "paymentId");
    const paymentStatus = readString(payload, "payment_status", "paymentStatus") ?? "unknown";
    const providerEventId = readString(payload, "payment_id", "invoice_id", "id");

    const order = orderId
      ? await prisma.billingOrder.findUnique({
          where: { id: orderId },
          select: { id: true, userId: true, status: true },
        })
      : await prisma.billingOrder.findFirst({
          where: { providerInvoiceId: invoiceId ?? undefined },
          select: { id: true, userId: true, status: true },
        });

    if (!order) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (providerEventId) {
      const duplicate = await prisma.billingPaymentEvent.findFirst({
        where: {
          orderId: order.id,
          providerEventId,
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ ok: true }, { status: 200 });
      }
    }

    const mappedStatus = mapPaymentStatus(paymentStatus);
    const payloadForStore = (payload ?? {}) as Prisma.InputJsonValue;
    await prisma.$transaction(async (tx) => {
      await tx.billingPaymentEvent.create({
        data: {
          orderId: order.id,
          providerEventId,
          statusRaw: paymentStatus,
          signature,
          payload: payloadForStore,
        },
      });

      await tx.billingOrder.update({
        where: { id: order.id },
        data: {
          status: mappedStatus,
          providerInvoiceId: invoiceId ?? undefined,
          paidAt: mappedStatus === BillingOrderStatus.PAID ? new Date() : undefined,
        },
      });
    });

    if (mappedStatus === BillingOrderStatus.PAID) {
      await grantEntitlementFromPaidOrder(order.id, new Date());
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
      name: "api.billing.nowpayments.ipn.POST",
      message: error instanceof Error ? error.message : "Failed to process NOWPayments IPN.",
      path: "/api/billing/nowpayments/ipn",
      meta: { hasPayload: Boolean(payload), hasSignature: Boolean(signature) },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
