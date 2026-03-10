"use client";

import { InlineThemeToggle } from "@/components/theme/InlineThemeToggle";

type SystemStatusCardProps = {
  lifeScore: number;
  direction: "up" | "flat" | "down";
  lifeScoreTrendDelta?: number | null;
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

function trendLabel(direction: "up" | "flat" | "down"): string {
  if (direction === "up") return "Improving";
  if (direction === "down") return "Degrading";
  return "Stable";
}

function velocityLabel(delta: number): "Low" | "Moderate" | "High" {
  const magnitude = Math.abs(delta);
  if (magnitude >= 2.2) return "High";
  if (magnitude >= 0.9) return "Moderate";
  return "Low";
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

function statePanelClass(state: string): string {
  if (state === "LOCKDOWN") {
    return "border-rose-500/40 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.16)]";
  }
  if (state === "CAUTION") {
    return "border-amber-500/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.16)]";
  }
  return "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.16)]";
}

function stateRailClass(state: string): string {
  if (state === "LOCKDOWN") return "bg-rose-400/80";
  if (state === "CAUTION") return "bg-amber-400/80";
  return "bg-emerald-400/80";
}

function stateDotClass(state: string): string {
  if (state === "LOCKDOWN") return "bg-rose-300";
  if (state === "CAUTION") return "bg-amber-300";
  return "bg-emerald-300";
}

function stateHeaderClass(state: string): string {
  if (state === "LOCKDOWN") return "text-rose-200";
  if (state === "CAUTION") return "text-amber-200";
  return "text-emerald-200";
}

function stateLiveBadgeClass(state: string): string {
  if (state === "LOCKDOWN") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (state === "CAUTION") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export function SystemStatusCard({
  lifeScore,
  direction,
  lifeScoreTrendDelta = 0,
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
  const trend = trendLabel(direction);
  const velocity = velocityLabel(lifeScoreTrendDelta ?? 0);
  const riskLevel = signalBand(riskValue, "risk");
  const recoveryLevel = signalBand(recoveryValue, "recovery");
  const loadLevel = signalBand(loadValue, "load");
  const confidenceLine = confidenceHint ?? confidenceHintFromPct(confidencePct);
  const lines = interpretationLines.slice(0, 3);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Status</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Live control snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <InlineThemeToggle />
          {onGoHome ? (
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-zinc-500"
            >
              Home
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500 sm:mt-4">Primary indicators</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1.15fr_1fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-3xl font-semibold text-zinc-100">{lifeScore.toFixed(1)}</p>
            <span className={`text-sm font-medium uppercase tracking-[0.08em] ${directionSignal.tone}`}>
              {directionSignal.arrow} {directionSignal.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300">
              Trend: <span className={`ml-1 font-medium ${directionSignal.tone}`}>{trend}</span>
            </span>
            <span className="inline-flex rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300">
              Velocity: <span className="ml-1 font-medium text-zinc-100">{velocity}</span>
            </span>
          </div>
        </div>
        <div className={`relative overflow-hidden rounded-xl border p-3 sm:p-4 ${statePanelClass(state)}`}>
          <span aria-hidden className={`absolute inset-y-2 left-0 w-1 rounded-r ${stateRailClass(state)}`} />
          <div className="pl-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs uppercase tracking-wide ${stateHeaderClass(state)}`}>Current State / Guardrail</p>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${stateLiveBadgeClass(state)}`}
              >
                Live
              </span>
            </div>
            <p className={`mt-2 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-base font-semibold ${toneClass(state)}`}>
              <span aria-hidden className={`h-2 w-2 rounded-full ${stateDotClass(state)}`} />
              {state}
            </p>
            <p className="mt-2 text-xs text-zinc-200/85">{stateHint(state)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Confidence</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-100">{confidencePct}%</p>
          <p className="mt-2 text-xs text-zinc-400">{confidenceLine}</p>
        </div>
      </div>
      <div className="mt-3 sm:mt-4">
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
          className="mt-3 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400 sm:mt-4"
        >
          Model explanation
        </button>
      ) : (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400 sm:mt-4">
          {lockedHint ?? "Available after additional check-ins."}
        </div>
      )}
    </section>
  );
}
