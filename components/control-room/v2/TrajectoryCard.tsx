"use client";

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
  const chartValues = points.slice(-7);
  const values = chartValues.map((p) => p.lifeScore);
  const rawMax = values.length > 0 ? Math.max(...values) : 100;
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const pad = Math.max(0.5, (rawMax - rawMin) * 0.1);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const range = Math.max(1, max - min);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Trajectory</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-100">Last 7 days</h3>
      <div className="mt-3 h-28 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        {chartValues.length >= 2 ? (
          <svg viewBox="0 0 100 28" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Life score trend">
            <polyline
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="1.5"
              points={chartValues
                .map((point, idx) => {
                  const x = (idx / (chartValues.length - 1)) * 100;
                  const y = 26 - ((point.lifeScore - min) / range) * 24;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        ) : (
          <p className="text-xs text-zinc-500">Need at least 2 check-ins to draw trend.</p>
        )}
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
