import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHeader } from "@/components/public/PageHeader";
import { SYSTEM_VERSION } from "@/lib/version";

const RELEASE_CHANGES = [
  "System Status authority layer with guardrail and authority classification.",
  "Operational enforcement flow: Required Actions, Protocol activation, Constraint Trace.",
  "Deterministic Explain State, Model Transparency, and Integrity-first diagnostics.",
  "Interactive public system preview with controlled deterministic scenario walkthrough.",
  "Snapshot links with revocation/expiry controls and strict payload sanitization.",
];

const KNOWN_CONSTRAINTS = [
  "Model authority is limited during calibration (before baseline stabilizes).",
  "Forward simulation layers require sufficient baseline data and capability access.",
  "Snapshot links are read-only and expire automatically by policy.",
  "Read-only simulation sessions do not permit write operations.",
];

export default function ReleasePage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <PageHeader
          kicker="SYSTEM RELEASE"
          title="Release Package"
        />

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Version</h2>
          <p className="mt-2 text-sm text-zinc-300">System v{SYSTEM_VERSION}</p>
          <p className="mt-1 text-xs text-zinc-500">Release Candidate build. Operational verification in progress.</p>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Changes</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {RELEASE_CHANGES.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Known constraints</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {KNOWN_CONSTRAINTS.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Data handling summary</h2>
          <p className="mt-2 text-sm text-zinc-300">
            LIFE OS stores user check-ins and deterministic system outputs required for operation. Public preview and snapshot
            modes are read-only and do not expose personal identifiers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href="/privacy"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Terms
            </Link>
          </div>
        </section>

        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
