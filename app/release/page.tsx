import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BackNavButton } from "@/components/ui/BackNavButton";
import { SYSTEM_VERSION } from "@/lib/version";

const RELEASE_CHANGES = [
  "Control Room now uses a unified daily check-in status model (operational date, create/edit mode, and next check-in window).",
  "System Evolution progression is explicit: Day 3 trajectory, Day 5 partial diagnostics, Day 7 full diagnostics, then onboarding strip removal on Day 8+.",
  "Onboarding now includes a multi-step tutorial flow shown on first entry and after reset, with controlled reopen access during Day 1-7.",
  "Diagnostics depth is split by entitlement: Observer depth remains available, Operator License unlocks full model analysis and deeper operator layers.",
  "Operator planning layer includes advanced trajectory (30-day + 72h envelope), intervention simulation, scenario compare/library, and Anti-Chaos controls.",
];

const OPERATIONAL_NOTES = [
  "Calibration authority remains limited until baseline confidence stabilizes (first 7 completed check-ins).",
  "Only one check-in is accepted per operational day; existing daily entries reopen in edit mode.",
  "System Evolution and its tutorial entry point exist only during onboarding (Day 1-7).",
  "Advanced trajectory, Anti-Chaos, scenario tools, and full operator-depth diagnostics require Operator License.",
  "Read-only simulation accounts, when enabled, do not permit write operations (check-ins, reset, or scenario writes).",
];

export default function ReleasePage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton fallbackHref="/" label={"\u2190 Back to Home"} variant="text" navigation="href" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">SYSTEM RELEASE</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Release Package</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Public system release document for the current LIFE OS architecture and capability access model.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Version</p>
          <h2 className="mt-2 text-sm font-semibold text-zinc-100">System v{SYSTEM_VERSION}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Current public release track. This package reflects active Control Room behavior, onboarding progression, and Operator License gating.
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Changes</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            {RELEASE_CHANGES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Operational Notes</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            {OPERATIONAL_NOTES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Data Handling</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            LIFE OS stores check-ins, deterministic system outputs, and operational state needed for control-room continuity (for example:
            progression status, diagnostics state, and trajectory/protocol artifacts when those capabilities are used).
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Stored data is used for deterministic computation and account continuity. Legal and privacy policy details are defined in the documents below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link
              href="/privacy"
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Terms
            </Link>
          </div>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}


