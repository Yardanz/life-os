"use client";

type SystemStatusCardProps = {
  lifeScore: number;
  state: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  confidencePct: number;
  shortExplanation: string;
  onExplain: () => void;
  explainUnlocked: boolean;
  lockedHint?: string;
};

function toneClass(state: string): string {
  if (state === "LOCKDOWN") return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  if (state === "CAUTION") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export function SystemStatusCard({
  lifeScore,
  state,
  confidencePct,
  shortExplanation,
  onExplain,
  explainUnlocked,
  lockedHint,
}: SystemStatusCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Status</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-100">{lifeScore.toFixed(1)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current State</p>
          <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-sm font-semibold ${toneClass(state)}`}>{state}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Confidence</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-100">{confidencePct}%</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-300">{shortExplanation}</p>
      {explainUnlocked ? (
        <button
          type="button"
          onClick={onExplain}
          className="mt-4 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400"
        >
          Explain this
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
          {lockedHint ?? "Available after additional check-ins."}
        </div>
      )}
    </section>
  );
}
