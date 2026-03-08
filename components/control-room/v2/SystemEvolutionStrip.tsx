"use client";

import { useState } from "react";
import type { EvolutionDay, EvolutionTrack } from "@/components/control-room/v2/SystemEvolutionModal";

type SystemEvolutionStripProps = {
  currentDay: EvolutionDay;
  onboardingProgressCheckins: number;
  nextUnlockDay: 3 | 5 | 7 | null;
  operatorPlanEnabled: boolean;
  collapsible?: boolean;
  onOpenTutorial?: () => void;
  onStageClick: (track: EvolutionTrack, day: EvolutionDay, unlocked: boolean) => void;
};

type StageItem = {
  day: EvolutionDay;
  label: string;
};

const baseEvolutionMilestones: StageItem[] = [
  { day: 1, label: "Core status" },
  { day: 3, label: "Trajectory" },
  { day: 5, label: "Partial diagnostics" },
  { day: 7, label: "Full diagnostics" },
];

const operatorDepthMilestones: StageItem[] = [
  { day: 1, label: "Supporter access" },
  { day: 3, label: "Advanced trajectory" },
  { day: 5, label: "Deep stability signals" },
  { day: 7, label: "Deep diagnostics" },
];

const utilityButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950/90 px-3.5 py-1.5 text-xs font-medium tracking-[0.01em] text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 active:translate-y-[1px]";

function CheckIcon({ tone = "emerald" }: { tone?: "emerald" | "amber" }) {
  const color = tone === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 ${color}`}>
      <path d="M6.2 10.9 3.5 8.2l-1 1 3.7 3.7L13.5 5.6l-1-1z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 text-zinc-500">
      <path d="M11 6V5a3 3 0 1 0-6 0v1H4v7h8V6zm-5 0V5a2 2 0 1 1 4 0v1z" fill="currentColor" />
    </svg>
  );
}

type RenderRowParams = {
  title: string;
  track: EvolutionTrack;
  stages: StageItem[];
  onboardingProgressCheckins: number;
  currentDay: EvolutionDay;
  operatorPlanEnabled: boolean;
  onStageClick: (track: EvolutionTrack, day: EvolutionDay, unlocked: boolean) => void;
  tone: "base" | "operator";
};

function renderRow({
  title,
  track,
  stages,
  onboardingProgressCheckins,
  currentDay,
  operatorPlanEnabled,
  onStageClick,
  tone,
}: RenderRowParams) {
  const isOperator = tone === "operator";

  return (
    <div>
      <p className={`text-xs uppercase tracking-[0.2em] ${isOperator ? "text-amber-300/70" : "text-zinc-500"}`}>{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {stages.map((stage) => {
          const baseUnlocked = onboardingProgressCheckins >= stage.day || stage.day === 1;
          const unlocked = isOperator ? baseUnlocked && operatorPlanEnabled : baseUnlocked;
          const current = !isOperator && currentDay === stage.day;
          const future = !unlocked && !current;

          const className = isOperator
            ? unlocked
              ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
              : "border-zinc-800 bg-zinc-950/70 text-zinc-400"
            : current
              ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
              : unlocked
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-zinc-800 bg-zinc-950/70 text-zinc-400";

          return (
            <button
              type="button"
              key={`${track}-${stage.day}`}
              onClick={() => onStageClick(track, stage.day, unlocked)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${isOperator ? "hover:border-amber-400/60" : "hover:border-cyan-400/50"} ${className}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Day {stage.day}</p>
                {unlocked ? (
                  <CheckIcon tone={isOperator ? "amber" : "emerald"} />
                ) : future ? (
                  <LockIcon />
                ) : (
                  <span className={`h-3.5 w-3.5 rounded-full border ${isOperator ? "border-amber-300/70" : "border-cyan-300/70"}`} />
                )}
              </div>
              <p className="mt-1">{stage.label}</p>
              {future ? <p className="mt-1 text-[11px] text-zinc-500">Locked</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SystemEvolutionStrip({
  currentDay,
  onboardingProgressCheckins,
  nextUnlockDay,
  operatorPlanEnabled,
  collapsible = false,
  onOpenTutorial,
  onStageClick,
}: SystemEvolutionStripProps) {
  const [collapsed, setCollapsed] = useState(false);
  const done = Math.max(0, Math.min(7, onboardingProgressCheckins));

  if (collapsed && collapsible) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Evolution</p>
            <p className="mt-0.5 text-xs text-zinc-400">Day {currentDay} - onboarding {done}/7</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:shrink-0">
            {onOpenTutorial ? (
              <button
                type="button"
                onClick={onOpenTutorial}
                className={utilityButtonClass}
              >
                Tutorial
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className={utilityButtonClass}
            >
              Expand
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Evolution</p>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:shrink-0">
          {onOpenTutorial ? (
            <button
              type="button"
              onClick={onOpenTutorial}
              className={utilityButtonClass}
            >
              Tutorial
            </button>
          ) : null}
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className={utilityButtonClass}
            >
              Collapse
            </button>
          ) : null}
        </div>
      </div>
      {renderRow({
        title: "Base Track",
        track: "base",
        stages: baseEvolutionMilestones,
        onboardingProgressCheckins,
        currentDay,
        operatorPlanEnabled,
        onStageClick,
        tone: "base",
      })}

      <div className="mt-5 border-t border-zinc-800/80 pt-4">
        {renderRow({
          title: "Operator Depth",
          track: "operator",
          stages: operatorDepthMilestones,
          onboardingProgressCheckins,
          currentDay,
          operatorPlanEnabled,
          onStageClick,
          tone: "operator",
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Onboarding progress: <span className="text-zinc-100">{done} / 7</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Next unlock: <span className="text-zinc-100">{nextUnlockDay ? `Day ${nextUnlockDay}` : "All unlocked"}</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Baseline stabilization: <span className="text-zinc-100">{done} / 7</span>
        </p>
      </div>
    </section>
  );
}
