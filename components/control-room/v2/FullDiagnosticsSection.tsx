"use client";

import Link from "next/link";
import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import type { ControlRoomV2Data } from "@/components/control-room/v2/types";

type FullDiagnosticsSectionProps = {
  data: ControlRoomV2Data;
  effectivePlan: "FREE" | "PRO";
  antiChaosActionEnabled?: boolean;
  onOpenAntiChaosAction?: () => void;
  previousMetrics: {
    date: string;
    lifeScore: number;
    recovery: number;
    load: number;
    risk: number;
  } | null;
};

type SummaryCardId = "anti_chaos" | "recovery" | "load" | "risk" | "drift" | "calibration";

type DetailCopy = {
  unlockedTitle: string;
  unlockedText: string;
  lockedTitle: string;
  lockedText: string;
};

const SUMMARY_CARD_DETAILS: Record<SummaryCardId, DetailCopy> = {
  anti_chaos: {
    unlockedTitle: "Protocol stabilization layer active",
    unlockedText:
      "Anti-Chaos is the protocol stabilization layer. It helps contain instability and reduce the chance of cascading system degradation under strain.",
    lockedTitle: "Plan-restricted diagnostics layer",
    lockedText:
      "Anti-Chaos belongs to deeper operator-depth diagnostics. This account can see that the layer exists, but full interaction is restricted on the current plan.",
  },
  recovery: {
    unlockedTitle: "Recovery capacity signal",
    unlockedText:
      "Recovery Capacity represents current restorative capacity and how much strain the system can absorb before degradation risk rises.",
    lockedTitle: "Recovery capacity access limited",
    lockedText: "Recovery Capacity indicates restorative headroom. Detailed access is currently limited by system depth.",
  },
  load: {
    unlockedTitle: "Load pressure signal",
    unlockedText: "Load Pressure represents current operational demand being applied to the system.",
    lockedTitle: "Load pressure access limited",
    lockedText: "Load Pressure indicates active demand on the system. Detailed access is restricted on this account.",
  },
  risk: {
    unlockedTitle: "Risk probability signal",
    unlockedText: "Risk Probability reflects the estimated overload and instability risk under current conditions.",
    lockedTitle: "Risk probability restricted",
    lockedText: "Risk Probability belongs to deeper operator diagnostics and is currently restricted by plan depth.",
  },
  drift: {
    unlockedTitle: "System drift signal",
    unlockedText: "System Drift reflects integrity deviation from stable operating patterns.",
    lockedTitle: "System drift restricted",
    lockedText: "System Drift belongs to deeper operator diagnostics and is currently restricted by plan depth.",
  },
  calibration: {
    unlockedTitle: "Calibration status signal",
    unlockedText: "Calibration Status reflects model readiness, calibration progress, and confidence maturity.",
    lockedTitle: "Calibration status restricted",
    lockedText: "Calibration Status indicates model readiness and confidence maturity. Detailed depth is currently restricted.",
  },
};

