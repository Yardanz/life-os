import crypto from "node:crypto";
import { type BillingOrderStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { BILLING_PROVIDER } from "@/lib/billing/config";
import { getNowPaymentsApiKey, getNowPaymentsBaseUrl } from "@/lib/env";

type CreateNowPaymentsInvoiceInput = {
  orderId: string;
  orderDescription: string;
  priceAmount: string;
  priceCurrency: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
};

type CreateNowPaymentsInvoiceResult = {
  providerInvoiceId: string | null;
  providerPaymentId: string | null;
  invoiceUrl: string;
  payCurrency: string | null;
  priceAmount: string;
  rawPayload: Record<string, unknown>;
};

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

function readNumber(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toString();
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const asNumber = Number(value);
      if (Number.isFinite(asNumber)) return asNumber.toString();
    }
  }
  return null;
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

function toCanonicalJson(value: unknown): string {
  return JSON.stringify(stableObject(value));
}

function safeEqualHex(leftHex: string, rightHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseResponsePayload(payload: unknown): Record<string, unknown> {
  const asObject = readObject(payload);
  if (!asObject) {
    throw new ApiError(502, "NOWPayments returned malformed payload.");
  }
  return asObject;
}

export function hashNowPaymentsPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(toCanonicalJson(payload)).digest("hex");
}

export function verifyNowPaymentsSignature(
  payload: unknown,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || signature.trim().length === 0) return false;
  const canonical = toCanonicalJson(payload);
  const expected = crypto.createHmac("sha512", secret).update(canonical).digest("hex");
  return safeEqualHex(expected, signature.trim().toLowerCase());
}

export function normalizeNowPaymentsStatus(rawStatus: string | null | undefined): string {
  return (rawStatus ?? "unknown").trim().toLowerCase();
}

export function mapNowPaymentsStatusToOrderStatus(
  rawStatus: string | null | undefined
): BillingOrderStatus {
  const status = normalizeNowPaymentsStatus(rawStatus);
  if (status === "partially_paid") return "PARTIAL";
  if (status === "confirmed" || status === "finished") return "PAID";
  if (status === "failed" || status === "expired") return "FAILED";
  if (status === "canceled" || status === "cancelled") return "CANCELED";
  if (status === "refunded") return "REFUNDED";
  if (status === "invoice_created") return "INVOICE_CREATED";
  if (status === "waiting" || status === "confirming" || status === "sending") return "PENDING";
  return "PENDING";
}

export function isNowPaymentsConfirmed(rawStatus: string | null | undefined): boolean {
  const status = normalizeNowPaymentsStatus(rawStatus);
  return status === "confirmed" || status === "finished";
}

export function resolveNextOrderStatus(
  current: BillingOrderStatus,
  incoming: BillingOrderStatus
): BillingOrderStatus {
  if (current === "PAID") return current;
  if (current === "REFUNDED") return current;

  if (incoming === "PAID" || incoming === "REFUNDED") return incoming;

  if (incoming === "FAILED" || incoming === "CANCELED") {
    if (
      current === "CREATED" ||
      current === "INVOICE_CREATED" ||
      current === "PENDING" ||
      current === "PARTIAL"
    ) {
      return incoming;
    }
    return current;
  }

  if (incoming === "PARTIAL") {
    if (current === "CREATED" || current === "INVOICE_CREATED" || current === "PENDING") {
      return incoming;
    }
    return current;
  }

  if (incoming === "PENDING") {
    if (current === "CREATED" || current === "INVOICE_CREATED") {
      return incoming;
    }
    return current;
  }

  if (incoming === "INVOICE_CREATED" && current === "CREATED") {
    return incoming;
  }

  return current;
}

export async function createNowPaymentsInvoiceSession(
  input: CreateNowPaymentsInvoiceInput
): Promise<CreateNowPaymentsInvoiceResult> {
  const apiKey = getNowPaymentsApiKey();
  if (!apiKey) {
    throw new ApiError(503, "NOWPayments integration is not configured.");
  }

  const endpoint = `${getNowPaymentsBaseUrl().replace(/\/+$/, "")}/invoice`;
  const requestBody = {
    order_id: input.orderId,
    order_description: input.orderDescription,
    price_amount: Number(input.priceAmount),
    price_currency: input.priceCurrency.toLowerCase(),
    ipn_callback_url: input.ipnCallbackUrl,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    is_fixed_rate: true,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  let payloadRaw: unknown = null;
  try {
    payloadRaw = await response.json();
  } catch {
    payloadRaw = null;
  }

  if (!response.ok) {
    const errText =
      payloadRaw && typeof payloadRaw === "object"
        ? JSON.stringify(payloadRaw).slice(0, 280)
        : `HTTP_${response.status}`;
    throw new ApiError(502, `NOWPayments invoice request failed: ${errText}`);
  }

  const payload = parseResponsePayload(payloadRaw);
  const invoiceUrl = readString(payload, "invoice_url", "url", "invoiceUrl");
  if (!invoiceUrl) {
    throw new ApiError(502, "NOWPayments did not return checkout URL.");
  }

  const providerInvoiceId = readString(payload, "id", "invoice_id", "invoiceId");
  const providerPaymentId = readString(payload, "payment_id", "paymentId");
  const payCurrency = readString(payload, "pay_currency", "payCurrency");
  const priceAmount = readNumber(payload, "price_amount", "priceAmount") ?? input.priceAmount;

  return {
    providerInvoiceId,
    providerPaymentId,
    invoiceUrl,
    payCurrency,
    priceAmount,
    rawPayload: payload,
  };
}

export function isNowPaymentsProvider(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === BILLING_PROVIDER;
}
