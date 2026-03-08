import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BackNavButton } from "@/components/ui/BackNavButton";

export default function OperatorPage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">OPERATOR GUIDE</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Control Loop Reference</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Operator manual for the current LIFE OS control loop and decision boundaries.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Operating loop</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">
            <li>1. Record one daily check-in for the current operational date.</li>
            <li>2. Let the model recompute Life Score, guardrail, diagnostics, and trajectory state.</li>
            <li>3. Review guardrail, authority status, integrity signal, and next check-in window.</li>
            <li>4. If operator-depth is available, run advanced trajectory/scenario/anti-chaos controls before execution.</li>
            <li>5. Execute within constraints and repeat on the next operational day.</li>
          </ol>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Guardrails</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              <span className="font-medium text-zinc-100">OPEN</span>: normal operating envelope; standard constraint pressure.
            </li>
            <li>
              <span className="font-medium text-zinc-100">CAUTION</span>: tightened envelope; volatility control and stricter pacing required.
            </li>
            <li>
              <span className="font-medium text-zinc-100">LOCKDOWN</span>: recovery-first operation; high-risk actions are constrained.
            </li>
            <li>Transitions are deterministic outputs from current risk, recovery/load balance, and integrity context.</li>
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Calibration & Authority</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Calibration runs across early check-ins (onboarding window) and increases confidence as baseline stabilizes.</li>
            <li>Onboarding unlock path: Day 3 trajectory, Day 5 partial diagnostics, Day 7 full diagnostics shell.</li>
            <li>
              Authority status is expressed as <span className="font-medium text-zinc-100">STABLE / STRAINED / DEGRADED / RECOVERY</span>,
              derived from guardrail, integrity state, active protocol presence, risk horizon, and model confidence.
            </li>
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Protocols</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Protocol outputs and constraints are deterministic for the same input state.</li>
            <li>When an active protocol exists, it is treated as the currently enforced operating envelope.</li>
            <li>Operator-depth controls can generate advanced stabilization plans (including Anti-Chaos), but they remain explicit operator actions.</li>
            <li>Protocol mode and horizon are shown as state/context, not as autonomous decision-making.</li>
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Read-only modes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Read-only simulation account mode disables write operations (check-ins, reset, billing mutations, scenario writes).</li>
            <li>System Snapshot (`/s/[token]`) provides public read-only state capture with expiry and revocation controls.</li>
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Non-goals</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>No motivational gamification or streak economy.</li>
            <li>No opaque stochastic recommendations as a primary control mechanism.</li>
            <li>No replacement of operator judgment; the system provides deterministic state and constraint context.</li>
          </ul>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
