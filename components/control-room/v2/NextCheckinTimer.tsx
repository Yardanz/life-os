"use client";

type NextCheckinTimerProps = {
  availableNow: boolean;
  msRemaining: number | null;
};

function formatHHMM(msRemaining: number | null): string {
  if (msRemaining == null || msRemaining <= 0) return "--:--";
  const totalMinutes = Math.ceil(msRemaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function NextCheckinTimer({ availableNow, msRemaining }: NextCheckinTimerProps) {
  const text =
    typeof window === "undefined"
      ? "—"
      : availableNow
        ? "Check-in available now"
        : `Next check-in in ${formatHHMM(msRemaining)}`;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Check-in Window</p>
      <p className="mt-2 text-sm text-zinc-200" suppressHydrationWarning>{text}</p>
    </section>
  );
}
