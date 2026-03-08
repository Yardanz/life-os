"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type EvolutionDay = 1 | 3 | 5 | 7;
export type EvolutionTrack = "base" | "operator";
export type EvolutionModalMode = "manual" | "auto";

type SystemEvolutionModalProps = {
  open: boolean;
  track: EvolutionTrack | null;
  day: EvolutionDay | null;
  unlocked: boolean;
  plan: "FREE" | "PRO";
  mode: EvolutionModalMode;
  includeOperatorSection: boolean;
  onClose: () => void;
};

type MilestoneCopy = {
  lockedTitle: string;
  lockedLines: string[];
  unlockedTitle: string;
  unlockedLines: string[];
};

const BASE_COPY: Record<EvolutionDay, MilestoneCopy> = {
  1: {
    lockedTitle: "Core System Status",
    lockedLines: [
      "The system core status layer is active.",
      "You now have access to: Life Score, Guardrail state, and System confidence.",
      "This layer provides the base operational state of the system.",
    ],
    unlockedTitle: "Core System Status",
    unlockedLines: [
      "The system core status layer is active.",
      "You now have access to: Life Score, Guardrail state, and System confidence.",
      "This layer provides the base operational state of the system.",
    ],
  },
  3: {
    lockedTitle: "Trajectory unlocks on Day 3",
    lockedLines: ["The system requires more calibration data before exposing trajectory analysis."],
    unlockedTitle: "Trajectory and System Projection unlocked",
    unlockedLines: [
      "The system now exposes short-term trajectory analysis.",
      "New capability: 7-day trajectory visualization and System projection preview.",
      "Trajectory shows how your operational stability is evolving across recent days.",
    ],
  },
  5: {
    lockedTitle: "Diagnostics unlock on Day 5",
    lockedLines: ["The system requires additional calibration data before exposing deeper diagnostics."],
    unlockedTitle: "Partial diagnostics unlocked",
    unlockedLines: [
      "The system now exposes deeper operational signals.",
      "Available diagnostics: Anti-Chaos system, Recovery capacity, Load pressure, Risk probability, System drift, Calibration status.",
    ],
  },
  7: {
    lockedTitle: "Full diagnostics unlock on Day 7",
    lockedLines: ["Baseline stabilization must complete before exposing the full model."],
    unlockedTitle: "Full diagnostics unlocked",
    unlockedLines: [
      "The system now exposes the full internal model.",
      "You can now access: Full model explanation, Diagnostic drivers, and Deep system analysis.",
    ],
  },
};

