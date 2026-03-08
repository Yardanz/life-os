"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProjectionChartTooltip } from "@/components/control-room/projection/ProjectionChartTooltip";
import { formatDayTick } from "@/components/control-room/projection/format";
import type { EndLabel, MetricKey, ProjectionChartRow, ScenarioKey } from "@/components/control-room/projection/types";
import { METRIC_ZONES, X_TICKS, Y_TICKS } from "@/components/control-room/projection/zones";
import { useIsCompactViewport } from "@/hooks/useIsCompactViewport";

type ProjectionChartViewProps = {
  metric: MetricKey;
  rows: ProjectionChartRow[];
  visibleScenarios: ScenarioKey[];
  nowX: number;
  endLabels: EndLabel[];
  impactHorizonDays?: number | null;
  matchTrajectoryStyle?: boolean;
};

const STROKE_MAP: Record<ScenarioKey, string> = {
  baseline: "#22d3ee",
  stabilize: "#34d399",
  overload: "#fb7185",
  custom: "#fbbf24",
  protocol: "#38bdf8",
  compareB: "#f59e0b",
};

const DOTLESS_LINE = { strokeWidth: 2.3, dot: false, isAnimationActive: false } as const;

function buildTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 1) {
    return [Math.round(min * 10) / 10];
  }
  const normalizedCount = Math.max(2, count);
  return Array.from({ length: normalizedCount }, (_, index) => {
    const ratio = index / (normalizedCount - 1);
    const value = min + (max - min) * ratio;
    return Math.round(value * 10) / 10;
  });
}

