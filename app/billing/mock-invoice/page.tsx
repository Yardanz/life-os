import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";

type MockInvoiceProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MockInvoicePage({ searchParams }: MockInvoiceProps) {
  const params = (await searchParams) ?? {};
  const order = Array.isArray(params.order) ? params.order[0] : params.order;
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10 text-zinc-100">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">NOWPayments Placeholder</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Invoice requested</h1>
          <p className="mt-2 text-sm text-zinc-300">Order: {order ?? "-"}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Placeholder invoice route. Entitlement is granted only after verified IPN.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app/settings/billing"
              className="inline-flex min-h-10 items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm text-cyan-100 transition hover:border-cyan-400/60"
            >
              Open Billing Settings
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Return to Capability Spec
            </Link>
          </div>
        </section>
      </main>
    </LifeOSBackground>
  );
}
