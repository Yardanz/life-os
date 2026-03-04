"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { ScenarioRunner } from "@/components/demo/ScenarioRunner";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { GlossaryModal } from "@/components/ui/GlossaryModal";
import { SystemReportModal } from "@/components/ui/SystemReportModal";
import { t } from "@/lib/i18n";
import { buildSystemReport } from "@/lib/systemReport";

type ScenarioKey = "baseline" | "high_load" | "recovery";

type DemoScenario = {
  label: string;
  lifeScore: number;
  guardrail: "OPEN" | "CAUTION" | "LOCKDOWN";
  load: number;
  recovery: number;
  risk: number;
  series7d: number[];
  protocolMode: "OPEN" | "CAUTION" | "LOCKDOWN";
  protocolConstraints: string[];
  whatChanged: string;
  trajectoryLabel: string;
  trajectorySummary: string;
  trajectoryDots: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2];
  step3: string;
  step4: string;
  step5: string;
};

const SCENARIOS: Record<ScenarioKey, DemoScenario> = {
  baseline: {
    label: "Baseline",
    lifeScore: 74.0,
    guardrail: "OPEN",
    load: 35,
    recovery: 72,
    risk: 12,
    series7d: [69, 70, 71, 72, 72, 73, 74],
    protocolMode: "OPEN",
    protocolConstraints: ["Deep work cap: 120m", "Stress <= 7", "Re-evaluate in 24h"],
    whatChanged: "Risk low -> Guardrail OPEN -> Constraints remain light",
    trajectoryLabel: "Stable trajectory",
    trajectorySummary: "Stable within capacity.",
    trajectoryDots: [1, 1, 1, 1, 2],
    step3: "Guardrail remains OPEN while overload probability stays low.",
    step4: "Protocol keeps light constraints and monitoring cadence.",
    step5: "Stability is preserved by maintaining current operating limits.",
  },
  high_load: {
    label: "High Load",
    lifeScore: 62.0,
    guardrail: "CAUTION",
    load: 68,
    recovery: 56,
    risk: 44,
    series7d: [71, 69, 67, 65, 63, 62, 62],
    protocolMode: "CAUTION",
    protocolConstraints: ["Deep work cap: 60-90m", "Training: light only", "No late caffeine", "Re-evaluate in 12h"],
    whatChanged: "Risk up -> Guardrail CAUTION -> Constraints tighten",
    trajectoryLabel: "Overload escalation detected",
    trajectorySummary: "Rising overload probability -> CAUTION.",
    trajectoryDots: [0, 1, 1, 2, 2],
    step3: "Guardrail shifts to CAUTION after threshold crossing.",
    step4: "Protocol tightens workload and recovery constraints.",
    step5: "System stabilizes by reducing load variability and strain.",
  },
  recovery: {
    label: "Recovery",
    lifeScore: 70.0,
    guardrail: "OPEN",
    load: 25,
    recovery: 80,
    risk: 9,
    series7d: [60, 61, 63, 65, 67, 69, 70],
    protocolMode: "OPEN",
    protocolConstraints: ["Recovery priority: sleep >= 8h", "Gradual workload re-entry", "Re-evaluate in 24h"],
    whatChanged: "Risk down -> Guardrail OPEN -> Constraints relax",
    trajectoryLabel: "Stability restoration",
    trajectorySummary: "Recovery capacity rising -> OPEN.",
    trajectoryDots: [0, 0, 1, 1, 2],
    step3: "Guardrail re-opens as overload probability drops.",
    step4: "Protocol shifts to recovery-priority and gradual re-entry.",
    step5: "Capacity restores and operating limits can expand carefully.",
  },
};

function widthFromPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function timelineDotClass(level: 0 | 1 | 2): string {
  if (level === 2) return "bg-cyan-300";
  if (level === 1) return "bg-cyan-400/80";
  return "bg-zinc-500";
}

function timelineOffsetClass(level: 0 | 1 | 2): string {
  if (level === 2) return "translate-y-0";
  if (level === 1) return "translate-y-1";
  return "translate-y-2";
}

