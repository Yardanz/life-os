import { auth } from "@/auth";
import Link from "next/link";
import { LandingAuthOverlayController } from "@/components/auth/LandingAuthOverlayController";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { PricingCapabilityActions } from "@/app/pricing/PricingCapabilityActions";
import { PageHeader } from "@/components/public/PageHeader";

type CapabilityRow = {
  capability: string;
  description: string;
  free: string;
  pro: string;
};

const CAPABILITY_SECTIONS: Array<{ title: string; rows: CapabilityRow[] }> = [
  {
    title: "Core Control",
    rows: [
      {
        capability: "Daily check-in",
        description: "Daily input record for deterministic state updates.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Guardrails & diagnosis",
        description: "OPEN/CAUTION/LOCKDOWN with deterministic rationale.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "7-day trend",
        description: "Short-window trendline for baseline state tracking.",
        free: "Included",
        pro: "Included",
      },
    ],
  },
  {
    title: "Protocol Engine",
    rows: [
      {
        capability: "Operational protocol 24h (STANDARD)",
        description: "Generate and apply baseline operating constraints.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Protocol horizons 48h/72h",
        description: "Extended horizon protocol generation.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Stabilize mode (STABILIZE)",
        description: "Tightened protocol generation and apply flow.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Protocol log",
        description: "Review protocol runs and outcomes.",
        free: "View only",
        pro: "Included",
      },
    ],
  },
  {
    title: "Forward Simulation",
    rows: [
      {
        capability: "30-day projections",
        description: "Deterministic forward trajectories from current state.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Intervention simulation",
        description: "Projection with planned modifier deltas.",
        free: "Locked",
        pro: "Included",
      },
    ],
  },
  {
    title: "Scenario Layer",
    rows: [
      {
        capability: "Scenario Compare (A/B)",
        description: "Baseline vs selected scenario comparison at D30.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Scenario library",
        description: "Persist, inspect and reuse saved scenarios.",
        free: "Locked",
        pro: "Included",
      },
    ],
  },
  {
    title: "Anti-Chaos",
    rows: [
      {
        capability: "Anti-Chaos tightening",
        description: "Constrained protocol generation for unstable states.",
        free: "Locked",
        pro: "Included",
      },
    ],
  },
];

export default async function PricingPage() {
  const session = await auth();
  const returnHref = session ? "/app" : "/pricing?auth=1&callbackUrl=/app";

  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 text-zinc-100 sm:py-12">
        <PageHeader
          kicker="CAPABILITY SPECIFICATION"
          title="Observer Mode vs Operator License"
          subtitle="Observer Mode lets you monitor your system. Operator License lets you simulate and plan forward impact."
          navSlot={
            <>
              <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
              {!session ? (
                <Link
                  href="/pricing?auth=1&callbackUrl=/pricing"
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
                >
                  Sign in
                </Link>
              ) : null}
            </>
          }
        />

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          {CAPABILITY_SECTIONS.map((section) => (
            <article key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-950/60">
              <header className="border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">{section.title}</h2>
              </header>
              <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(12rem,1.2fr)_minmax(16rem,1.8fr)_minmax(9rem,1fr)_minmax(9rem,1fr)] text-left text-sm">
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Capability</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Description</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Observer Mode</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Operator License</div>
                  {section.rows.map((row) => (
                    <div key={`${section.title}-${row.capability}`} className="contents">
                      <div className="border-b border-zinc-800/70 px-4 py-2 text-zinc-200">{row.capability}</div>
                      <div className="border-b border-zinc-800/70 px-4 py-2 text-zinc-400">{row.description}</div>
                      <div className="border-b border-zinc-800/70 px-4 py-2 text-zinc-300 whitespace-nowrap">{row.free}</div>
                      <div className="border-b border-zinc-800/70 px-4 py-2 text-cyan-100 whitespace-nowrap">{row.pro}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 p-3 md:hidden">
                {section.rows.map((row) => (
                  <div key={`${section.title}-mobile-${row.capability}`} className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3">
                    <p className="text-sm text-zinc-200">{row.capability}</p>
                    <p className="mt-1 text-xs text-zinc-400">{row.description}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Observer Mode: <span className="text-zinc-300">{row.free}</span> | Operator License: <span className="text-cyan-100">{row.pro}</span>
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
          <PricingCapabilityActions
            isAuthenticated={Boolean(session)}
            returnHref={returnHref}
          />
        </section>

        <PublicFooter className="mt-8" />
      </main>
      {!session ? <LandingAuthOverlayController /> : null}
    </LifeOSBackground>
  );
}
