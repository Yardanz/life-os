"use client";

import { formatDelta } from "@/lib/control-room/formatting";

type StatCardProps = {
  label: string;
  value: number;
  delta: number;
  hasPreviousDay: boolean;
};

export function StatCard({ label, value, delta, hasPreviousDay }: StatCardProps) {
  const deltaView = formatDelta(delta, hasPreviousDay);

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value.toFixed(1)}</p>
      <p className={["mt-2 text-sm", deltaView.colorClass].join(" ")}>{deltaView.label}</p>
    </article>
  );
}
