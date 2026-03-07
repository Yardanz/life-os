"use client";

type SystemProjectionCardProps = {
  risk: number;
  lifeScore: number;
  deltaRecovery: number | null;
  deltaLoad: number | null;
  onApply: () => void;
  onUseYesterday: () => void;
};

function fmtDelta(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function riskState(risk: number): string {
  if (risk >= 70) return "Rising risk";
  if (risk >= 45) return "Moderate risk";
  return "Contained risk";
}

export function SystemProjectionCard({
  risk,
  lifeScore,
  deltaRecovery,
  deltaLoad,
  onApply,
  onUseYesterday,
}: SystemProjectionCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Projection</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Recovery delta: <span className="text-zinc-100">{fmtDelta(deltaRecovery)}</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Load delta: <span className="text-zinc-100">{fmtDelta(deltaLoad)}</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Risk state: <span className="text-zinc-100">{riskState(risk)}</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Projected Life Score: <span className="text-zinc-100">{lifeScore.toFixed(1)}</span>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-cyan-400"
        >
          Apply to System
        </button>
        <button
          type="button"
          onClick={onUseYesterday}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
        >
          Use yesterday
        </button>
      </div>
    </section>
  );
}
