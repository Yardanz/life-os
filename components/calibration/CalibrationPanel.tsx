"use client";

import { useEffect, useState } from "react";
import { computeNextCheckinCountdown, DEFAULT_TZ_OFFSET_MINUTES } from "@/lib/date/dayKey";

type CalibrationPanelProps = {
  unavailable?: boolean;
  onboardingCompleted: boolean;
  calibrationCheckinsDone: number;
  calibrationCheckinsNeeded: number;
  confidence: number;
  todayCheckInExists: boolean;
  onRunOnboarding: () => void;
  onOpenCheckin: () => void;
  onReloadSetup?: () => void;
  tzOffsetMinutes?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function CalibrationPanel({
  unavailable = false,
  onboardingCompleted,
  calibrationCheckinsDone,
  calibrationCheckinsNeeded,
  confidence,
  todayCheckInExists,
  onRunOnboarding,
  onOpenCheckin,
  onReloadSetup,
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
}: CalibrationPanelProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [timerWhyOpen, setTimerWhyOpen] = useState(false);
  const [, setTick] = useState(0);
  const needed = Math.max(1, calibrationCheckinsNeeded);
  const done = clamp(calibrationCheckinsDone, 0, needed);
  const remaining = Math.max(0, needed - done);
  const confidencePct = Math.round(clamp(confidence, 0, 1) * 100);
  const countdown = computeNextCheckinCountdown(new Date(), tzOffsetMinutes);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 60_000);
    return () => window.clearInterval(timerId);
  }, [tzOffsetMinutes]);

  return (
    <section className="rounded-xl border border-cyan-400/30 bg-cyan-500/7 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]">
      {unavailable ? (
        <>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Setup state unavailable</p>
          <p className="mt-2 text-sm text-zinc-200">
            Setup status could not be loaded. Calibration state may be incomplete.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onReloadSetup}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Reload setup state
            </button>
          </div>
        </>
      ) : !onboardingCompleted ? (
        
        <>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Commissioning required</p>
          <p className="mt-2 text-sm text-zinc-200">System not commissioned. Run onboarding before baseline operation.</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onRunOnboarding}
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
            >
              Run onboarding
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Calibration Mode</p>
          <p className="mt-2 text-sm text-zinc-100">
            Baseline calibration in progress (need {remaining} more check-ins)
          </p>
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{todayCheckInExists ? "Completed today" : "Not completed today"}</span>
              <span>•</span>
              <span>Next check-in in: {countdown.label}</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTimerWhyOpen((value) => !value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                >
                  Why?
                </button>
                {timerWhyOpen ? (
                  <div className="absolute right-0 top-6 z-20 w-72 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-300 shadow-[0_10px_25px_rgba(0,0,0,0.45)]">
                    Check-ins are calendar-based. New day unlocks at local midnight.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <div className="relative flex items-center gap-2">
                <span>Confidence</span>
                <button
                  type="button"
                  onClick={() => setWhyOpen((value) => !value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                >
                  Why?
                </button>
                {whyOpen ? (
                  <div className="absolute left-0 top-6 z-20 w-64 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-300 shadow-[0_10px_25px_rgba(0,0,0,0.45)]">
                    Confidence increases as baseline data accumulates. Until stabilized, projections are conservative.
                  </div>
                ) : null}
              </div>
              <span>{confidencePct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-cyan-400/80 transition-all duration-300" style={{ width: `${confidencePct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Model confidence limited. Collect {needed} check-ins to stabilize baseline ({done}/{needed}).
            </p>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onOpenCheckin}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              {todayCheckInExists ? "View last check-in" : "Start check-in"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
