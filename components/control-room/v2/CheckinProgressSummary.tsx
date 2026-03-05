"use client";

type CheckinProgressSummaryProps = {
  completedCheckins: number;
  nextUnlockDay: 3 | 5 | 7 | null;
};

export function CheckinProgressSummary({ completedCheckins, nextUnlockDay }: CheckinProgressSummaryProps) {
  const done = Math.max(0, Math.min(7, completedCheckins));
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Progress Summary</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">Check-ins completed: <span className="text-zinc-100">{done} / 7</span></p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
          Next unlock: <span className="text-zinc-100">{nextUnlockDay ? `Day ${nextUnlockDay}` : "All unlocked"}</span>
        </p>
        <p className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">Baseline stabilization: <span className="text-zinc-100">{done} / 7</span></p>
      </div>
    </section>
  );
}
