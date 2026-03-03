import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";

export default function BillingCancelPage() {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10 text-zinc-100">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Billing</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Payment canceled</h1>
          <p className="mt-2 text-sm text-zinc-300">No entitlement update was applied.</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Return to Capability Spec
          </Link>
        </section>
      </main>
    </LifeOSBackground>
  );
}

