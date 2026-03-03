"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS } from "@/lib/billing/config";

type PricingCapabilityActionsProps = {
  isAuthenticated: boolean;
  returnHref: string;
};

export function PricingCapabilityActions({
  isAuthenticated,
  returnHref,
}: PricingCapabilityActionsProps) {
  const [loadingPlan, setLoadingPlan] = useState<null | "OPERATOR_MONTHLY" | "OPERATOR_YEARLY">(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlow, setShowFlow] = useState(false);

  const createInvoice = async (planCode: "OPERATOR_MONTHLY" | "OPERATOR_YEARLY") => {
    try {
      setLoadingPlan(planCode);
      setError(null);
      const response = await fetch("/api/billing/create-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { invoiceUrl: string } }
        | { ok: false; error?: string; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Failed to create invoice." : payload.error ?? payload.message ?? "Failed to create invoice.");
      }
      window.location.href = payload.data.invoiceUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAuthenticated ? (
        <>
          <button
            type="button"
            onClick={() => void createInvoice("OPERATOR_MONTHLY")}
            disabled={loadingPlan !== null}
            className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan === "OPERATOR_MONTHLY"
              ? "Creating invoice..."
              : `Pay for Operator License (Monthly - ${PLANS.OPERATOR_MONTHLY.priceAmount} ${PLANS.OPERATOR_MONTHLY.priceCurrency})`}
          </button>
          <button
            type="button"
            onClick={() => void createInvoice("OPERATOR_YEARLY")}
            disabled={loadingPlan !== null}
            className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan === "OPERATOR_YEARLY"
              ? "Creating invoice..."
              : `Pay for Operator License (Yearly - ${PLANS.OPERATOR_YEARLY.priceAmount} ${PLANS.OPERATOR_YEARLY.priceCurrency})`}
          </button>
          <button
            type="button"
            onClick={() => setShowFlow((current) => !current)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            How activation works
          </button>
        </>
      ) : (
        <Link
          href="/pricing?auth=1&callbackUrl=/pricing"
          className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
        >
          Pay for Operator License
        </Link>
      )}
      <Link
        href={returnHref}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
      >
        Return to Control Room
      </Link>
      {showFlow ? (
        <p className="basis-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          Invoice -&gt; Payment -&gt; IPN -&gt; Entitlement.
        </p>
      ) : null}
      {error ? <p className="basis-full text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
