"use client";

import {
  LineChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SAFE_THRESHOLD = 65;
const CAUTION_THRESHOLD = 80;

type RiskEnvelopePoint = {
  tLabel: string;
  riskStabilize: number;
  riskBaseline: number;
  riskOverload: number;
};

type RiskEnvelopeChartProps = {
  points: RiskEnvelopePoint[];
  showOverload?: boolean;
  safeWindowHours?: number | null;
  guardrailLevel?: 0 | 1 | 2;
};

type ChartPoint = RiskEnvelopePoint & { idx: number };

type TooltipPayloadValue = {
  payload?: ChartPoint;
};

type EnvelopeTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadValue[];
  showOverload?: boolean;
};

function EnvelopeTooltip({ active, payload, showOverload = true }: EnvelopeTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-52 rounded-md border border-zinc-700/80 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="text-zinc-200">{row.tLabel}</p>
      <div className="mt-1 space-y-1 font-mono tabular-nums">
        <div className="grid grid-cols-[72px_1fr] gap-x-2 text-emerald-200">
          <span>STB</span>
          <span className="text-right">{row.riskStabilize.toFixed(1)}</span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-x-2 text-cyan-200">
          <span>BASE</span>
          <span className="text-right">{row.riskBaseline.toFixed(1)}</span>
        </div>
        {showOverload ? (
          <div className="grid grid-cols-[72px_1fr] gap-x-2 text-rose-200">
            <span>OVR</span>
            <span className="text-right">{row.riskOverload.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RiskEnvelopeChart({
  points,
  showOverload = true,
  safeWindowHours = null,
  guardrailLevel = 0,
}: RiskEnvelopeChartProps) {
  const chartData: ChartPoint[] = points.map((point, idx) => ({ ...point, idx }));
  const safeWindowX =
    typeof safeWindowHours === "number" && Number.isFinite(safeWindowHours)
      ? Math.min(Math.max(safeWindowHours / 24, 0), 3)
      : null;
  const budgetLabel = guardrailLevel === 2 ? "Budget window (LOCKDOWN)" : "Budget window";
  const budgetStroke = guardrailLevel === 2 ? "#fb7185" : "#22d3ee";

  return (
    <div className="h-64 w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 14, right: 16, bottom: 20, left: 6 }}>
          <ReferenceArea
            x1={-0.5}
            x2={3.5}
            y1={0}
            y2={SAFE_THRESHOLD}
            fill="#059669"
            fillOpacity={0.11}
            strokeOpacity={0}
          />
          <ReferenceArea
            x1={-0.5}
            x2={3.5}
            y1={SAFE_THRESHOLD}
            y2={CAUTION_THRESHOLD}
            fill="#f59e0b"
            fillOpacity={0.1}
            strokeOpacity={0}
          />
          <ReferenceArea
            x1={-0.5}
            x2={3.5}
            y1={CAUTION_THRESHOLD}
            y2={100}
            fill="#ef4444"
            fillOpacity={0.09}
            strokeOpacity={0}
          />

          <CartesianGrid stroke="#3f3f46" strokeDasharray="2 4" opacity={0.25} vertical={false} />
          <ReferenceLine
            y={SAFE_THRESHOLD}
            stroke="#f59e0b"
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: "Caution 65", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }}
          />
          <ReferenceLine
            y={CAUTION_THRESHOLD}
            stroke="#ef4444"
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: "Critical 80", fill: "#fca5a5", fontSize: 10, position: "insideTopRight" }}
          />
          {safeWindowX !== null ? (
            <ReferenceLine
              x={safeWindowX}
              stroke={budgetStroke}
              strokeWidth={1.4}
              strokeDasharray="5 4"
              ifOverflow="extendDomain"
              label={{ value: budgetLabel, fill: "#e4e4e7", fontSize: 10, position: "top" }}
            />
          ) : null}
          <XAxis
            type="number"
            dataKey="idx"
            domain={[-0.5, 3.5]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(value: number) => chartData[value]?.tLabel ?? ""}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            axisLine={{ stroke: "#52525b", opacity: 0.35 }}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 11 }}
            width={34}
          />
          <Tooltip
            cursor={{ stroke: "#71717a", strokeOpacity: 0.4, strokeDasharray: "3 3" }}
            content={<EnvelopeTooltip showOverload={showOverload} />}
          />

          <Line type="monotone" dataKey="riskStabilize" stroke="#34d399" strokeWidth={1.6} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="riskBaseline" stroke="#22d3ee" strokeWidth={1.6} dot={false} isAnimationActive={false} />
          {showOverload ? (
            <Line type="monotone" dataKey="riskOverload" stroke="#fb7185" strokeWidth={1.6} dot={false} isAnimationActive={false} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