export default function DemoPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("high_load");
  const [isWalking, setIsWalking] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const current = SCENARIOS[scenario];

  const clearPlayback = () => {
    for (const timeoutId of timeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearPlayback();
  }, []);

  const reportText = buildSystemReport({
    ts: new Date().toISOString(),
    pathAndQuery:
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/demo",
    appVersion: process.env.NEXT_PUBLIC_VERSION ?? "dev",
    mode: "Simulation",
    guardrailState: current.guardrail,
    lifeScore: current.lifeScore,
    load: current.load,
    recovery: current.recovery,
    risk: current.risk,
    confidencePct: 72,
    activeProtocol: {
      state: current.protocolMode,
      horizonHours: 24,
      mode: "STANDARD",
    },
  });

  const startAutoWalk = () => {
    if (isWalking) return;
    clearPlayback();
    setIsWalking(true);
    const sequence: ScenarioKey[] = ["baseline", "high_load", "recovery"];
    sequence.forEach((key, idx) => {
      const timeoutId = window.setTimeout(() => {
        setScenario(key);
      }, idx * 5000);
      timeoutsRef.current.push(timeoutId);
    });
    const endId = window.setTimeout(() => {
      setIsWalking(false);
      clearPlayback();
    }, 15000);
    timeoutsRef.current.push(endId);
  };

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6">
        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {t("demoModeBanner")}
        </div>

        <header className="mt-6 mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              aria-label="Go to home page"
              title="Home"
              className="group inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-xs uppercase tracking-[0.22em] text-zinc-400 transition-all duration-200 ease-out hover:text-cyan-200 hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <span
                aria-hidden="true"
                className="text-cyan-300/90 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
              >
                &larr;
              </span>
              <span className="font-medium text-zinc-300 transition-colors duration-200 group-hover:text-cyan-100">LIFE OS</span>
              <span className="text-[10px] normal-case tracking-normal text-zinc-500 transition-colors duration-200 group-hover:text-cyan-200/90">
                Home
              </span>
            </Link>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">System walkthrough</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100 sm:text-4xl">Interactive System Preview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
            <button
              type="button"
              onClick={() => setGlossaryOpen(true)}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Glossary
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            {(["baseline", "high_load", "recovery"] as ScenarioKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setScenario(key)}
                className={`min-h-10 rounded-md border px-3 py-2 text-xs transition ${
                  scenario === key
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {SCENARIOS[key].label}
              </button>
            ))}
            <button
              type="button"
              disabled={isWalking}
              onClick={startAutoWalk}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Auto-walk (15s)
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">{current.whatChanged}</p>
        </section>

        <ScenarioRunner />

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score</p>
                <p className="mt-1 text-4xl font-semibold text-zinc-100">{current.lifeScore.toFixed(1)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Model confidence: 72% (reference value)</p>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-xs ${
                  current.guardrail === "LOCKDOWN"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : current.guardrail === "CAUTION"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                }`}
              >
                Guardrail: {current.guardrail}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">State triggered by risk threshold crossing.</p>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">System Evolution</p>
              <div className="mt-2 grid grid-cols-5 gap-2 text-[10px] text-zinc-500">
                {["D0", "D7", "D14", "D21", "D30"].map((label) => (
                  <p key={label} className="text-center">
                    [{label}]
                  </p>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-5 gap-2">
                {current.trajectoryDots.map((level, idx) => (
                  <div key={`${idx}-${level}`} className="flex items-center justify-center">
                    <span className={`h-2.5 w-2.5 rounded-full ${timelineDotClass(level)} ${timelineOffsetClass(level)}`} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-300">Current trajectory: {current.trajectorySummary}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{current.trajectoryLabel}</p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Forward projections are deterministic and derived from current measurable inputs.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Load{" "}
                  <button
                    type="button"
                    aria-label="Load definition"
                    title="Current system pressure from workload and strain."
                    className="text-zinc-400"
                  >
                    (i)
                  </button>
                </p>
                <p className="mt-1 text-sm text-zinc-200">{current.load.toFixed(1)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-cyan-400/80" style={{ width: widthFromPercent(current.load) }} />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Recovery{" "}
                  <button
                    type="button"
                    aria-label="Recovery definition"
                    title="Available restoration capacity based on sleep and regulation."
                    className="text-zinc-400"
                  >
                    (i)
                  </button>
                </p>
                <p className="mt-1 text-sm text-zinc-200">{current.recovery.toFixed(1)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-emerald-400/80" style={{ width: widthFromPercent(current.recovery) }} />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Risk{" "}
                  <button
                    type="button"
                    aria-label="Risk definition"
                    title="Probability of overload within next 24 hours."
                    className="text-zinc-400"
                  >
                    (i)
                  </button>
                </p>
                <p className="mt-1 text-sm text-zinc-200">{current.risk.toFixed(1)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-rose-400/80" style={{ width: widthFromPercent(current.risk) }} />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score | 7 Days</p>
              <div className="mt-3 flex h-24 items-end gap-1.5">
                {current.series7d.map((value, idx) => (
                  <div key={`${idx}-${value}`} className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-sm bg-cyan-400/70"
                      style={{ height: `${Math.max(12, Math.round((value / 100) * 96))}px` }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">Reference trend for system walkthrough clarity.</p>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Example protocol recommendation</p>
              <p className="mt-2 text-sm text-zinc-200">Mode: {current.protocolMode}</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                {current.protocolConstraints.map((constraint) => (
                  <li key={constraint}>- {constraint}</li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">5-Step Guided Flow</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-medium text-zinc-100">Step 1 - Daily input</p>
                <p className="mt-1 text-xs text-zinc-400">Enter sleep, strain, workload, and recovery signals.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-medium text-zinc-100">Step 2 - State detection</p>
                <p className="mt-1 text-xs text-zinc-400">The system computes load balance and overload probability.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-medium text-zinc-100">Step 3 - Guardrail shift</p>
                <p className="mt-1 text-xs text-zinc-400">{current.step3}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-medium text-zinc-100">Step 4 - Constraint protocol</p>
                <p className="mt-1 text-xs text-zinc-400">{current.step4}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-sm font-medium text-zinc-100">Step 5 - Stability recovery</p>
                <p className="mt-1 text-xs text-zinc-400">{current.step5}</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/85 p-6">
          <h2 className="text-2xl font-semibold text-zinc-100">Enter Live System</h2>
          <div className="mt-4">
            <Link
              href="/app"
              className="inline-flex min-h-10 items-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
            >
              Enter Live System
            </Link>
            <p className="mt-2 text-[11px] text-zinc-500">Requires sign-in. Preview session does not store data.</p>
          </div>
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="mt-3 text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
          >
            Report issue
          </button>
        </section>

        <PublicFooter className="mt-8" />
      </main>
      <SystemReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportText={reportText}
        supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null}
      />
      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </LifeOSBackground>
  );
}