export function ProjectionChartView({
  metric,
  rows,
  visibleScenarios,
  nowX,
  endLabels,
  impactHorizonDays = null,
  matchTrajectoryStyle = false,
}: ProjectionChartViewProps) {
  const isCompact = useIsCompactViewport();
  const minMax = (() => {
    const values = rows.flatMap((row) =>
      visibleScenarios
        .map((key) => row[key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    );
    if (values.length === 0) {
      return { min: 0, max: 100 };
    }
    return { min: Math.min(...values), max: Math.max(...values) };
  })();
  const dynamicMin = Math.max(0, Math.floor((minMax.min - 10) / 5) * 5);
  const dynamicMax = Math.min(100, Math.ceil((minMax.max + 10) / 5) * 5);
  const yMin = dynamicMax <= dynamicMin ? Math.max(0, dynamicMin - 20) : dynamicMin;
  const yMax = dynamicMax <= dynamicMin ? Math.min(100, dynamicMax + 20) : dynamicMax;
  const yTicksDynamic = buildTicks(yMin, yMax, isCompact ? 4 : 5);
  const xTicks = isCompact ? [0, 10, 20, 29] : X_TICKS;
  const yTicks = matchTrajectoryStyle ? yTicksDynamic : isCompact ? [0, 40, 80, 100] : Y_TICKS;
  const axisFontSize = isCompact ? 12 : 11;
  const chartHeightClass = isCompact ? "h-[18.5rem]" : "h-64";
  const chartMargin = matchTrajectoryStyle
    ? isCompact
      ? { top: 14, right: 8, bottom: 36, left: 8 }
      : { top: 20, right: 24, bottom: 52, left: 24 }
    : isCompact
      ? { top: 12, right: 12, bottom: 24, left: 6 }
      : { top: 14, right: 106, bottom: 20, left: 6 };
  const yAxisWidth = matchTrajectoryStyle ? (isCompact ? 42 : 52) : isCompact ? 38 : 34;
  const showEndLabels = !isCompact;

  const zones = METRIC_ZONES[metric];
  const zoneBoundaries = zones.slice(1).map((zone) => zone.from);

  return (
    <div className={`${chartHeightClass} w-full rounded-lg border border-zinc-800 bg-zinc-950/70 ${matchTrajectoryStyle ? "p-3" : "p-2"}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={chartMargin}>
          {!matchTrajectoryStyle && impactHorizonDays ? (
            <ReferenceArea
              x1={0}
              x2={Math.max(0, impactHorizonDays - 1)}
              y1={0}
              y2={100}
              fill="#334155"
              fillOpacity={0.08}
              strokeOpacity={0}
            />
          ) : null}
          {!matchTrajectoryStyle
            ? zones.map((zone) => (
            <ReferenceArea
              key={`${zone.label}-${zone.from}`}
              x1={-0.5}
              x2={29.5}
              y1={zone.from}
              y2={zone.to}
              fill={zone.color}
              fillOpacity={zone.opacity}
              strokeOpacity={0}
            />
              ))
            : null}
          {!matchTrajectoryStyle
            ? zoneBoundaries.map((y) => (
            <ReferenceLine
              key={`zone-threshold-${y}`}
              y={y}
              stroke="#52525b"
              strokeOpacity={0.4}
              strokeDasharray="2 6"
              strokeWidth={1}
            />
              ))
            : null}

          <CartesianGrid
            stroke={matchTrajectoryStyle ? "rgb(39 39 42)" : "#3f3f46"}
            strokeDasharray={matchTrajectoryStyle ? undefined : "2 4"}
            opacity={matchTrajectoryStyle ? 1 : 0.25}
            vertical={false}
          />
          <XAxis
            type="number"
            dataKey="dayIndex"
            domain={[-0.5, 29.5]}
            ticks={xTicks}
            tickFormatter={formatDayTick}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: axisFontSize }}
            tickMargin={matchTrajectoryStyle ? (isCompact ? 10 : 14) : isCompact ? 10 : 8}
            minTickGap={isCompact ? 22 : 12}
          />
          <YAxis
            type="number"
            domain={matchTrajectoryStyle ? [yMin, yMax] : [0, 100]}
            ticks={yTicks}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: axisFontSize }}
            width={yAxisWidth}
          />
          <Tooltip
            cursor={{ stroke: "#71717a", strokeOpacity: 0.4, strokeDasharray: "3 3" }}
            content={<ProjectionChartTooltip metric={metric} compact={isCompact} />}
          />

          {!matchTrajectoryStyle ? <ReferenceLine x={nowX} stroke="#71717a" strokeDasharray="2 5" strokeOpacity={0.65} strokeWidth={1} /> : null}

          {visibleScenarios.includes("baseline") ? (
            <Line type="monotone" dataKey="baseline" stroke={STROKE_MAP.baseline} {...DOTLESS_LINE} strokeWidth={isCompact ? 2.6 : 2.3} />
          ) : null}
          {visibleScenarios.includes("stabilize") ? (
            <Line type="monotone" dataKey="stabilize" stroke={STROKE_MAP.stabilize} {...DOTLESS_LINE} strokeWidth={isCompact ? 2.6 : 2.3} />
          ) : null}
          {visibleScenarios.includes("overload") ? (
            <Line type="monotone" dataKey="overload" stroke={STROKE_MAP.overload} {...DOTLESS_LINE} strokeWidth={isCompact ? 2.6 : 2.3} />
          ) : null}
          {visibleScenarios.includes("custom") ? (
            <Line
              type="monotone"
              dataKey="custom"
              stroke={STROKE_MAP.custom}
              strokeDasharray="5 4"
              {...DOTLESS_LINE}
              strokeWidth={isCompact ? 2.6 : 2.3}
            />
          ) : null}
          {visibleScenarios.includes("protocol") ? (
            <Line
              type="monotone"
              dataKey="protocol"
              stroke={STROKE_MAP.protocol}
              strokeDasharray="2 3"
              {...DOTLESS_LINE}
              strokeWidth={isCompact ? 2.6 : 2.3}
            />
          ) : null}
          {visibleScenarios.includes("compareB") ? (
            <Line
              type="monotone"
              dataKey="compareB"
              stroke={STROKE_MAP.compareB}
              strokeDasharray="6 4"
              {...DOTLESS_LINE}
              strokeWidth={isCompact ? 2.6 : 2.3}
            />
          ) : null}

          {showEndLabels
            ? endLabels.map((item) => (
            <ReferenceDot
              key={`end-${item.key}`}
              x={item.dayIndex}
              y={item.value}
              r={0}
              ifOverflow="visible"
              label={{
                value: item.text,
                fill: STROKE_MAP[item.key],
                position: "right",
                offset: 8,
                fontSize: 10,
                dy: item.dy,
              }}
            />
              ))
            : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
