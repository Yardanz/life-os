"use client";

import {
  CartesianGrid,
  Label,
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

type ProjectionChartViewProps = {
  metric: MetricKey;
  rows: ProjectionChartRow[];
  visibleScenarios: ScenarioKey[];
  nowX: number;
  endLabels: EndLabel[];
  impactHorizonDays?: number | null;
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

export function ProjectionChartView({
  metric,
  rows,
  visibleScenarios,
  nowX,
  endLabels,
  impactHorizonDays = null,
}: ProjectionChartViewProps) {
  const zones = METRIC_ZONES[metric];
  const zoneBoundaries = zones.slice(1).map((zone) => zone.from);

  return (
    <div className="h-64 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 14, right: 106, bottom: 20, left: 6 }}>
          {impactHorizonDays ? (
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
          {zones.map((zone) => (
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
          ))}
          {zoneBoundaries.map((y) => (
            <ReferenceLine
              key={`zone-threshold-${y}`}
              y={y}
              stroke="#52525b"
              strokeOpacity={0.4}
              strokeDasharray="2 6"
              strokeWidth={1}
            />
          ))}

          <CartesianGrid stroke="#3f3f46" strokeDasharray="2 4" opacity={0.25} vertical={false} />
          <XAxis
            type="number"
            dataKey="dayIndex"
            domain={[-0.5, 29.5]}
            ticks={X_TICKS}
            tickFormatter={formatDayTick}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={Y_TICKS}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 11 }}
            width={34}
          />
          <Tooltip
            cursor={{ stroke: "#71717a", strokeOpacity: 0.4, strokeDasharray: "3 3" }}
            content={<ProjectionChartTooltip metric={metric} />}
          />

          <ReferenceLine x={nowX} stroke="#71717a" strokeDasharray="2 5" strokeOpacity={0.65} strokeWidth={1}>
            <Label value="NOW" position="insideTopLeft" fill="#a1a1aa" fontSize={9} />
          </ReferenceLine>

          {visibleScenarios.includes("baseline") ? (
            <Line type="monotone" dataKey="baseline" stroke={STROKE_MAP.baseline} {...DOTLESS_LINE} />
          ) : null}
          {visibleScenarios.includes("stabilize") ? (
            <Line type="monotone" dataKey="stabilize" stroke={STROKE_MAP.stabilize} {...DOTLESS_LINE} />
          ) : null}
          {visibleScenarios.includes("overload") ? (
            <Line type="monotone" dataKey="overload" stroke={STROKE_MAP.overload} {...DOTLESS_LINE} />
          ) : null}
          {visibleScenarios.includes("custom") ? (
            <Line
              type="monotone"
              dataKey="custom"
              stroke={STROKE_MAP.custom}
              strokeDasharray="5 4"
              {...DOTLESS_LINE}
            />
          ) : null}
          {visibleScenarios.includes("protocol") ? (
            <Line
              type="monotone"
              dataKey="protocol"
              stroke={STROKE_MAP.protocol}
              strokeDasharray="2 3"
              {...DOTLESS_LINE}
            />
          ) : null}
          {visibleScenarios.includes("compareB") ? (
            <Line
              type="monotone"
              dataKey="compareB"
              stroke={STROKE_MAP.compareB}
              strokeDasharray="6 4"
              {...DOTLESS_LINE}
            />
          ) : null}

          {endLabels.map((item) => (
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
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
