"use client";

type SystemStatusCardProps = {
  lifeScore: number;
  direction: "up" | "flat" | "down";
  state: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  confidencePct: number;
  interpretationLines: string[];
  riskValue?: number | null;
  recoveryValue?: number | null;
  loadValue?: number | null;
  confidenceHint?: string;
  onExplain: () => void;
  onGoHome?: () => void;
  explainUnlocked: boolean;
  lockedHint?: string;
};

function toneClass(state: string): string {
  if (state === "LOCKDOWN") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (state === "CAUTION") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

function directionMeta(direction: "up" | "flat" | "down"): { arrow: string; label: string; tone: string } {
  if (direction === "up") {
    return { arrow: "↗", label: "improving", tone: "text-emerald-300" };
  }
  if (direction === "down") {
    return { arrow: "↘", label: "degrading", tone: "text-amber-300" };
  }
  return { arrow: "→", label: "stable", tone: "text-zinc-300" };
}

function stateHint(state: string): string {
  if (state === "LOCKDOWN") return "System restrictions active";
  if (state === "CAUTION") return "System under rising pressure";
  return "System operating within safe limits";
}

function signalBand(value: number | null | undefined, kind: "risk" | "recovery" | "load"): "LOW" | "MODERATE" | "HIGH" {
  if (typeof value !== "number" || Number.isNaN(value)) return "MODERATE";

  if (kind === "risk") {
    if (value >= 70) return "HIGH";
    if (value >= 35) return "MODERATE";
    return "LOW";
  }

  if (kind === "recovery") {
    if (value >= 65) return "HIGH";
    if (value >= 40) return "MODERATE";
    return "LOW";
  }

  if (value >= 65) return "HIGH";
  if (value >= 35) return "MODERATE";
  return "LOW";
}

function confidenceHintFromPct(confidencePct: number): string {
  if (confidencePct >= 90) return "Model confidence high";
  if (confidencePct >= 60) return "Model baseline stabilizing";
  return "Calibration in progress";
}

function signalTone(level: "LOW" | "MODERATE" | "HIGH"): string {
  if (level === "HIGH") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  if (level === "LOW") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

export function SystemStatusCard({
  lifeScore,
  direction,
  state,
  confidencePct,
  interpretationLines,
  riskValue = null,
  recoveryValue = null,
  loadValue = null,
  confidenceHint,
  onExplain,
  onGoHome,
  explainUnlocked,
  lockedHint,
}: SystemStatusCardProps) {
  const directionSignal = directionMeta(direction);
  const riskLevel = signalBand(riskValue, "risk");
  const recoveryLevel = signalBand(recoveryValue, "recovery");
  const loadLevel = signalBand(loadValue, "load");
  const confidenceLine = confidenceHint ?? confidenceHintFromPct(confidencePct);
  const lines = interpretationLines.slice(0, 3);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Status</p>
        {onGoHome ? (
          <button
            type="button"
            onClick={onGoHome}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-zinc-500"
          >
            Home
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-3xl font-semibold text-zinc-100">{lifeScore.toFixed(1)}</p>
            <span className={`text-sm font-medium uppercase tracking-[0.08em] ${directionSignal.tone}`}>
              {directionSignal.arrow} {directionSignal.label}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current State</p>
          <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-sm font-semibold ${toneClass(state)}`}>{state}</p>
          <p className="mt-2 text-xs text-zinc-400">{stateHint(state)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Confidence</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-100">{confidencePct}%</p>
          <p className="mt-2 text-xs text-zinc-400">{confidenceLine}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Interpretation</p>
        <div className="mt-2 space-y-1.5">
          {lines.map((line) => (
            <p key={line} className="text-sm text-zinc-300">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs ${signalTone(riskLevel)}`}>Risk: {riskLevel}</span>
        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs ${signalTone(recoveryLevel)}`}>Recovery: {recoveryLevel}</span>
        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs ${signalTone(loadLevel)}`}>Load Pressure: {loadLevel}</span>
      </div>
      {explainUnlocked ? (
        <button
          type="button"
          onClick={onExplain}
          className="mt-4 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400"
        >
          Explain this
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
          {lockedHint ?? "Available after additional check-ins."}
        </div>
      )}
    </section>
  );
}
