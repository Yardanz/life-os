"use client";

import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
import { minutesToTimeInput } from "@/lib/date/timeMinutes";

type AntiChaosModalProps = {
  open: boolean;
  onClose: () => void;
  protocol: AntiChaosProtocol | null;
  isPro: boolean;
};

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function AntiChaosModal({ open, onClose, protocol, isPro }: AntiChaosModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Anti-Chaos stabilization protocol"
        className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Stabilization Protocol</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Anti-Chaos Mode</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Close
          </button>
        </div>

        {!isPro ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            Anti-Chaos Protocol is available with Operator License.
          </div>
        ) : null}

        {isPro && !protocol ? (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            Generate protocol in the Projection panel to view impact details.
          </div>
        ) : null}

        {isPro && protocol ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Projection Impact ({protocol.horizonHours}h)</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
                  <p className="text-xs text-zinc-500">Baseline @ horizon</p>
                  <p>LifeScore {protocol.impact.baselineAtHorizon.lifeScore.toFixed(1)}</p>
                  <p>Risk {protocol.impact.baselineAtHorizon.risk.toFixed(1)}</p>
                  <p>Burnout {protocol.impact.baselineAtHorizon.burnout.toFixed(1)}</p>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
                  <p className="text-xs text-zinc-500">Protocol @ horizon</p>
                  <p>
                    LifeScore {protocol.impact.protocolAtHorizon.lifeScore.toFixed(1)} ({signed(protocol.impact.deltas.lifeScore)})
                  </p>
                  <p>
                    Risk {protocol.impact.protocolAtHorizon.risk.toFixed(1)} ({signed(protocol.impact.deltas.risk)})
                  </p>
                  <p>
                    Burnout {protocol.impact.protocolAtHorizon.burnout.toFixed(1)} ({signed(protocol.impact.deltas.burnout)})
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Targeted Drivers</p>
              <p className="mt-1 text-sm text-zinc-100">{protocol.why.primaryDriver}</p>
              {protocol.why.secondaryDriver ? <p className="text-sm text-zinc-300">{protocol.why.secondaryDriver}</p> : null}
              {protocol.patternInfluence.systemMode !== "stable" ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Pattern influence: {protocol.patternInfluence.systemMode} (severity-based weighting applied)
                </p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-400">{protocol.why.summary}</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Detected</p>
              <p className="mt-1 text-sm text-zinc-200">
                {protocol.detected.pattern} (confidence {(protocol.detected.confidence * 100).toFixed(0)}%)
              </p>
              {protocol.actions.wakeAnchorShiftMin !== 0 && typeof protocol.brief.wakeAnchorMinutes === "number" ? (
                <p className="mt-2 text-sm text-zinc-300">
                  Wake anchor: {minutesToTimeInput(protocol.brief.wakeAnchorMinutes)} ({protocol.actions.wakeAnchorShiftMin}m)
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Main Priority</p>
              <p className="mt-1 text-sm text-zinc-100">{protocol.brief.mainPriority}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Secondary</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                  <li>- {protocol.brief.secondary[0]}</li>
                  <li>- {protocol.brief.secondary[1]}</li>
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Mandatory Recovery</p>
                <p className="mt-2 text-sm text-zinc-200">{protocol.brief.mandatoryRecovery}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Cut List</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                  {protocol.brief.cutList.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Expected Effects</p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                  <li>Energy: {signed(protocol.brief.expectedEffects.Energy)}</li>
                  <li>Focus: {signed(protocol.brief.expectedEffects.Focus)}</li>
                  <li>Risk: {signed(protocol.brief.expectedEffects.risk)}</li>
                  <li>LifeScore: {signed(protocol.brief.expectedEffects.lifeScore)}</li>
                  <li>Burnout: {signed(protocol.brief.expectedEffects.burnout)}</li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
