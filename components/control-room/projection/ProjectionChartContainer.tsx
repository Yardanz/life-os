"use client";

import { useMemo, useState } from "react";
import { ProjectionChartView } from "@/components/control-room/projection/ProjectionChartView";
import { addDaysISO, getLocalISODate } from "@/lib/date/localDate";
import { clamp, diffDaysISO, normalizeRisk } from "@/components/control-room/projection/format";
import type { EndLabel, MetricKey, ProjectionChartRow, ScenarioKey, UnifiedProjectionPoint } from "@/components/control-room/projection/types";
import { t, type Locale } from "@/lib/i18n";

type RawProjectionPoint = {
  dateOffset: number;
  lifeScore: number;
  risk: number;
  burnoutRisk: number;
  energy: number;
  focus: number;
};

type RawProjection30d = {
  baseline: RawProjectionPoint[];
  stabilization: RawProjectionPoint[];
  overload: RawProjectionPoint[];
};

type ProjectionChartContainerProps = {
  locale: Locale;
  projection: RawProjection30d;
  custom?: RawProjectionPoint[] | null;
  compareB?: RawProjectionPoint[] | null;
  compareEnabled?: boolean;
  antiChaosProtocol?: AntiChaosProtocol | null;
  selectedDateISO: string;
  isPro: boolean;
  customLoading?: boolean;
  showOverload?: boolean;
  matchTrajectoryStyle?: boolean;
};

type UnifiedProjection = Record<ScenarioKey, UnifiedProjectionPoint[]>;

function summaryChip(title: string, points: UnifiedProjectionPoint[], tone: "cyan" | "green" | "rose", locale: Locale) {
  const last = points[points.length - 1];
  const toneClass =
    tone === "green"
      ? "text-emerald-200 border-emerald-700/60"
      : tone === "rose"
        ? "text-rose-200 border-rose-700/60"
        : "text-cyan-200 border-cyan-700/60";

  if (!last) {
    return (
      <div className={`rounded-md border bg-zinc-950/80 px-3 py-2 text-xs ${toneClass}`}>
        {title}: {t("noProjection", locale)}
      </div>
    );
  }

  return (
    <div className={`rounded-md border bg-zinc-950/80 px-3 py-2 text-xs ${toneClass}`}>
      {title} @30d: LifeScore {last.lifeScore.toFixed(1)}, Risk {last.risk.toFixed(1)}
    </div>
  );
}

function adaptScenario(points: RawProjectionPoint[], selectedDateISO: string): UnifiedProjectionPoint[] {
  return [...points]
    .sort((a, b) => a.dateOffset - b.dateOffset)
    .map((point, idx) => {
      const dayIndex = clamp((point.dateOffset ?? idx + 1) - 1, 0, 29);
      return {
        dayIndex,
        dateISO: addDaysISO(selectedDateISO, dayIndex + 1),
        lifeScore: clamp(point.lifeScore, 0, 100),
        risk: normalizeRisk(point.risk),
        burnout: clamp(point.burnoutRisk, 0, 100),
      };
    });
}

function buildRows(unified: UnifiedProjection, metric: MetricKey): ProjectionChartRow[] {
  const rows: ProjectionChartRow[] = Array.from({ length: 30 }, (_, dayIndex) => ({
    dayIndex,
    dateISO: addDaysISO(unified.baseline[0]?.dateISO ?? getLocalISODate(), dayIndex),
  }));

  const assign = (scenario: ScenarioKey) => {
    for (const point of unified[scenario]) {
      const value = metric === "lifeScore" ? point.lifeScore : metric === "risk" ? point.risk : point.burnout;
      rows[point.dayIndex] = { ...rows[point.dayIndex], [scenario]: value };
    }
  };

  assign("baseline");
  assign("stabilize");
  assign("overload");
  assign("custom");
  assign("protocol");
  assign("compareB");
  return rows;
}

function metricLabel(metric: MetricKey, locale: Locale): string {
  if (metric === "risk") return t("risk", locale);
  if (metric === "burnout") return t("burnout", locale);
  return t("lifeScore", locale);
}

