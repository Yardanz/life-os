"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { NextActionPrimaryButton } from "@/components/control-room/v2/NextActionCard";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type OnboardingTutorialModalProps = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onFinish: () => void;
  onBeginCheckin: () => void;
};

type DemoPoint7d = { day: string; lifeScore: number };
type DemoPoint30d = { day: string; baseline: number; stabilize: number; overload: number };

const DEMO_7D: DemoPoint7d[] = [
  { day: "Mar 8", lifeScore: 50.1 },
  { day: "Mar 9", lifeScore: 49.4 },
  { day: "Mar 10", lifeScore: 48.8 },
  { day: "Mar 11", lifeScore: 50.4 },
  { day: "Mar 12", lifeScore: 51.1 },
  { day: "Mar 13", lifeScore: 51.2 },
  { day: "Mar 14", lifeScore: 49.2 },
];

const DEMO_30D: DemoPoint30d[] = [
  { day: "D0", baseline: 51.8, stabilize: 52.0, overload: 51.3 },
  { day: "D3", baseline: 51.1, stabilize: 54.4, overload: 49.8 },
  { day: "D7", baseline: 50.6, stabilize: 55.6, overload: 45.3 },
  { day: "D14", baseline: 50.1, stabilize: 56.1, overload: 44.2 },
  { day: "D21", baseline: 49.7, stabilize: 56.8, overload: 44.6 },
  { day: "D29", baseline: 49.2, stabilize: 57.4, overload: 45.2 },
];

function baseTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DemoPoint7d }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200">
      <p className="font-medium">{row.day}</p>
      <p>Life Score: {row.lifeScore.toFixed(1)}</p>
    </div>
  );
}

function operatorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DemoPoint30d }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200">
      <p className="font-medium">{row.day}</p>
      <p>BASE: {row.baseline.toFixed(1)}</p>
      <p className="text-emerald-300">STB: {row.stabilize.toFixed(1)}</p>
      <p className="text-amber-300">OVR: {row.overload.toFixed(1)}</p>
    </div>
  );
}

