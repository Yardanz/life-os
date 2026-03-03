"use client";

import { useMemo, useState } from "react";

type SeriesPoint = { date: string; lifeScore: number };

type SparklineChartProps = {
  title: string;
  points: SeriesPoint[];
};

type ChartScale = {
  min: number;
  max: number;
  range: number;
};

function getPath(points: SeriesPoint[], width: number, height: number, pad: number): string {
  if (points.length === 0) return "";

  const values = points.map((p) => p.lifeScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = pad + index * stepX;
      const y = height - pad - ((point.lifeScore - min) / range) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

type ChartPoint = {
  x: number;
  y: number;
  value: number;
  date: string;
};

function getScale(points: SeriesPoint[]): ChartScale {
  const values = points.map((p) => p.lifeScore);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 100;
  return {
    min,
    max,
    range: Math.max(max - min, 1),
  };
}

function valueToY(value: number, scale: ChartScale, height: number, pad: number): number {
  return height - pad - ((value - scale.min) / scale.range) * (height - pad * 2);
}

export function SparklineChart({ title, points }: SparklineChartProps) {
  const width = 720;
  const height = 180;
  const path = getPath(points, width, height, 14);
  const scale = getScale(points);
  const minCheckins = 2;
  const hasTrend = points.length >= minCheckins;
  const currentCheckins = points.length;

  const firstValue = hasTrend ? points[0]?.lifeScore ?? 0 : 0;
  const lastValue = hasTrend ? points[points.length - 1]?.lifeScore ?? 0 : 0;
  const avg7 = points.length > 0 ? points.reduce((sum, point) => sum + point.lifeScore, 0) / points.length : 0;
  const delta7d = hasTrend ? lastValue - firstValue : 0;
  const trendLabel = !hasTrend ? "Insufficient" : delta7d > 0.5 ? "Up" : delta7d < -0.5 ? "Down" : "Stable";
  const values = points.map((point) => point.lifeScore);
  const spread = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
  const volatilityLabel = spread < 3 ? "Low" : spread < 7 ? "Med" : "High";
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (points.length === 0) return [];
    const stepX = points.length > 1 ? (width - 14 * 2) / (points.length - 1) : 0;
    return points.map((point, index) => ({
      x: 14 + index * stepX,
      y: valueToY(point.lifeScore, scale, height, 14),
      value: point.lifeScore,
      date: point.date,
    }));
  }, [points, scale, width, height]);
  const nowY = hasTrend ? valueToY(lastValue, scale, height, 14) : 0;
  const nowX = hasTrend ? width - 14 : 0;
  const trendGlyph = trendLabel === "Up" ? "Up" : trendLabel === "Down" ? "Down" : "Stable";
  const hoveredPoint = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;
  const hoveredDelta =
    hoveredIndex !== null && hoveredIndex > 0 ? chartPoints[hoveredIndex].value - chartPoints[hoveredIndex - 1].value : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <div className="text-right">
          <span className="text-xs text-zinc-500">{points.length} pts</span>
          {points.length > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-500">
              NOW <span className="text-zinc-300">{lastValue.toFixed(1)}</span> | AVG7{" "}
              <span className="text-zinc-300">{avg7.toFixed(1)}</span>
            </p>
          ) : null}
        </div>
      </header>

      {hasTrend ? (
        <>
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-40 w-full"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <rect x="0" y="0" width={width} height={height} rx="12" className="fill-zinc-950" />
              {[20, 50, 80].map((tick) => {
                const y = valueToY(tick, scale, height, 14);
                return (
                  <g key={tick}>
                    <line
                      x1={14}
                      x2={width - 14}
                      y1={y}
                      y2={y}
                      stroke="rgba(161,161,170,0.18)"
                      strokeDasharray="3 4"
                      strokeWidth="1"
                    />
                    <text x={20} y={y - 3} fill="rgba(161,161,170,0.65)" fontSize="10">
                      {tick}
                    </text>
                  </g>
                );
              })}
              {hoveredPoint ? (
                <line
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={14}
                  y2={height - 14}
                  stroke="rgba(161,161,170,0.35)"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
              ) : null}
              {path ? (
                <>
                  <path d={path} className="fill-none stroke-zinc-700 stroke-[2]" />
                  <path d={path} className="fill-none stroke-emerald-400 stroke-[2.5]" />
                  <circle cx={nowX} cy={nowY} r="3" fill="rgb(52 211 153)" />
                  <text x={nowX - 30} y={nowY - 8} fill="rgba(212,212,216,0.8)" fontSize="10">
                    NOW
                  </text>
                </>
              ) : null}
              {chartPoints.map((point, index) => (
                <rect
                  key={`${point.date}-${index}`}
                  x={Math.max(0, point.x - 12)}
                  y={0}
                  width={24}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
              ))}
            </svg>
            {hoveredPoint && hoveredIndex !== null ? (
              <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-zinc-700 bg-zinc-950/95 px-2.5 py-2 text-[11px] text-zinc-200 shadow-[0_10px_22px_rgba(0,0,0,0.45)]">
                <p className="text-zinc-400">{hoveredPoint.date}</p>
                <p>Life Score: {hoveredPoint.value.toFixed(1)}</p>
                <p>{hoveredDelta === null ? "Δ prev: n/a" : `Δ prev: ${hoveredDelta >= 0 ? "+" : ""}${hoveredDelta.toFixed(1)}`}</p>
                <p>Volatility: {volatilityLabel}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-3 space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs">
            <p
              className="text-zinc-300"
              title="Delta is change over last 7 calendar days."
            >
              Trend {trendGlyph} <span className="text-zinc-400">|</span> Delta 7d{" "}
              {delta7d >= 0 ? "+" : ""}
              {delta7d.toFixed(1)} <span className="text-zinc-400">|</span> Vol {volatilityLabel}
            </p>
            <p className="text-zinc-500">
              Range: {Math.min(...values).toFixed(1)}-{Math.max(...values).toFixed(1)}
            </p>
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center rounded-xl border border-zinc-800 bg-zinc-950/80 px-4">
          <div className="space-y-1 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Trend Status</p>
            <p className="text-zinc-200">Insufficient data</p>
            <p className="text-zinc-400">Trend locked - need 2 points</p>
            <p className="text-zinc-500">Next unlock: after next check-in</p>
            <p className="text-zinc-500">Required: {minCheckins}</p>
            <p className="text-zinc-500">Current: {currentCheckins}</p>
          </div>
        </div>
      )}
    </section>
  );
}