function clampLabelOffset(value: number, offset: number): number {
  if (value >= 92 && offset < 0) return 8;
  if (value <= 8 && offset > 0) return -8;
  return offset;
}

function computeEndLabels(rows: ProjectionChartRow[], visibleScenarios: ScenarioKey[]): EndLabel[] {
  const offsets: Record<ScenarioKey, number> = {
    baseline: 0,
    stabilize: -10,
    overload: 10,
    custom: 24,
    protocol: -22,
    compareB: 16,
  };

  const atLast = rows[rows.length - 1] ?? { dayIndex: 29 };
  const baselineValue = atLast.baseline;
  const candidates: EndLabel[] = [];

  if (visibleScenarios.includes("baseline") && baselineValue !== undefined) {
    candidates.push({
      key: "baseline",
      dayIndex: 29,
      value: baselineValue,
      dy: clampLabelOffset(baselineValue, offsets.baseline),
      text: `BASE ${baselineValue.toFixed(0)}`,
    });
  }

  const addIfExists = (key: ScenarioKey, code: string) => {
    const value = atLast[key];
    if (value === undefined) return;
    if (key !== "baseline" && baselineValue !== undefined && Math.abs(value - baselineValue) < 1.4) return;
    const dy = clampLabelOffset(value, offsets[key]);
    const crowdedWithBaseline =
      baselineValue !== undefined &&
      Math.abs(value - baselineValue) < 4 &&
      Math.abs(dy - offsets.baseline) < 11;
    if (crowdedWithBaseline && key !== "baseline") return;

    candidates.push({
      key,
      dayIndex: 29,
      value,
      dy,
      text: `${code} ${value.toFixed(0)}`,
    });
  };

  if (visibleScenarios.includes("stabilize")) addIfExists("stabilize", "STB");
  if (visibleScenarios.includes("overload")) addIfExists("overload", "OVR");
  if (visibleScenarios.includes("custom")) addIfExists("custom", "CUS");
  if (visibleScenarios.includes("compareB")) addIfExists("compareB", "B");

  return candidates;
}

function scenarioSummaryStrip(rows: ProjectionChartRow[], isPro: boolean): {
  base: number | null;
  stb: number | null;
  ovr: number | null;
  stbDelta: number | null;
  ovrDelta: number | null;
} {
  const last = rows[rows.length - 1];
  if (!last) return { base: null, stb: null, ovr: null, stbDelta: null, ovrDelta: null };
  const base = last.baseline ?? null;
  const stb = isPro ? (last.stabilize ?? null) : null;
  const ovr = isPro ? (last.overload ?? null) : null;
  return {
    base,
    stb,
    ovr,
    stbDelta: base !== null && stb !== null ? Number((stb - base).toFixed(1)) : null,
    ovrDelta: base !== null && ovr !== null ? Number((ovr - base).toFixed(1)) : null,
  };
}

