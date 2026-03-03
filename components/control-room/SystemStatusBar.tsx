"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { deriveAuthority } from "@/lib/control-room/authority";
import type { SystemStatus } from "@/lib/control-room/systemStatus";

type SystemStatusBarProps = {
  status: SystemStatus;
  rationale: string[];
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  modelConfidencePct: number;
  calibrationStage: "CALIBRATING" | "STABILIZED" | string;
  calibrationProgressText?: string;
  hasActiveProtocol: boolean;
};

function ribbonClass(guardrailState: string): string {
  if (guardrailState === "LOCKDOWN") return "bg-rose-500/90";
  if (guardrailState === "CAUTION") return "bg-amber-400/90";
  return "bg-cyan-400/90";
}

function statusClass(status: SystemStatus): string {
  if (status === "DEGRADED") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (status === "STRAINED") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (status === "RECOVERY") return "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

function authorityClass(authority: "HIGH" | "MED" | "LOW"): string {
  if (authority === "LOW") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (authority === "MED") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

export function SystemStatusBar({
  status,
  rationale,
  guardrailState,
  modelConfidencePct,
  calibrationStage,
  calibrationProgressText,
  hasActiveProtocol,
}: SystemStatusBarProps) {
  const [explainOpen, setExplainOpen] = useState(false);

  const headline = useMemo(() => rationale.slice(0, 2).join(" "), [rationale]);
  const safeConfidencePct = Number.isFinite(modelConfidencePct)
    ? Math.max(0, Math.min(100, Math.round(modelConfidencePct)))
    : 0;
  const authority = useMemo(
    () => deriveAuthority({ calibrationStage, modelConfidence: modelConfidencePct }),
    [calibrationStage, modelConfidencePct]
  );

  return (
    <>
      <section className="sticky top-0 z-40 rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-[0_10px_24px_rgba(0,0,0,0.32)] backdrop-blur">
        <div className={`h-[3px] w-full ${ribbonClass(guardrailState)}`} />
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">System Status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>{status}</span>
              <p className="truncate text-xs text-zinc-300">{headline}</p>
            </div>
            {authority.note ? <p className="mt-1 text-[11px] text-zinc-500">{authority.note}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-zinc-300">GUARDRAIL: {guardrailState}</span>
            <span className="rounded border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-zinc-300">
              MODEL CONFIDENCE: {safeConfidencePct}%
            </span>
            <span className="rounded border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-zinc-300">
              CALIBRATION: {calibrationStage}
              {calibrationProgressText ? ` (${calibrationProgressText.replace("Baseline calibration: ", "")})` : ""}
            </span>
            <span className="rounded border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-zinc-300">
              PROTOCOL: {hasActiveProtocol ? "Active" : "None"}
            </span>
            <span className={`rounded border px-2 py-1 ${authorityClass(authority.authority)}`}>
              AUTHORITY: {authority.authority}
            </span>
            <button
              type="button"
              onClick={() => setExplainOpen(true)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200 transition hover:border-zinc-500"
            >
              Explain
            </button>
          </div>
        </div>
      </section>

      <ModalShell open={explainOpen} onClose={() => setExplainOpen(false)} ariaLabel="System status rationale" panelClassName="max-w-lg p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">System Status Authority</h3>
          <p className="mt-1 text-xs text-zinc-400">Deterministic UI classification from current state signals.</p>

          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Current rationale</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
              {rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Rule mapping</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
              <li>LOCKDOWN {"->"} DEGRADED</li>
              <li>Integrity STRAIN {"->"} STRAINED</li>
              <li>CAUTION {"->"} STRAINED</li>
              <li>CALIBRATING and confidence &lt; 75% {"->"} RECOVERY</li>
              <li>Otherwise {"->"} STABLE</li>
            </ul>
          </div>

          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Authority classification</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
              <li>If CALIBRATION is not STABILIZED {"->"} LOW</li>
              <li>If confidence &lt; 70% {"->"} LOW</li>
              <li>If confidence is 70% to &lt;85% {"->"} MED</li>
              <li>Otherwise {"->"} HIGH</li>
            </ul>
            {authority.note ? <p className="mt-2 text-[11px] text-zinc-400">{authority.note}</p> : null}
          </div>
        </div>
      </ModalShell>
    </>
  );
}
