"use client";

import type { MetricKey } from "@/components/control-room/projection/types";
import { formatDateLabel, toDisplayValue } from "@/components/control-room/projection/format";

type TooltipPayloadValue = {
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: {
    dateISO?: string;
    baseline?: number;
    stabilize?: number;
    overload?: number;
    custom?: number;
    protocol?: number;
    compareB?: number;
  };
};

type ProjectionChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadValue[];
  label?: string | number;
  metric: MetricKey;
};

function metricTitle(metric: MetricKey): string {
  if (metric === "risk") return "Risk";
  if (metric === "burnout") return "Burnout";
  return "LifeScore";
}

export function ProjectionChartTooltip({ active, payload, metric }: ProjectionChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const baseline = row.baseline;
  const stabilize = row.stabilize;
  const overload = row.overload;
  const compareB = row.compareB;

  const stabilizeDelta =
    baseline !== undefined && stabilize !== undefined ? Number((stabilize - baseline).toFixed(1)) : null;
  const overloadDelta =
    baseline !== undefined && overload !== undefined ? Number((overload - baseline).toFixed(1)) : null;
  const compareBDelta =
    baseline !== undefined && compareB !== undefined ? Number((compareB - baseline).toFixed(1)) : null;

  return (
    <div className="min-w-44 rounded-md border border-zinc-700/80 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="text-zinc-200">{formatDateLabel(row.dateISO ?? "")}</p>
      <p className="mb-2 text-[11px] text-zinc-500">{metricTitle(metric)}</p>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="grid grid-cols-[34px_50px_42px] gap-x-2 text-cyan-200">
          <span>BASE</span>
          <span className="text-right">{toDisplayValue(baseline)}</span>
          <span className="text-right text-zinc-500">-</span>
        </div>
        <div className="grid grid-cols-[34px_50px_42px] gap-x-2 text-emerald-200">
          <span>STB</span>
          <span className="text-right">{toDisplayValue(stabilize)}</span>
          <span className="text-right text-zinc-400">
            {stabilizeDelta !== null ? `${stabilizeDelta >= 0 ? "+" : ""}${stabilizeDelta.toFixed(1)}` : "-"}
          </span>
        </div>
        <div className="grid grid-cols-[34px_50px_42px] gap-x-2 text-rose-200">
          <span>OVR</span>
          <span className="text-right">{toDisplayValue(overload)}</span>
          <span className="text-right text-zinc-400">
            {overloadDelta !== null ? `${overloadDelta >= 0 ? "+" : ""}${overloadDelta.toFixed(1)}` : "-"}
          </span>
        </div>
        {row.protocol !== undefined ? (
          <div className="grid grid-cols-[34px_50px_42px] gap-x-2 text-sky-200">
            <span>ACP</span>
            <span className="text-right">{toDisplayValue(row.protocol)}</span>
            <span className="text-right text-zinc-500">-</span>
          </div>
        ) : null}
        {row.compareB !== undefined ? (
          <div className="grid grid-cols-[34px_50px_42px] gap-x-2 text-amber-200">
            <span>B</span>
            <span className="text-right">{toDisplayValue(compareB)}</span>
            <span className="text-right text-zinc-400">
              {compareBDelta !== null ? `${compareBDelta >= 0 ? "+" : ""}${compareBDelta.toFixed(1)}` : "-"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
