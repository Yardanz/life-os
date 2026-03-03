"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import type {
  ControlRoomBreakdown,
  ControlRoomExecutiveSummary,
  ControlRoomPatternSignal,
  ControlRoomPatterns,
  ControlRoomCalibration,
  PatternType,
} from "@/lib/control-room/types";

type DiagnosisBreakdownModalProps = {
  open: boolean;
  onClose: () => void;
  executiveSummary: ControlRoomExecutiveSummary;
  breakdown: ControlRoomBreakdown;
  patterns: ControlRoomPatterns;
  calibration: ControlRoomCalibration;
};

function lineToneClass(tone: "positive" | "negative" | "neutral"): string {
  if (tone === "positive") return "text-emerald-300";
  if (tone === "negative") return "text-rose-300";
  return "text-zinc-400";
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  if (value < 0) return value.toFixed(1);
  return "0.0";
}

function BreakdownSection({ title, lines }: { title: string; lines: ControlRoomBreakdown["energy"] }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((line) => (
          <li key={`${title}-${line.label}`} className="flex items-center justify-between gap-3">
            <span className="text-zinc-300">{line.label}</span>
            <span className={lineToneClass(line.tone)}>{formatSigned(line.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PATTERN_LABELS: Record<PatternType, string> = {
  cyclical_stress_load: "Cyclical stress load",
  sleep_irregularity: "Sleep irregularity",
  burnout_acceleration: "Burnout acceleration",
  autonomic_drift: "Autonomic drift",
  circadian_drift: "Circadian drift",
};

function severityClass(severity: ControlRoomPatternSignal["severity"]): string {
  if (severity === 3) return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (severity === 2) return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (severity === 1) return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function modeLabel(mode: ControlRoomPatterns["systemMode"]): string {
  switch (mode) {
    case "overload":
      return "Overload";
    case "drift":
      return "Drift";
    case "cycle":
      return "Cycle";
    default:
      return "Stable";
  }
}

export function DiagnosisBreakdownModal({
  open,
  onClose,
  executiveSummary,
  breakdown,
  patterns,
  calibration,
}: DiagnosisBreakdownModalProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "patterns">("summary");

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      ariaLabel="System breakdown"
      panelClassName="max-w-3xl overflow-hidden p-0 text-zinc-100"
    >
      {({ requestClose }) => (
        <div className="max-h-[85vh] flex flex-col">
          <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Diagnosis</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-100">System State Summary</h2>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Close
              </button>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-5 pr-4 pt-4">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="mb-4 inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`rounded px-3 py-1.5 ${
                    activeTab === "summary" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("patterns")}
                  className={`rounded px-3 py-1.5 ${
                    activeTab === "patterns" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Patterns
                </button>
              </div>
              {activeTab === "summary" ? (
                <>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <dt className="text-zinc-400">Primary driver</dt>
                      <dd className="text-zinc-100">{executiveSummary.primaryDriver}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <dt className="text-zinc-400">Secondary driver</dt>
                      <dd className="text-zinc-100">{executiveSummary.secondaryDriver ?? "None"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <dt className="text-zinc-400">Stability</dt>
                      <dd className="text-zinc-100">{executiveSummary.stabilityState}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <dt className="text-zinc-400">Trajectory</dt>
                      <dd className="text-zinc-100">{executiveSummary.trajectory}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">What this means</p>
                    <p className="mt-1 text-sm text-zinc-200">{executiveSummary.explanation}</p>
                  </div>
                  <details className="mt-4">
                    <summary className="inline-flex cursor-pointer list-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500">
                      Deep diagnostic
                    </summary>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <BreakdownSection title="Energy" lines={breakdown.energy} />
                      <BreakdownSection title="Focus" lines={breakdown.focus} />
                      <BreakdownSection title="Discipline" lines={breakdown.discipline} />
                      <BreakdownSection title="Fatigue" lines={breakdown.fatigue} />
                      <BreakdownSection title="Strain" lines={breakdown.strain} />
                      <BreakdownSection title="Risk" lines={breakdown.risk} />
                    </div>
                  </details>
                  <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Calibration</p>
                    <p className="mt-1 text-sm text-zinc-200">
                      {calibration.active ? "Active" : "Inactive"} ({calibration.confidence.toFixed(2)})
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Sleep→Energy {calibration.sensitivities.sleepEnergy}, Stress→Focus{" "}
                      {calibration.sensitivities.stressFocus}, Workout→Strain{" "}
                      {calibration.sensitivities.workoutStrain}, Circadian→Risk{" "}
                      {calibration.sensitivities.circadianRisk}, Debt→Burnout{" "}
                      {calibration.sensitivities.debtBurnout}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300">
                    System mode: <span className="text-zinc-100">{modeLabel(patterns.systemMode)}</span>
                    <span className="ml-2 text-zinc-500">
                      ({Math.round(patterns.systemModeConfidence * 100)}%)
                    </span>
                  </div>
                  {patterns.patterns.length > 0 ? (
                    patterns.patterns.map((pattern) => (
                      <article
                        key={pattern.type}
                        className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-zinc-100">{PATTERN_LABELS[pattern.type]}</p>
                            <p className="mt-1 text-xs text-zinc-400">{pattern.headline}</p>
                          </div>
                          <span className={`rounded border px-2 py-0.5 text-xs ${severityClass(pattern.severity)}`}>
                            Severity {pattern.severity}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pattern.evidence.slice(0, 4).map((item) => (
                            <span
                              key={`${pattern.type}-${item.key}`}
                              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
                            >
                              {item.key}: {item.value}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-zinc-400">
                          Drivers: {pattern.drivers.join(", ") || "none"}
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-400">
                      No significant patterns detected in the selected window.
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="pointer-events-none sticky bottom-0 mt-3 h-6 bg-gradient-to-t from-zinc-950 to-transparent" />
          </div>
        </div>
      )}
    </ModalShell>
  );
}
