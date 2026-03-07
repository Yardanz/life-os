"use client";

import { useMemo, useState } from "react";

type Point = { date: string; lifeScore: number };

type Trajectory30dCardProps = {
  points: Point[];
};

export function Trajectory30dCard({ points }: Trajectory30dCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartValues = useMemo(() => points.slice(-30), [points]);

  const view = { width: 900, height: 260, left: 56, right: 24, top: 20, bottom: 52 };
  const plotWidth = view.width - view.left - view.right;
  const plotHeight = view.height - view.top - view.bottom;

  const lifeValues = chartValues.map((point) => point.lifeScore).filter((value) => Number.isFinite(value));
  const rawMin = lifeValues.length > 0 ? Math.min(...lifeValues) : 0;
  const rawMax = lifeValues.length > 0 ? Math.max(...lifeValues) : 100;
  const yMin = Math.max(0, Math.floor((rawMin - 10) / 5) * 5);
  const yMax = Math.min(100, Math.ceil((rawMax + 10) / 5) * 5);
  const effectiveYMax = yMax <= yMin ? Math.min(100, yMin + 20) : yMax;
  const effectiveYMin = yMax <= yMin ? Math.max(0, yMin - 20) : yMin;
  const yRange = effectiveYMax - effectiveYMin;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return Math.round((effectiveYMin + (effectiveYMax - effectiveYMin) * ratio) * 10) / 10;
  }).reverse();

  const coords = chartValues.map((point, idx) => {
    const x = chartValues.length > 1 ? view.left + (idx / (chartValues.length - 1)) * plotWidth : view.left + plotWidth / 2;
    const clamped = Math.max(effectiveYMin, Math.min(effectiveYMax, point.lifeScore));
    const y = view.top + ((effectiveYMax - clamped) / yRange) * plotHeight;
    return { ...point, x, y };
  });
  const pathD = coords.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

  const xLabelFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const hovered = hoveredIndex == null ? null : coords[hoveredIndex] ?? null;
  const isRightEdgeHover = hovered ? hovered.x > view.left + plotWidth * 0.82 : false;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-amber-300/70">Advanced Trajectory</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-100">Last 30 days</h3>
      <div className="relative mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        <svg viewBox={`0 0 ${view.width} ${view.height}`} className="h-64 w-full" role="img" aria-label="Life score trend for last 30 days">
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
                <text x={view.left - 8} y={y + 4} textAnchor="end" fill="rgb(113 113 122)" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          <line x1={view.left} y1={view.top} x2={view.left} y2={view.height - view.bottom} stroke="rgb(82 82 91)" strokeWidth="1" />
          <line x1={view.left} y1={view.height - view.bottom} x2={view.width - view.right} y2={view.height - view.bottom} stroke="rgb(82 82 91)" strokeWidth="1" />

          {coords.length >= 2 ? <path d={pathD} fill="none" stroke="rgb(251 191 36)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" /> : null}

          {coords.map((point, idx) => (
            <g key={`${point.date}-${idx}`}>
              <circle cx={point.x} cy={point.y} r="2.3" fill="rgb(251 191 36)" />
              <circle
                cx={point.x}
                cy={point.y}
                r="9"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex((current) => (current === idx ? null : current))}
              />
            </g>
          ))}

          {coords.map((point, idx) => {
            if (idx % 5 !== 0 && idx !== coords.length - 1) return null;
            const date = new Date(point.date);
            const label = Number.isFinite(date.getTime()) ? xLabelFormatter.format(date) : point.date;
            const anchor = idx === 0 ? "start" : idx === coords.length - 1 ? "end" : "middle";
            return (
              <text key={`x-${point.date}-${idx}`} x={point.x} y={view.height - 16} textAnchor={anchor} fill="rgb(113 113 122)" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {label}
              </text>
            );
          })}
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            style={{
              left: `calc(${((hovered.x / view.width) * 100).toFixed(2)}% - ${isRightEdgeHover ? 120 : 48}px)`,
              top: `calc(${((hovered.y / view.height) * 100).toFixed(2)}% - 52px)`,
            }}
          >
            <p className="font-medium">
              {(() => {
                const d = new Date(hovered.date);
                return Number.isFinite(d.getTime()) ? tooltipDateFormatter.format(d) : hovered.date;
              })()}
            </p>
            <p>Life Score: {hovered.lifeScore.toFixed(1)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
