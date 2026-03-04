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
    <div className="space-y-4">
      <div className="grid gap-4 md:auto-rows-fr md:grid-cols-2">
        <article className="flex h-full min-h-[18rem] flex-col rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Monthly</p>
            <h3 className="text-lg font-semibold text-zinc-100">Operator License</h3>
            <p className="text-2xl font-semibold text-cyan-100">
              {PLANS.OPERATOR_MONTHLY.priceAmount} {PLANS.OPERATOR_MONTHLY.priceCurrency}
            </p>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
            <li>Full operator capabilities</li>
            <li>Renews every {PLANS.OPERATOR_MONTHLY.periodDays} days</li>
            <li>Deterministic forecast and protocol stack</li>
          </ul>
          <div className="mt-auto pt-5">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => void createInvoice("OPERATOR_MONTHLY")}
                disabled={loadingPlan !== null}
                className="w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPlan === "OPERATOR_MONTHLY" ? "Creating invoice..." : "Pay monthly"}
              </button>
            ) : (
              <Link
                href="/pricing?auth=1&callbackUrl=/pricing"
                className="inline-flex w-full justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
              >
                Sign in to continue
              </Link>
            )}
          </div>
        </article>

        <article className="flex h-full min-h-[18rem] flex-col rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Yearly</p>
            <h3 className="text-lg font-semibold text-zinc-100">Operator License</h3>
            <p className="text-2xl font-semibold text-cyan-100">
              {PLANS.OPERATOR_YEARLY.priceAmount} {PLANS.OPERATOR_YEARLY.priceCurrency}
            </p>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-zinc-400">
            <li>Full operator capabilities</li>
            <li>Renews every {PLANS.OPERATOR_YEARLY.periodDays} days</li>
            <li>Best fit for continuous operation</li>
          </ul>
          <div className="mt-auto pt-5">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => void createInvoice("OPERATOR_YEARLY")}
                disabled={loadingPlan !== null}
                className="w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPlan === "OPERATOR_YEARLY" ? "Creating invoice..." : "Pay yearly"}
              </button>
            ) : (
              <Link
                href="/pricing?auth=1&callbackUrl=/pricing"
                className="inline-flex w-full justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
              >
                Sign in to continue
              </Link>
            )}
          </div>
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={returnHref}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
        >
          Return to Control Room
        </Link>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