export function ProjectionChartContainer({
  locale,
  projection,
  custom,
  compareB = null,
  compareEnabled = false,
  antiChaosProtocol,
  selectedDateISO,
  isPro,
  customLoading = false,
  showOverload = true,
  matchTrajectoryStyle = false,
}: ProjectionChartContainerProps) {
  const [metric, setMetric] = useState<MetricKey>("lifeScore");

  const unified = useMemo<UnifiedProjection>(
    () => ({
      baseline: adaptScenario(projection.baseline, selectedDateISO),
      stabilize: adaptScenario(projection.stabilization, selectedDateISO),
      overload: adaptScenario(projection.overload, selectedDateISO),
      custom: adaptScenario(custom ?? [], selectedDateISO),
      protocol: adaptScenario(antiChaosProtocol?.series.protocol ?? [], selectedDateISO),
      compareB: adaptScenario(compareB ?? [], selectedDateISO),
    }),
    [
      projection.baseline,
      projection.stabilization,
      projection.overload,
      custom,
      compareB,
      antiChaosProtocol?.series.protocol,
      selectedDateISO,
    ],
  );

  const visibleScenarios = useMemo<ScenarioKey[]>(
    () => {
      if (compareEnabled) {
        return ["baseline", ...(unified.compareB.length > 0 ? (["compareB"] as const) : [])];
      }
      return isPro
        ? [
            "baseline",
            "stabilize",
            ...(showOverload ? (["overload"] as const) : []),
            ...(unified.custom.length > 0 ? (["custom"] as const) : []),
            ...(unified.protocol.length > 0 ? (["protocol"] as const) : []),
          ]
        : ["baseline"];
    },
    [compareEnabled, isPro, showOverload, unified.compareB.length, unified.custom.length, unified.protocol.length],
  );

  const rows = useMemo(() => buildRows(unified, metric), [unified, metric]);

  const nowX = useMemo(() => {
    const delta = diffDaysISO(selectedDateISO, getLocalISODate());
    return clamp(delta - 0.5, -0.5, 29.5);
  }, [selectedDateISO]);

  const endLabels = useMemo(() => computeEndLabels(rows, visibleScenarios), [rows, visibleScenarios]);
  const strip = useMemo(() => scenarioSummaryStrip(rows, isPro && showOverload), [rows, isPro, showOverload]);

  return (
    <>
      <div className="mb-3 rounded-md border border-zinc-800/80 bg-zinc-950/45 p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Metric selection</p>
          <span className="text-xs text-zinc-500">{customLoading ? t("computingCustom", locale) : t("deterministicModel", locale)}</span>
        </div>
        <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMetric("lifeScore")}
            className={`rounded px-2 py-1 transition ${
              metric === "lifeScore" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t("lifeScore", locale)}
          </button>
          <button
            type="button"
            onClick={() => setMetric("risk")}
            className={`rounded px-2 py-1 transition ${
              metric === "risk" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t("risk", locale)}
          </button>
          <button
            type="button"
            onClick={() => setMetric("burnout")}
            className={`rounded px-2 py-1 transition ${
              metric === "burnout" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Burnout
          </button>
        </div>
      </div>

      <ProjectionChartView
        metric={metric}
        rows={rows}
        visibleScenarios={visibleScenarios}
        nowX={nowX}
        endLabels={endLabels}
        impactHorizonDays={antiChaosProtocol?.series.horizonDays ?? null}
        matchTrajectoryStyle={matchTrajectoryStyle}
      />

      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/75 px-3 py-2 font-mono text-xs sm:text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-zinc-500">{metricLabel(metric, locale)} @30d</span>
          <span className="text-cyan-200">BASE {strip.base !== null ? strip.base.toFixed(1) : "-"}</span>
          {compareEnabled ? (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-200">B {rows[rows.length - 1]?.compareB?.toFixed(1) ?? "-"}</span>
            </>
          ) : isPro ? (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-200">
                STB {strip.stb !== null ? strip.stb.toFixed(1) : "-"}{" "}
                <span className="text-zinc-400">
                  {strip.stbDelta !== null ? `(${strip.stbDelta >= 0 ? "+" : ""}${strip.stbDelta.toFixed(1)})` : ""}
                </span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-rose-200">
                OVR {strip.ovr !== null ? strip.ovr.toFixed(1) : "-"}{" "}
                <span className="text-zinc-400">
                  {strip.ovrDelta !== null ? `(${strip.ovrDelta >= 0 ? "+" : ""}${strip.ovrDelta.toFixed(1)})` : ""}
                </span>
              </span>
            </>
          ) : null}
          {!compareEnabled && isPro && unified.custom.length > 0 ? <span className="text-amber-200">| CUS ACTIVE</span> : null}
          {!compareEnabled && isPro && unified.protocol.length > 0 ? <span className="text-sky-200">| ACP ACTIVE</span> : null}
        </div>
      </div>

      <details className="mt-2 rounded-md border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
        <summary className="cursor-pointer text-xs text-zinc-500 sm:text-[11px]">{t("details", locale)}</summary>
        {isPro ? (
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {summaryChip(t("baseline", locale), unified.baseline, "cyan", locale)}
            {summaryChip(t("stabilize", locale), unified.stabilize, "green", locale)}
            {showOverload ? summaryChip(t("overload", locale), unified.overload, "rose", locale) : null}
          </div>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-1">{summaryChip(t("baseline", locale), unified.baseline, "cyan", locale)}</div>
        )}
      </details>
    </>
  );
}
import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
