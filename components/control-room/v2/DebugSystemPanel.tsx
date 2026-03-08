"use client";

import { useState } from "react";

type DebugSystemPanelProps = {
  userId: string;
  userEmail: string | null;
  authProvider: string | null;
  planLabel: string;
  totalCheckins: number;
  onboardingProgress: string;
  currentEvolutionStage: string;
  nextUnlockDay: string;
  unlocked: {
    trajectory: boolean;
    partialDiagnostics: boolean;
    advancedControls: boolean;
    fullDiagnostics: boolean;
  };
  lastCheckinTimestamp: string;
  nextAllowedTimestamp: string;
  canCheckInNow: boolean;
  countdownLabel: string;
  lifeScore: string;
  guardrailState: string;
  protocolState: string;
  authority: string;
  confidence: string;
  calibrationStage: string;
  integrity: string;
  selectedDate: string;
  renderedDataDate: string;
  operationalDate: string;
  hasCheckinForOperationalDate: boolean;
  checkinMode: "create" | "edit";
  newlyUnlockedMilestone: "—" | "Day 3" | "Day 5" | "Day 7";
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onOpenCheckinForSelectedDay: () => void;
  uiPlanMode: "live" | "free" | "pro";
  onUiPlanModeChange: (mode: "live" | "free" | "pro") => void;
  canSimulate30Days: boolean;
  simulate30DaysLoading: boolean;
  simulate30DaysNotice: string | null;
  simulate30DaysError: string | null;
  onSimulate30Days: () => void;
  canSimulateBurnoutSpiral: boolean;
  simulateBurnoutSpiralLoading: boolean;
  onSimulateBurnoutSpiral: () => void;
  canSimulateRecoveryRebound: boolean;
  simulateRecoveryReboundLoading: boolean;
  onSimulateRecoveryRebound: () => void;
  canExportSimulationLog: boolean;
  exportSimulationLogLoading: boolean;
  exportSimulationLogNotice: string | null;
  exportSimulationLogError: string | null;
  onExportSimulationLog: () => void;
};

function row(label: string, value: string | number | boolean) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-zinc-200">{String(value)}</p>
    </div>
  );
}

export function DebugSystemPanel(props: DebugSystemPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-200">DEBUG</span>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">DEBUG / SYSTEM STATE</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
        >
          {open ? "Hide debug" : "Show debug"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Debug day navigator</p>
            <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={props.onPrevDay}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
              >
                Prev day
              </button>
              <button
                type="button"
                onClick={props.onToday}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
              >
                Today
              </button>
              <button
                type="button"
                onClick={props.onNextDay}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
              >
                Next day
              </button>
              <button
                type="button"
                onClick={props.onOpenCheckinForSelectedDay}
                className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:border-cyan-400"
              >
                Check-in for selected day
              </button>
              <span className="break-all font-mono text-xs text-zinc-400">date={props.selectedDate}</span>
              <span className="break-all font-mono text-xs text-zinc-500">rendered={props.renderedDataDate}</span>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Debug simulation harness</p>
            <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={props.onSimulate30Days}
                disabled={!props.canSimulate30Days || props.simulate30DaysLoading}
                className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
              >
                {props.simulate30DaysLoading ? "Simulating..." : "Simulate 30 days"}
              </button>
              <button
                type="button"
                onClick={props.onSimulateBurnoutSpiral}
                disabled={!props.canSimulateBurnoutSpiral || props.simulateBurnoutSpiralLoading}
                className="min-h-10 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
              >
                {props.simulateBurnoutSpiralLoading ? "Simulating..." : "Simulate burnout spiral"}
              </button>
              <button
                type="button"
                onClick={props.onSimulateRecoveryRebound}
                disabled={!props.canSimulateRecoveryRebound || props.simulateRecoveryReboundLoading}
                className="min-h-10 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
              >
                {props.simulateRecoveryReboundLoading ? "Simulating..." : "Simulate recovery rebound"}
              </button>
              <button
                type="button"
                onClick={props.onExportSimulationLog}
                disabled={!props.canExportSimulationLog || props.exportSimulationLogLoading}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
              >
                {props.exportSimulationLogLoading ? "Exporting..." : "Export simulation log"}
              </button>
              <p className="text-xs text-zinc-500">Uses real check-in processing and recalculation pipeline.</p>
            </div>
            {props.simulate30DaysNotice ? <p className="mt-2 text-xs text-emerald-300">{props.simulate30DaysNotice}</p> : null}
            {props.simulate30DaysError ? <p className="mt-2 text-xs text-rose-300">{props.simulate30DaysError}</p> : null}
            {props.exportSimulationLogNotice ? <p className="mt-2 text-xs text-emerald-300">{props.exportSimulationLogNotice}</p> : null}
            {props.exportSimulationLogError ? <p className="mt-2 text-xs text-rose-300">{props.exportSimulationLogError}</p> : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {row("user id", props.userId || "—")}
            {row("email", props.userEmail ?? "—")}
            {row("auth provider", props.authProvider ?? "—")}
            {row("current plan", props.planLabel)}
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">UI plan override</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "live" as const, label: "Live plan" },
                { id: "free" as const, label: "Force FREE" },
                { id: "pro" as const, label: "Force PRO" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => props.onUiPlanModeChange(option.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${
                    props.uiPlanMode === option.id
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {row("total check-ins", props.totalCheckins)}
            {row("onboarding progress (<=7)", props.onboardingProgress)}
            {row("current evolution stage", props.currentEvolutionStage)}
            {row("next unlock day", props.nextUnlockDay)}
            {row("unlocked: trajectory", props.unlocked.trajectory)}
            {row("unlocked: partial diagnostics", props.unlocked.partialDiagnostics)}
            {row("unlocked: advanced", props.unlocked.advancedControls)}
            {row("unlocked: full diagnostics", props.unlocked.fullDiagnostics)}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {row("last check-in timestamp", props.lastCheckinTimestamp)}
            {row("next allowed timestamp", props.nextAllowedTimestamp)}
            {row("canCheckInNow", props.canCheckInNow)}
            {row("countdown", props.countdownLabel)}
            {row("operational date", props.operationalDate)}
            {row("has check-in for operational date", props.hasCheckinForOperationalDate)}
            {row("check-in mode", props.checkinMode)}
            {row("newly unlocked milestone", props.newlyUnlockedMilestone)}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {row("life score", props.lifeScore)}
            {row("guardrail state", props.guardrailState)}
            {row("protocol state", props.protocolState)}
            {row("authority", props.authority)}
            {row("confidence", props.confidence)}
            {row("calibration stage", props.calibrationStage)}
            {row("drift / integrity", props.integrity)}
          </div>

          <p className="text-xs text-zinc-500">Rendered from current system state and progression helpers.</p>
        </div>
      ) : null}
    </section>
  );
}
