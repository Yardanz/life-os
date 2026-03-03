"use client";

import { PanelState } from "@/components/control-room/PanelState";

type CheckinSnapshot = {
  date: string;
  sleepHours: number | null;
  sleepQuality: number | null;
  deepWorkMin: number | null;
  learningMin: number | null;
  stress: number | null;
  workout: number | null;
  moneyDelta: number | null;
} | null;

type InputUsage = {
  label: string;
  used: boolean;
  note?: string;
};

type ModelTransparencyPanelProps = {
  snapshot: CheckinSnapshot;
  risk: number;
  activeProtocolDeepWorkCap: number | null;
  calibrationProgressText?: string | null;
};

function fmtNumber(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value}${suffix}`;
}

export function ModelTransparencyPanel({
  snapshot,
  risk,
  activeProtocolDeepWorkCap,
  calibrationProgressText = null,
}: ModelTransparencyPanelProps) {
  const inputs: InputUsage[] = [
    { label: "Sleep duration", used: true },
    { label: "Sleep quality", used: true },
    { label: "Deep work minutes", used: true },
    { label: "Learning minutes", used: true },
    { label: "Stress", used: true },
    { label: "Workout / training", used: true },
    { label: "Money delta", used: false, note: "Recorded (not used in current state driver)." },
  ];

  const drivers: string[] = [];
  if (snapshot?.sleepHours != null && snapshot.sleepHours < 7) {
    drivers.push("Recovery capacity constrained (sleep below baseline).");
  }
  if (snapshot?.stress != null && snapshot.stress >= 7) {
    drivers.push("High strain signal (stress elevated).");
  }
  const deepWorkLimit = activeProtocolDeepWorkCap ?? 90;
  if (snapshot?.deepWorkMin != null && snapshot.deepWorkMin > deepWorkLimit) {
    drivers.push("Cognitive load elevated (deep work high).");
  }
  if (risk >= 65) {
    drivers.push("Overload probability above threshold.");
  }

  const topDrivers = drivers.slice(0, 3);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h3 className="text-sm font-medium text-zinc-200">Model Transparency</h3>
      <p className="mt-1 text-xs text-zinc-500">Deterministic state derived from measurable inputs.</p>
      {calibrationProgressText ? (
        <p className="mt-1 text-[11px] text-zinc-500">Baseline not stabilized yet ({calibrationProgressText}).</p>
      ) : null}

      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Inputs Used</p>
        <ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
          {inputs.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5">
              <span>{item.label}</span>
              <span className={item.used ? "text-cyan-300" : "text-zinc-500"}>{item.used ? "Used" : item.note ?? "Recorded"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Last Check-in Snapshot</p>
        {snapshot ? (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-zinc-500">Date</span>
            <span className="text-zinc-200">{snapshot.date}</span>
            <span className="text-zinc-500">Sleep</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.sleepHours, "h")}</span>
            <span className="text-zinc-500">Sleep quality</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.sleepQuality, "/5")}</span>
            <span className="text-zinc-500">Deep work</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.deepWorkMin, "m")}</span>
            <span className="text-zinc-500">Learning</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.learningMin, "m")}</span>
            <span className="text-zinc-500">Stress</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.stress, "/10")}</span>
            <span className="text-zinc-500">Workout</span>
            <span className="text-zinc-200">
              {snapshot.workout == null ? "n/a" : snapshot.workout > 0 ? "Yes" : "No"}
            </span>
            <span className="text-zinc-500">Money delta</span>
            <span className="text-zinc-200">{fmtNumber(snapshot.moneyDelta)}</span>
          </div>
        ) : (
          <PanelState
            kind="empty"
            title="No check-ins recorded yet."
            subtitle="Start baseline calibration with a daily check-in."
          />
        )}
      </div>

      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Primary drivers (last 24h / last check-in)</p>
        {topDrivers.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
            {topDrivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No dominant driver deviations detected.</p>
        )}
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        No sentiment scoring. No behavioral streaks. No black-box inference.
      </p>
      {snapshot && drivers.length === 0 ? (
        <PanelState kind="insufficient" title="Baseline calibrating - limited confidence." />
      ) : null}
    </section>
  );
}
