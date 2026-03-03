"use client";

import { useState } from "react";
import { PLANS } from "@/lib/billing/config";
import { getOperatorStatusLabel } from "@/lib/billing/statusLabel";

type BillingPanelProps = {
  entitlement: {
    status: "ACTIVE" | "EXPIRED" | "REVOKED";
    startsAt: string;
    expiresAt: string;
  } | null;
  orders: Array<{
    id: string;
    planCode: "OPERATOR_MONTHLY" | "OPERATOR_YEARLY";
    status: string;
    amount: string;
    currency: string;
    invoiceUrl: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
};

export function BillingPanel({ entitlement, orders }: BillingPanelProps) {
  const [loading, setLoading] = useState<null | "OPERATOR_MONTHLY" | "OPERATOR_YEARLY">(null);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const statusLabel = getOperatorStatusLabel(
    entitlement
      ? {
          status: entitlement.status,
          expiresAt: new Date(entitlement.expiresAt),
        }
      : null
  );

  const handlePay = async (planCode: "OPERATOR_MONTHLY" | "OPERATOR_YEARLY") => {
    try {
      setLoading(planCode);
      setError(null);
      const response = await fetch("/api/billing/create-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { orderId: string; invoiceUrl: string } }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Failed to create invoice." : payload.error ?? "Failed to create invoice.");
      }
      window.location.href = payload.data.invoiceUrl;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create invoice.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 text-zinc-100 sm:px-6">
      <header className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Billing</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Operator License</h1>
        <p className="mt-1 text-sm text-zinc-300">{statusLabel}</p>
      </header>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Pay / Extend license</h2>
          <button
            type="button"
            onClick={() => setInfoOpen((current) => !current)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
          >
            How activation works
          </button>
        </div>
        {infoOpen ? (
          <p className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
            Invoice -&gt; Payment -&gt; IPN -&gt; Entitlement.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePay("OPERATOR_MONTHLY")}
            disabled={loading !== null}
            className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60 disabled:opacity-60"
          >
            {loading === "OPERATOR_MONTHLY"
              ? "Creating invoice..."
              : `Pay for Operator License (Monthly - ${PLANS.OPERATOR_MONTHLY.priceAmount} ${PLANS.OPERATOR_MONTHLY.priceCurrency})`}
          </button>
          <button
            type="button"
            onClick={() => void handlePay("OPERATOR_YEARLY")}
            disabled={loading !== null}
            className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60 disabled:opacity-60"
          >
            {loading === "OPERATOR_YEARLY"
              ? "Creating invoice..."
              : `Pay for Operator License (Yearly - ${PLANS.OPERATOR_YEARLY.priceAmount} ${PLANS.OPERATOR_YEARLY.priceCurrency})`}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Order history</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No billing orders yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <ul className="min-w-[720px] space-y-1.5 text-xs text-zinc-300">
              {orders.map((order) => (
                <li key={order.id} className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <p className="font-mono text-zinc-100">{order.id}</p>
                  <p className="mt-0.5 text-zinc-400">
                    {order.planCode} - {order.status} - {order.amount} {order.currency}
                  </p>
                  <p className="mt-0.5 text-zinc-500">
                    Created: {new Date(order.createdAt).toLocaleString()}
                    {order.paidAt ? ` - Paid: ${new Date(order.paidAt).toLocaleString()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