type DriverLine = { label: string; value: number };

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function fmtPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`;
}

function driftLabel(state: "STABLE" | "DRIFT" | "STRAIN"): string {
  if (state === "STRAIN") return "Strained";
  if (state === "DRIFT") return "Drift detected";
  return "Stable";
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function cleanDriverLabel(label: string): string {
  return label
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (chunk) => chunk.toUpperCase());
}

function pickTopDestabilizers(lines: DriverLine[], count = 3): DriverLine[] {
  const negatives = lines.filter((line) => line.value < 0).sort((a, b) => a.value - b.value);
  if (negatives.length >= count) return negatives.slice(0, count);

  const used = new Set(negatives.map((line) => `${line.label}:${line.value}`));
  const fallback = lines
    .slice()
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .filter((line) => !used.has(`${line.label}:${line.value}`))
    .slice(0, count - negatives.length);
  return [...negatives, ...fallback];
}

function byImpactDesc(lines: DriverLine[]): DriverLine[] {
  return lines.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function byValueDesc(lines: DriverLine[]): DriverLine[] {
  return lines.slice().sort((a, b) => b.value - a.value);
}

function toImpactBarWidth(value: number, maxAbs: number): number {
  if (maxAbs <= 0) return 0;
  return Math.max(6, Math.round((Math.abs(value) / maxAbs) * 100));
}

function valueToneClass(value: number): string {
  if (value > 0) return "text-cyan-300";
  if (value < 0) return "text-amber-300";
  return "text-zinc-400";
}

function matchesAnyKeyword(label: string, keywords: string[]): boolean {
  const normalized = label.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function LockedOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border border-amber-500/30 bg-zinc-950/70 backdrop-blur-[1px]">
      <p className="text-xs uppercase tracking-[0.12em] text-amber-200">Locked</p>
    </div>
  );
}

export function FullDiagnosticsSection({
  data,
  effectivePlan,
  antiChaosActionEnabled = false,
  onOpenAntiChaosAction,
  previousMetrics,
}: FullDiagnosticsSectionProps) {
  const isPro = effectivePlan === "PRO";
  const antiChaosEnabled = isPro && (data.featureAccess?.antiChaos ?? true);
  const [selectedSummaryCard, setSelectedSummaryCard] = useState<SummaryCardId | null>(null);

  const allDrivers: DriverLine[] = data.breakdown
    ? [
        ...data.breakdown.energy,
        ...data.breakdown.focus,
        ...data.breakdown.discipline,
        ...data.breakdown.fatigue,
        ...data.breakdown.strain,
        ...data.breakdown.risk,
      ]
    : [];
  const rankedDrivers = byImpactDesc(allDrivers);
  const topDestabilizers = pickTopDestabilizers(rankedDrivers, 3);
  const maxAbsImpact = rankedDrivers.length > 0 ? Math.max(...rankedDrivers.map((line) => Math.abs(line.value))) : 1;

  const domainGroups = data.breakdown
    ? [
        { title: "Energy", lines: byValueDesc(data.breakdown.energy) },
        { title: "Focus", lines: byValueDesc(data.breakdown.focus) },
        { title: "Fatigue", lines: byValueDesc(data.breakdown.fatigue) },
        { title: "Discipline", lines: byValueDesc(data.breakdown.discipline) },
      ]
    : [];

  const riskMechanics = byValueDesc(
    rankedDrivers.filter((line) =>
      matchesAnyKeyword(line.label, ["residual stress", "resilience buffer", "sleep stabilization", "overstress penalty"])
    )
  );
  const hiddenModelEffects = byValueDesc(
    rankedDrivers.filter((line) =>
      matchesAnyKeyword(line.label, ["hormetic", "performance momentum", "autonomic balance", "adaptive capacity"])
    )
  );

  const recoveryDelta = previousMetrics ? data.systemMetrics.recovery - previousMetrics.recovery : null;
  const loadDelta = previousMetrics ? data.systemMetrics.load - previousMetrics.load : null;
  const riskDelta = previousMetrics ? data.systemMetrics.risk - previousMetrics.risk : null;

  const summaryCards = [
    {
      id: "anti_chaos" as const,
      locked: !isPro,
      content: (
        <article className="relative h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <LockedOverlay visible={!isPro} />
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Anti-Chaos system</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">{antiChaosEnabled ? "Available" : "Restricted"}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {antiChaosEnabled ? "Protocol stabilization layer is active for this account." : "Protocol stabilization layer is plan-restricted."}
          </p>
        </article>
      ),
    },
    {
      id: "recovery" as const,
      locked: false,
      content: (
        <article className="h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Recovery capacity</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{fmtPercent(data.systemMetrics.recovery)}</p>
          <p className="mt-1 text-xs text-zinc-400">Current restorative capacity of the system.</p>
          {recoveryDelta != null ? (
            <p className={`mt-1 text-[11px] ${recoveryDelta >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{signed(recoveryDelta)}</p>
          ) : null}
        </article>
      ),
    },
    {
      id: "load" as const,
      locked: false,
      content: (
        <article className="h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Load pressure</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{fmtPercent(data.systemMetrics.load)}</p>
          <p className="mt-1 text-xs text-zinc-400">Operational demand currently applied to the system.</p>
          {loadDelta != null ? (
            <p className={`mt-1 text-[11px] ${loadDelta <= 0 ? "text-emerald-300" : "text-amber-300"}`}>{signed(loadDelta)}</p>
          ) : null}
        </article>
      ),
    },
    {
      id: "risk" as const,
      locked: !isPro,
      content: (
        <article className="relative h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <LockedOverlay visible={!isPro} />
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Risk probability</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{fmtPercent(data.systemMetrics.risk)}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {data.systemMetrics.risk >= 85 ? "High overload risk band." : data.systemMetrics.risk >= 65 ? "Elevated risk band." : "Contained risk band."}
          </p>
          {riskDelta != null ? (
            <p className={`mt-1 text-[11px] ${riskDelta <= 0 ? "text-emerald-300" : "text-amber-300"}`}>{signed(riskDelta)}</p>
          ) : null}
        </article>
      ),
    },
    {
      id: "drift" as const,
      locked: !isPro,
      content: (
        <article className="relative h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <LockedOverlay visible={!isPro} />
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">System drift</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {driftLabel(data.integrity.state)} ({Math.round(clampPercent(data.integrity.score))}%)
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {data.integrity.violations.length > 0 ? data.integrity.violations[0] : "No active drift violations."}
          </p>
        </article>
      ),
    },
    {
      id: "calibration" as const,
      locked: false,
      content: (
        <article className="h-[136px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Calibration status</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {data.calibration.active ? "Calibrating" : "Stable"} ({Math.round(clampPercent(data.calibration.confidence * 100))}%)
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Sleep/Energy: {data.calibration.sensitivities.sleepEnergy} | Stress/Focus: {data.calibration.sensitivities.stressFocus} |
            Workout/Strain: {data.calibration.sensitivities.workoutStrain}
          </p>
        </article>
      ),
    },
  ];

  const unlockedSummaryCards = summaryCards.filter((card) => !card.locked);
  const lockedSummaryCards = summaryCards.filter((card) => card.locked);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Diagnostics</p>
          <p className="mt-2 text-sm text-zinc-300">Full diagnostic layer unlocked. Depth is controlled by operator entitlement.</p>
        </div>
        <span
          className={`rounded border px-2 py-1 text-[11px] ${
            isPro ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100" : "border-zinc-700 bg-zinc-950/80 text-zinc-300"
          }`}
        >
          {isPro ? "Operator depth" : "Observer depth"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unlockedSummaryCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedSummaryCard(card.id)}
              className="w-full text-left transition hover:opacity-95"
            >
              {card.content}
            </button>
          ))}
        </div>
        {lockedSummaryCards.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lockedSummaryCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedSummaryCard(card.id)}
                className="w-full text-left transition hover:opacity-95"
              >
                {card.content}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">System overview</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-300">
            <p>
              Primary driver: <span className="text-zinc-100">{data.executiveSummary?.primaryDriver ?? "--"}</span>
            </p>
            <p>
              Stability state: <span className="text-zinc-100">{data.executiveSummary?.stabilityState ?? "--"}</span>
            </p>
          </div>
        </section>

        <section className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Key destabilizers</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {topDestabilizers.map((driver, index) => (
              <article key={`destabilizer-${index}-${driver.label}-${driver.value}`} className="rounded border border-zinc-800 bg-zinc-950/70 p-2.5">
                <p className="text-xs text-zinc-200">{cleanDriverLabel(driver.label)}</p>
                <p className={`mt-1 text-xs font-medium ${driver.value < 0 ? "text-amber-300" : "text-zinc-300"}`}>Impact: {signed(driver.value)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Operational domains</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {domainGroups.map((domain) => (
            <article key={`domain-${domain.title}`} className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{domain.title}</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                {domain.lines.length > 0 ? (
                  domain.lines.map((line, index) => (
                    <li key={`domain-line-${domain.title}-${index}-${line.label}-${line.value}`}>
                      {cleanDriverLabel(line.label)}: <span className={valueToneClass(line.value)}>{signed(line.value)}</span>
                    </li>
                  ))
                ) : (
                  <li>No signals.</li>
                )}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={`mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-4 ${!isPro ? "relative max-h-[360px] overflow-hidden" : ""}`}>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Full model analysis</p>

        <div className={!isPro ? "pointer-events-none blur-[2px] opacity-70" : ""}>
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Full model explanation</p>
            <p className="mt-2 text-sm text-zinc-200">{data.executiveSummary?.explanation ?? data.diagnosis?.summary ?? "Model explanation unavailable."}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p className="text-xs text-zinc-400">
                Primary driver: <span className="text-zinc-200">{data.executiveSummary?.primaryDriver ?? "--"}</span>
              </p>
              <p className="text-xs text-zinc-400">
                Stability state: <span className="text-zinc-200">{data.executiveSummary?.stabilityState ?? "--"}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Diagnostic drivers</p>
              <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">Top impact (all modules)</p>
              <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {rankedDrivers.length > 0 ? (
                  rankedDrivers.map((driver, index) => {
                    const width = toImpactBarWidth(driver.value, maxAbsImpact);
                    return (
                      <article key={`driver-ranked-${index}-${driver.label}-${driver.value}`} className="rounded border border-zinc-800 bg-zinc-950/80 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-zinc-200">{cleanDriverLabel(driver.label)}</p>
                          <p className={`text-xs ${valueToneClass(driver.value)}`}>{signed(driver.value)}</p>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800">
                          <div
                            className={`h-1.5 rounded-full ${driver.value < 0 ? "bg-amber-400/80" : driver.value > 0 ? "bg-cyan-400/80" : "bg-zinc-500/70"}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-500">No detailed drivers available.</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Risk mechanics</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                  {riskMechanics.length > 0 ? (
                    riskMechanics.map((line, index) => (
                      <li key={`risk-mech-${index}-${line.label}-${line.value}`}>
                        {cleanDriverLabel(line.label)}: <span className={valueToneClass(line.value)}>{signed(line.value)}</span>
                      </li>
                    ))
                  ) : (
                    <li>No explicit risk mechanics found.</li>
                  )}
                </ul>
              </article>

              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Hidden model effects</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                  {hiddenModelEffects.length > 0 ? (
                    hiddenModelEffects.map((line, index) => (
                      <li key={`hidden-effect-${index}-${line.label}-${line.value}`}>
                        {cleanDriverLabel(line.label)}: <span className={valueToneClass(line.value)}>{signed(line.value)}</span>
                      </li>
                    ))
                  ) : (
                    <li>No hidden adaptive effects surfaced.</li>
                  )}
                </ul>
              </article>
            </section>
          </div>
        </div>

        {!isPro ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border border-zinc-800/80 bg-zinc-950/45 p-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Full Model Analysis</p>
              <p className="mt-1 text-sm text-zinc-200">Available on Operator Depth</p>
            </div>
          </div>
        ) : null}
      </section>

      <ModalShell
        open={selectedSummaryCard !== null}
        onClose={() => setSelectedSummaryCard(null)}
        ariaLabel="Diagnostic summary explanation"
        panelClassName="max-w-xl p-5"
      >
        {({ requestClose }) => (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {selectedSummaryCard ? cleanDriverLabel(selectedSummaryCard.replace("_", " ")) : "Diagnostics"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-zinc-100">
                  {selectedSummaryCard
                    ? summaryCards.find((card) => card.id === selectedSummaryCard)?.locked
                      ? SUMMARY_CARD_DETAILS[selectedSummaryCard].lockedTitle
                      : SUMMARY_CARD_DETAILS[selectedSummaryCard].unlockedTitle
                    : "System diagnostics"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>

            {selectedSummaryCard ? (
              <p className="text-sm text-zinc-300">
                {summaryCards.find((card) => card.id === selectedSummaryCard)?.locked
                  ? SUMMARY_CARD_DETAILS[selectedSummaryCard].lockedText
                  : SUMMARY_CARD_DETAILS[selectedSummaryCard].unlockedText}
              </p>
            ) : null}

            {selectedSummaryCard && summaryCards.find((card) => card.id === selectedSummaryCard)?.locked && !isPro ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-400">This layer is available on Operator License.</p>
                <Link
                  href="/pricing"
                  className="mt-2 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)] transition duration-200 hover:border-cyan-300 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  Get Operator License
                </Link>
              </div>
            ) : null}

            {selectedSummaryCard === "anti_chaos" ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-400">Anti-Chaos action</p>
                <button
                  type="button"
                  disabled={!antiChaosEnabled || !antiChaosActionEnabled}
                  onClick={() => {
                    if (!antiChaosEnabled || !antiChaosActionEnabled) return;
                    onOpenAntiChaosAction?.();
                    requestClose();
                  }}
                  className="mt-2 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
                >
                  Open Anti-Chaos controls
                </button>
              </div>
            ) : null}
          </div>
        )}
      </ModalShell>
    </section>
  );
}
