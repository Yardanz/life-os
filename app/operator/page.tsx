import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHeader } from "@/components/public/PageHeader";

export default function OperatorPage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <PageHeader
          kicker="OPERATOR GUIDE"
          title="Control Loop Reference"
        />

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Operating loop</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>1. Record daily check-in signals.</li>
            <li>2. Read guardrail, authority, and integrity state.</li>
            <li>3. Generate and apply protocol for next 24h constraints.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Guardrails</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>OPEN: constraints relaxed, normal operating caps.</li>
            <li>CAUTION: constraints tightened, volatility control required.</li>
            <li>LOCKDOWN: enforce recovery-first constraints immediately.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Calibration & Authority</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>CALIBRATING: baseline incomplete, authority is typically LOW.</li>
            <li>STABILIZED: baseline ready, authority may be MED or HIGH by confidence.</li>
            <li>Authority HIGH/MED/LOW is deterministic and confidence-bounded.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Protocols</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>Recommended protocol is advisory until applied.</li>
            <li>Active protocol enforces constraints and enables integrity tracing.</li>
            <li>Stabilize mode is tightened constraint operation for drift control.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Read-only modes</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>System Preview (`/demo`): deterministic simulation, no persisted user writes.</li>
            <li>System Snapshot (`/s/[token]`): public read-only state capture with expiry.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Non-goals</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            <li>No AI advice generation.</li>
            <li>No motivational loops or streak mechanics.</li>
            <li>No stochastic recommendation drift; transitions are deterministic.</li>
          </ul>
        </section>

        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