function Demo7dChart() {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">7-day trajectory preview</p>
      <div className="mt-2 h-44 rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DEMO_7D} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgb(39 39 42)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "rgb(113 113 122)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} />
            <YAxis domain={[35, 65]} tick={{ fill: "rgb(113 113 122)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} width={40} />
            <Tooltip content={baseTooltip} cursor={{ stroke: "rgb(113 113 122)", strokeDasharray: "3 3", strokeOpacity: 0.5 }} />
            <Line type="monotone" dataKey="lifeScore" stroke="rgb(34 211 238)" strokeWidth={2.1} dot={{ r: 2.3, fill: "rgb(34 211 238)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Demo30dChart() {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">30-day advanced trajectory preview</p>
      <div className="mt-2 h-48 rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DEMO_30D} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgb(39 39 42)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "rgb(113 113 122)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} />
            <YAxis domain={[35, 65]} tick={{ fill: "rgb(113 113 122)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} width={40} />
            <Tooltip content={operatorTooltip} cursor={{ stroke: "rgb(113 113 122)", strokeDasharray: "3 3", strokeOpacity: 0.5 }} />
            <Line type="monotone" dataKey="baseline" stroke="rgb(34 211 238)" strokeWidth={2.1} dot={false} />
            <Line type="monotone" dataKey="stabilize" stroke="rgb(52 211 153)" strokeWidth={2.1} dot={false} />
            <Line type="monotone" dataKey="overload" stroke="rgb(251 113 133)" strokeWidth={2.1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StepWelcome() {
  return (
    <div className="space-y-3">
      <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
        LIFE OS is a system stability console, not a productivity app.
      </section>
      <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
        It helps keep operation sustainable, reduce overload, and maintain system capacity over time.
      </section>
    </div>
  );
}

function StepCheckinEntryPreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">Daily check-ins are the entry point. They refresh state and unlock deeper system visibility over time.</p>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Next action</p>
          <p className="mt-1 text-sm text-zinc-300">Record today&apos;s check-in to update current system state.</p>
          <NextActionPrimaryButton label="Record today's check-in" inert />
          <p className="mt-2 text-xs text-zinc-500">Demo preview only</p>
        </div>
      </section>
    </div>
  );
}

function StepCheckinInternalsPreview() {
  const frames = useMemo(
    () => [
      { sleep: "7.0h", stress: "4", work: "60m", workout: "Off", focus: "Moderate" },
      { sleep: "7.5h", stress: "5", work: "90m", workout: "On", focus: "High" },
      { sleep: "6.8h", stress: "6", work: "45m", workout: "Off", focus: "Low" },
    ],
    []
  );
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrameIndex((value) => (value + 1) % frames.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [frames.length]);

  const frame = frames[frameIndex];

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">Check-ins log daily signals. These inputs continuously update Life Score, Guardrail state, and diagnostics.</p>
      <section className="pointer-events-none rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Check-in internals (demo)</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            Sleep hours: <span className="text-zinc-100">{frame.sleep}</span>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            Stress: <span className="text-zinc-100">{frame.stress}</span>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            Deep work: <span className="text-zinc-100">{frame.work}</span>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
            Workout: <span className="text-zinc-100">{frame.workout}</span>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-300">
          Projected focus signal: <span className="text-zinc-100">{frame.focus}</span>
        </div>
      </section>
    </div>
  );
}

function StepTrajectoryPreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">At Day 3, trajectory becomes available and shows short-horizon direction from recent check-ins.</p>
      <Demo7dChart />
      <p className="text-sm text-zinc-300">Operator License adds deeper forward trajectory modeling.</p>
      <Demo30dChart />
    </div>
  );
}

function StepDeepDiagnosticsPreview() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">Deeper diagnostics explain what is driving state, where instability forms, and what to adjust first.</p>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Recovery capacity</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">62.4%</p>
          </article>
          <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Load pressure</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">58.1%</p>
          </article>
          <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Risk probability</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">36.2%</p>
          </article>
          <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">System drift</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">Stable (22%)</p>
          </article>
        </div>
      </section>
    </div>
  );
}

const TOTAL_STEPS = 5;

function stepTitle(step: number): string {
  if (step === 0) return "Welcome to LIFE OS";
  if (step === 1) return "Daily check-in entry point";
  if (step === 2) return "Inside the check-in";
  if (step === 3) return "Trajectory unlock preview";
  return "Deep diagnostics preview";
}

export function OnboardingTutorialModal({
  open,
  saving,
  error,
  onClose,
  onFinish,
  onBeginCheckin,
}: OnboardingTutorialModalProps) {
  const [step, setStep] = useState(0);
  const handleShellClose = () => {
    setStep(0);
    onClose();
  };

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <ModalShell open={open} onClose={handleShellClose} ariaLabel="LIFE OS onboarding tutorial" panelClassName="max-w-5xl p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Tutorial step {step + 1} / {TOTAL_STEPS}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">{stepTitle(step)}</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3 sm:p-4">
            {step === 0 ? <StepWelcome /> : null}
            {step === 1 ? <StepCheckinEntryPreview /> : null}
            {step === 2 ? <StepCheckinInternalsPreview /> : null}
            {step === 3 ? <StepTrajectoryPreview /> : null}
            {step === 4 ? <StepDeepDiagnosticsPreview /> : null}
          </div>

          {error ? <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={saving}
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Back
              </button>
            ) : null}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.min(TOTAL_STEPS - 1, value + 1))}
                disabled={saving}
                className="min-h-10 w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Next
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => requestClose(onFinish)}
                  disabled={saving}
                  className="min-h-10 w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "Saving..." : "Enter Control Room"}
                </button>
                <button
                  type="button"
                  onClick={() => requestClose(onBeginCheckin)}
                  disabled={saving}
                  className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Begin check-in
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
