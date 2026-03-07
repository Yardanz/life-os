"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import type { StateExplanation } from "@/lib/control-room/stateExplanation";
import type { DeriveSystemStatusResult } from "@/lib/control-room/systemStatus";
import type { ControlRoomV2Data, ProtocolRunRecord } from "@/components/control-room/v2/types";

type SystemDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  data: ControlRoomV2Data;
  activeProtocol: ProtocolRunRecord | null;
  authorityStatus: DeriveSystemStatusResult;
  explanation: StateExplanation;
  operatorInsightsUnlocked: boolean;
};

function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

export function SystemDetailsModal({
  open,
  onClose,
  data,
  activeProtocol,
  authorityStatus,
  explanation,
  operatorInsightsUnlocked,
}: SystemDetailsModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="System details modal" panelClassName="max-w-3xl p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Diagnostics</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">Diagnostic Context</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Model explanation</p>
              <p className="mt-1">{data.executiveSummary?.explanation ?? data.diagnosis?.summary ?? "Model explanation unavailable."}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Primary driver: {data.executiveSummary?.primaryDriver ?? "—"} | Stability: {data.executiveSummary?.stabilityState ?? "—"}
              </p>
            </section>

            <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Guardrail</p>
              <p className="mt-1">{data.guardrail.label}</p>
              {data.guardrail.reasons.length > 0 ? <p className="mt-1 text-xs text-zinc-400">{data.guardrail.reasons[0]}</p> : null}
            </section>

            {operatorInsightsUnlocked ? (
              <>
                <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Protocol</p>
                  <p className="mt-1">
                    {activeProtocol
                      ? `${activeProtocol.guardrailState} | ${activeProtocol.mode ?? "STANDARD"} | ${activeProtocol.horizonHours}h`
                      : "No active protocol"}
                  </p>
                </section>

                <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Authority</p>
                  <p className="mt-1">{authorityStatus.status}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
                    {authorityStatus.rationale.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Model confidence & calibration</p>
                  <p className="mt-1">Model confidence: {pct(data.modelConfidence.confidence * 100)}</p>
                  <p className="mt-1">Calibration: {data.calibration.active ? "active" : "inactive"}</p>
                  <p className="mt-1">Calibration confidence: {pct(data.calibration.confidence * 100)}</p>
                </section>

                <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Drift</p>
                  <p className="mt-1">
                    Integrity: {data.integrity.state} ({pct(data.integrity.score)})
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {data.integrity.violations.length > 0 ? data.integrity.violations.join(", ") : "No active drift violations."}
                  </p>
                </section>

                {data.plan === "PRO" ? (
                  <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Diagnostic drivers</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
                      {(data.breakdown ? [...data.breakdown.energy, ...data.breakdown.focus, ...data.breakdown.risk] : [])
                        .slice()
                        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                        .slice(0, 5)
                        .map((line) => (
                          <li key={`${line.label}-${line.value}`}>
                            {line.label}: {line.value >= 0 ? "+" : ""}
                            {line.value.toFixed(1)}
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : (
                  <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Diagnostic drivers</p>
                    <p className="mt-1 text-zinc-400">Detailed driver matrix is restricted to Operator plan.</p>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Operator insights</p>
                <p className="mt-1 text-zinc-400">System capabilities expanding as baseline stabilizes.</p>
                <p className="mt-1 text-xs text-zinc-500">Available after additional check-ins.</p>
              </section>
            )}

            <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-500">State explanation</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
                {explanation.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
