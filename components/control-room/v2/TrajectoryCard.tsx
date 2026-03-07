"use client";

import { useMemo, useState } from "react";

type Point = { date: string; lifeScore: number };

type TrajectoryCardProps = {
  points: Point[];
  risk: number;
  recovery: number;
};

function trendDirection(points: Point[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const first = points[0]?.lifeScore ?? 0;
  const last = points[points.length - 1]?.lifeScore ?? 0;
  if (last - first > 1) return "up";
  if (last - first < -1) return "down";
  return "flat";
}

export function TrajectoryCard({ points, risk, recovery }: TrajectoryCardProps) {
  const direction = trendDirection(points);
  const riskDirection = risk >= 70 ? "Rising risk" : risk >= 40 ? "Moderate risk" : "Contained risk";
  const recoverySignal = recovery >= 70 ? "Recovery stable" : recovery >= 55 ? "Recovery mixed" : "Recovery weak";
  const chartValues = useMemo(() => points.slice(-7), [points]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const view = {
    width: 760,
    height: 260,
    left: 56,
    right: 24,
    top: 20,
    bottom: 52,
  };
  const plotWidth = view.width - view.left - view.right;
  const plotHeight = view.height - view.top - view.bottom;
  const lifeValues = chartValues.map((point) => point.lifeScore).filter((value) => Number.isFinite(value));
  const rawMin = lifeValues.length > 0 ? Math.min(...lifeValues) : 0;
  const rawMax = lifeValues.length > 0 ? Math.max(...lifeValues) : 100;
  const yMin = Math.max(0, Math.floor((rawMin - 10) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((rawMax + 10) / 5) * 5);
  const effectiveYMax = yMax <= yMin ? Math.min(100, yMin + 20) : yMax;
  const effectiveYMin = yMax <= yMin ? Math.max(0, yMin - 20) : yMin;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = effectiveYMin + (effectiveYMax - effectiveYMin) * ratio;
    return Math.round(value * 10) / 10;
  }).reverse();
  const yRange = effectiveYMax - effectiveYMin;

  const pointsWithCoords = chartValues.map((point, idx) => {
    const x =
      chartValues.length > 1
        ? view.left + (idx / (chartValues.length - 1)) * plotWidth
        : view.left + plotWidth / 2;
    const clamped = Math.max(effectiveYMin, Math.min(effectiveYMax, point.lifeScore));
    const y = view.top + ((effectiveYMax - clamped) / yRange) * plotHeight;
    return { ...point, x, y };
  });

  const pathD = pointsWithCoords
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const xLabelFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const hoveredPoint = hoveredIndex == null ? null : pointsWithCoords[hoveredIndex] ?? null;
  const isRightEdgeHover = hoveredPoint ? hoveredPoint.x > view.left + plotWidth * 0.78 : false;
  const hoverGuideX = hoveredPoint?.x ?? null;

  const updateHoverByClientX = (clientX: number, rect: DOMRect) => {
    if (pointsWithCoords.length === 0) return;
    const relativeX = ((clientX - rect.left) / rect.width) * view.width;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pointsWithCoords.length; i += 1) {
      const distance = Math.abs(pointsWithCoords[i].x - relativeX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    setHoveredIndex(bestIndex);
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Trajectory</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-100">Last 7 days</h3>
      <div className="relative mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        <svg
          viewBox={`0 0 ${view.width} ${view.height}`}
          className="h-64 w-full"
          role="img"
          aria-label="Life score trend for last 7 days"
          onMouseMove={(event) => updateHoverByClientX(event.clientX, event.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <text
            x={view.left + plotWidth / 2}
            y={12}
            textAnchor="middle"
            fill="rgb(113 113 122)"
            fontSize="11"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            Life Score
          </text>

          {yTicks.map((tick) => {
            const y = view.top + ((effectiveYMax - tick) / yRange) * plotHeight;
            return (
              <g key={tick}>
                <line x1={view.left} y1={y} x2={view.width - view.right} y2={y} stroke="rgb(39 39 42)" strokeWidth="1" />
                <text
                  x={view.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgb(113 113 122)"
                  fontSize="11"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line x1={view.left} y1={view.top} x2={view.left} y2={view.height - view.bottom} stroke="rgb(82 82 91)" strokeWidth="1" />
          <line
            x1={view.left}
            y1={view.height - view.bottom}
            x2={view.width - view.right}
            y2={view.height - view.bottom}
            stroke="rgb(82 82 91)"
            strokeWidth="1"
          />
          {hoverGuideX != null ? (
            <line
              x1={hoverGuideX}
              y1={view.top}
              x2={hoverGuideX}
              y2={view.height - view.bottom}
              stroke="rgb(113 113 122)"
              strokeOpacity="0.45"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          ) : null}

          {pointsWithCoords.length >= 2 ? (
            <path d={pathD} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}

          {pointsWithCoords.map((point, idx) => (
            <g key={`${point.date}-${idx}`}>
              <circle cx={point.x} cy={point.y} r="2.8" fill="rgb(34 211 238)" />
            </g>
          ))}

          {pointsWithCoords.map((point, idx) => {
            const date = new Date(point.date);
            const label = Number.isFinite(date.getTime()) ? xLabelFormatter.format(date) : point.date;
            const anchor = idx === 0 ? "start" : idx === pointsWithCoords.length - 1 ? "end" : "middle";
            return (
              <text
                key={`x-${point.date}-${idx}`}
                x={point.x}
                y={view.height - 16}
                textAnchor={anchor}
                fill="rgb(113 113 122)"
                fontSize="11"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {label}
              </text>
            );
          })}
        </svg>

        {hoveredPoint ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            style={{
              left: `calc(${((hoveredPoint.x / view.width) * 100).toFixed(2)}% - ${isRightEdgeHover ? 120 : 48}px)`,
              top: `calc(${((hoveredPoint.y / view.height) * 100).toFixed(2)}% - 52px)`,
            }}
          >
            <p className="font-medium">
              {(() => {
                const d = new Date(hoveredPoint.date);
                return Number.isFinite(d.getTime()) ? tooltipDateFormatter.format(d) : hoveredPoint.date;
              })()}
            </p>
            <p>Life Score: {hoveredPoint.lifeScore.toFixed(1)}</p>
          </div>
        ) : null}

        {pointsWithCoords.length < 2 ? (
          <p className="mt-1 px-2 text-xs text-zinc-500">Need at least 2 check-ins to draw trend.</p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Trend: <span className="text-zinc-100">{direction}</span>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Risk direction: <span className="text-zinc-100">{riskDirection}</span>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Recovery signal: <span className="text-zinc-100">{recoverySignal}</span>
        </div>
      </div>
    </section>
  );
}
