import { auth } from "@/auth";
import { LandingAuthOverlayController } from "@/components/auth/LandingAuthOverlayController";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PricingCapabilityActions } from "@/app/pricing/PricingCapabilityActions";
import { BackNavButton } from "@/components/ui/BackNavButton";

type CapabilityRow = {
  capability: string;
  description: string;
  free: string;
  pro: string;
};

type CapabilitySection = {
  title: string;
  summary: string;
  rows: CapabilityRow[];
};

const CAPABILITY_SECTIONS: CapabilitySection[] = [
  {
    title: "Core System",
    summary: "Common control-room foundation available to every account.",
    rows: [
      {
        capability: "Daily check-in",
        description: "One operational check-in per day with deterministic state update.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Life Score, Guardrail, confidence",
        description: "State snapshot with OPEN/CAUTION/LOCKDOWN interpretation.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Daily mode + next window timer",
        description: "Unified create/edit daily state with next check-in availability window.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "System Evolution + tutorial (Day 1-7)",
        description: "Onboarding strip and tutorial entry while onboarding window is active.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Glossary and system explanation flows",
        description: "Operational terminology and in-product explanation access.",
        free: "Included",
        pro: "Included",
      },
    ],
  },
  {
    title: "Trajectory & Planning",
    summary: "Trajectory unlocks by onboarding day, operator depth extends planning horizon.",
    rows: [
      {
        capability: "7-day trajectory (Day 3 unlock)",
        description: "Base trendline from recent check-ins.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "30-day advanced trajectory + 72h envelope",
        description: "Forward projection panel with decision-budget context after trajectory unlock.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Intervention simulator",
        description: "Apply deltas and preview impact on forward projection.",
        free: "Locked",
        pro: "Included",
      },
      {
        capability: "Scenario compare and scenario B projection",
        description: "Baseline vs selected scenario comparison at D30.",
        free: "Locked",
        pro: "Included",
      },
    ],
  },
  {
    title: "Diagnostics Depth",
    summary: "Diagnostic layers unlock by day, with deeper operator-only fields.",
    rows: [
      {
        capability: "Partial diagnostics (Day 5 unlock)",
        description: "Recovery Capacity, Load Pressure, and Calibration Status.",
        free: "Included",
        pro: "Included",
      },
      {
        capability: "Full diagnostics shell (Day 7 unlock)",
        description: "Diagnostic workspace appears for all accounts, depth depends on plan.",
        free: "Observer depth",
        pro: "Operator depth",
      },
      {
        capability: "Risk Probability + System Drift",
        description: "Deeper diagnostics cards shown as restricted on Observer Mode.",
        free: "Locked preview",
        pro: "Included",
      },
      {
        capability: "Full Model Analysis",
        description: "Driver impacts, risk mechanics, hidden model effects and full explanation.",
        free: "Locked",
        pro: "Included",
      },
    ],
  },
  {
    title: "Operator Layer",
    summary: "Paid operator capabilities for stabilization and scenario operations.",
    rows: [
      {
        capability: "Anti-Chaos controls and protocol actions",
        description: "Stabilization controls and anti-chaos action availability.",
        free: "Locked preview",
        pro: "Included",
      },
      {
        capability: "Scenario library (save/reuse)",
        description: "Persist, reload, and manage scenario runs.",
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
      <main className="pricing-main mx-auto min-h-screen w-full max-w-6xl px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton
            fallbackHref="/"
            label="← Back to Home"
            variant="text"
            navigation="href"
          />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">CAPABILITY SPECIFICATION</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Observer Mode vs Operator License</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              Observer Mode covers daily control and baseline diagnostics. Operator License unlocks advanced trajectory, deeper diagnostics, and Anti-Chaos operations.
            </p>
          </div>
        </header>

        <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
          {CAPABILITY_SECTIONS.map((section) => (
            <article key={section.title} className="light-lift-card overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
              <header className="border-b border-zinc-800 bg-zinc-950/70 px-4 py-3.5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">{section.title}</h2>
                <p className="mt-1 text-xs text-zinc-400">{section.summary}</p>
              </header>
              <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(12rem,1.2fr)_minmax(16rem,1.8fr)_minmax(9rem,1fr)_minmax(9rem,1fr)] text-left text-sm">
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Capability</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Description</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Observer Mode</div>
                  <div className="border-b border-zinc-800 px-4 py-2 font-medium text-zinc-400">Operator License</div>
                  {section.rows.map((row, index) => {
                    const rowTone = index % 2 === 0 ? "bg-zinc-950/25" : "bg-zinc-950/10";
                    return (
                      <div key={`${section.title}-${row.capability}`} className="contents">
                        <div className={`border-b border-zinc-800/70 px-4 py-2.5 text-zinc-100 ${rowTone}`}>{row.capability}</div>
                        <div className={`border-b border-zinc-800/70 px-4 py-2.5 text-zinc-400 ${rowTone}`}>{row.description}</div>
                        <div className={`border-b border-zinc-800/70 px-4 py-2.5 whitespace-nowrap text-zinc-300 ${rowTone}`}>{row.free}</div>
                        <div className={`border-b border-zinc-800/70 px-4 py-2.5 whitespace-nowrap text-cyan-100 ${rowTone}`}>{row.pro}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 p-3 md:hidden">
                {section.rows.map((row) => (
                  <div key={`${section.title}-mobile-${row.capability}`} className="light-lift-card rounded-md border border-zinc-800 bg-zinc-900/70 p-3.5">
                    <p className="text-sm font-medium text-zinc-100">{row.capability}</p>
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

        <section className="light-lift-card mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
          <div className="mb-5 space-y-1.5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">License plans</p>
            <h2 className="text-lg font-semibold text-zinc-100">Enable Operator depth</h2>
            <p className="text-sm text-zinc-400">Choose billing period to unlock operator-only trajectory, diagnostics, scenarios, and anti-chaos layers.</p>
          </div>
          <PricingCapabilityActions
            isAuthenticated={Boolean(session)}
            returnHref={returnHref}
          />
        </section>

        <section className="light-lift-card mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Payment processing</p>
            <h2 className="text-base font-semibold text-zinc-100">Checkout and access activation</h2>
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Payments are processed through hosted checkout.</li>
            <li>Prices are displayed in USD.</li>
            <li>Final charged amount may vary depending on selected payment method and applicable provider or network fees.</li>
            <li>Operator License access is activated only after confirmed payment verification.</li>
            <li>Return page or browser redirect alone does not grant access.</li>
            <li>Failed, expired, or unconfirmed payments do not activate paid access.</li>
          </ul>
        </section>

        <PublicFooter className="mt-8" />
      </main>
      {!session ? <LandingAuthOverlayController /> : null}
    </LifeOSBackground>
  );
}