const OPERATOR_COPY: Record<EvolutionDay, MilestoneCopy> = {
  1: {
    lockedTitle: "Supporter access",
    lockedLines: ["Enable Operator plan to access the supporter depth track."],
    unlockedTitle: "Supporter access",
    unlockedLines: ["Support registered. Operator depth track is active and evolves with practical depth for operators."],
  },
  3: {
    lockedTitle: "Advanced trajectory unlocks on Day 3",
    lockedLines: ["Requires baseline check-ins and Operator entitlement before exposing the 30-day trajectory layer."],
    unlockedTitle: "Advanced trajectory",
    unlockedLines: ["Operator depth now includes advanced trajectory mapping tied to the 30-day trajectory layer."],
  },
  5: {
    lockedTitle: "Deep stability signals unlock on Day 5",
    lockedLines: ["Requires additional calibration data and Operator entitlement."],
    unlockedTitle: "Deep stability signals",
    unlockedLines: [
      "Operator depth now includes Anti-Chaos, Risk Probability, and System Drift.",
      "On restricted plan these modules remain visible but locked.",
    ],
  },
  7: {
    lockedTitle: "Deep diagnostics unlock on Day 7",
    lockedLines: ["Baseline stabilization and entitlement checks must complete before deep diagnostics."],
    unlockedTitle: "Deep diagnostics",
    unlockedLines: ["Deep diagnostics milestone reached. Future operator-depth analysis expands from this checkpoint."],
  },
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
  payload?: ReadonlyArray<{ value?: number; payload?: DemoPoint7d }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
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
  payload?: ReadonlyArray<{ dataKey?: string; value?: number; payload?: DemoPoint30d }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
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
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Demo 7-day trajectory</p>
      <p className="mt-1 text-xs text-zinc-400">
        Shows short-term system direction, day-to-day Life Score movement, and recent trajectory tracking.
      </p>
      <div className="mt-2 h-52 rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DEMO_7D} margin={{ top: 12, right: 16, bottom: 10, left: 16 }}>
            <CartesianGrid stroke="rgb(39 39 42)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "rgb(113 113 122)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} />
            <YAxis domain={[35, 65]} tick={{ fill: "rgb(113 113 122)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} width={44} />
            <Tooltip content={baseTooltip} cursor={{ stroke: "rgb(113 113 122)", strokeDasharray: "3 3", strokeOpacity: 0.5 }} />
            <Line type="monotone" dataKey="lifeScore" stroke="rgb(34 211 238)" strokeWidth={2.2} dot={{ r: 2.5, fill: "rgb(34 211 238)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Demo30dChart() {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Demo 30-day advanced trajectory</p>
      <p className="mt-1 text-xs text-zinc-400">Multi-line operator preview for baseline, stabilized path, and overload path over 30 days.</p>
      <div className="mt-2 h-56 rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DEMO_30D} margin={{ top: 12, right: 16, bottom: 10, left: 16 }}>
            <CartesianGrid stroke="rgb(39 39 42)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "rgb(113 113 122)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} />
            <YAxis domain={[35, 65]} tick={{ fill: "rgb(113 113 122)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgb(82 82 91)" }} width={44} />
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

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function SystemEvolutionModal({
  open,
  track,
  day,
  unlocked,
  plan,
  mode,
  includeOperatorSection,
  onClose,
}: SystemEvolutionModalProps) {
  const baseCopy = day ? BASE_COPY[day] : null;
  const operatorCopy = day ? OPERATOR_COPY[day] : null;

  const content = useMemo(() => {
    if (!day || !baseCopy || !operatorCopy) return null;

    if (mode === "manual") {
      const source = track === "operator" ? operatorCopy : baseCopy;
      return {
        heading: track === "operator" ? "Operator depth update" : "System evolution update",
        title: unlocked ? source.unlockedTitle : source.lockedTitle,
        sections: [
          {
            title: track === "operator" ? "Operator depth" : "Base system unlock",
            lines: unlocked ? source.unlockedLines : source.lockedLines,
          },
        ],
        showBaseDay3Chart: track === "base" && day === 3,
        showOperatorDay3Chart: track === "operator" && day === 3,
      };
    }

    if (includeOperatorSection) {
      return {
        heading: "System evolution update",
        title: `Day ${day} milestone reached`,
        sections: [
          { title: "Base system unlock", lines: unlocked ? baseCopy.unlockedLines : baseCopy.lockedLines },
          { title: "Operator depth unlock", lines: unlocked ? operatorCopy.unlockedLines : operatorCopy.lockedLines },
        ],
        showBaseDay3Chart: day === 3,
        showOperatorDay3Chart: day === 3,
      };
    }

    return {
      heading: "System evolution update",
      title: unlocked ? baseCopy.unlockedTitle : baseCopy.lockedTitle,
      sections: [{ title: "Base system unlock", lines: unlocked ? baseCopy.unlockedLines : baseCopy.lockedLines }],
      showBaseDay3Chart: day === 3,
      showOperatorDay3Chart: false,
    };
  }, [baseCopy, day, includeOperatorSection, mode, operatorCopy, track, unlocked]);
  const showOperatorLicenseCta = plan === "FREE";

  if (!open || !content) return null;

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="System evolution modal" panelClassName="max-w-5xl p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{content.heading}</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">{content.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          {content.sections.map((section) => (
            <Section key={section.title} title={section.title} lines={section.lines} />
          ))}

          {content.showBaseDay3Chart ? <Demo7dChart /> : null}

          {content.showOperatorDay3Chart ? <Demo30dChart /> : null}

          {showOperatorLicenseCta ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-400">Operator depth is available on Operator License.</p>
              <Link
                href="/pricing"
                className="mt-2 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)] transition duration-200 hover:border-cyan-300 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                Get Operator License
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
