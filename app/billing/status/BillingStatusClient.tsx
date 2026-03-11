"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OrderSnapshot = {
  id: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  payment: {
    status: string;
    actuallyPaid: string | null;
    confirmedAt: string | null;
  } | null;
};

type BillingStatusClientProps = {
  orderId: string;
  initialOrder: OrderSnapshot | null;
  initialLicense: {
    active: boolean;
    status: string | null;
    expiresAt: string | null;
  };
};

const TERMINAL_ORDER_STATUSES = new Set(["PAID", "FAILED", "CANCELED", "REFUNDED"]);

export default function BillingStatusClient({
  orderId,
  initialOrder,
  initialLicense,
}: BillingStatusClientProps) {
  const [order, setOrder] = useState<OrderSnapshot | null>(initialOrder);
  const [license, setLicense] = useState(initialLicense);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollAttemptsRef = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/billing/orders/${encodeURIComponent(orderId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              order: OrderSnapshot;
              license: { active: boolean; status: string | null; expiresAt: string | null };
            };
          }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok
            ? "Failed to load order status."
            : (payload.error ?? "Failed to load order status.")
        );
      }
      setOrder(payload.data.order);
      setLicense(payload.data.license);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to load order status.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const shouldPoll = useMemo(() => {
    if (!order) return false;
    if (license.active) return false;
    return !TERMINAL_ORDER_STATUSES.has(order.status);
  }, [license.active, order]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      if (pollAttemptsRef.current >= 40) {
        window.clearInterval(timer);
        return;
      }
      pollAttemptsRef.current += 1;
      void refreshStatus();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshStatus, shouldPoll]);

  const statusTitle = license.active
    ? "Operator License active"
    : order?.status === "PAID"
      ? "Payment confirmed"
      : "Awaiting payment confirmation";

  const statusHint = license.active
    ? license.expiresAt
      ? `Access granted until ${new Date(license.expiresAt).toLocaleString()}.`
      : "Access granted."
    : "Payment return URL is informational. Access changes only after verified NOWPayments webhook.";

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Billing Status</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{statusTitle}</h1>
      <p className="mt-2 text-sm text-zinc-300">{statusHint}</p>

      <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-300">
        <p className="font-mono text-xs text-zinc-400 break-all">Order: {orderId}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>Order status: {order?.status ?? "-"}</span>
          <span className="text-zinc-600">|</span>
          <span>Payment status: {order?.payment?.status ?? "-"}</span>
          <span className="text-zinc-600">|</span>
          <span>
            Amount: {order?.amount ?? "-"} {order?.currency ?? ""}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={loading}
          className="inline-flex min-h-10 items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm text-cyan-100 transition hover:border-cyan-400/60 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh status"}
        </button>
        <Link
          href="/app/settings/billing"
          className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 transition hover:border-zinc-500"
        >
          Open Billing Settings
        </Link>
        {license.active ? (
          <Link
            href="/app"
            className="inline-flex min-h-10 items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm text-emerald-100 transition hover:border-emerald-400/60"
          >
            Open Control Room
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}
