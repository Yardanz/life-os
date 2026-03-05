"use client";

type LockedSectionCardProps = {
  title: string;
  unlockDay: 3 | 5 | 7;
};

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 text-zinc-500">
      <path d="M11 6V5a3 3 0 1 0-6 0v1H4v7h8V6zm-5 0V5a2 2 0 1 1 4 0v1z" fill="currentColor" />
    </svg>
  );
}

export function LockedSectionCard({ title, unlockDay }: LockedSectionCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <LockIcon />
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      </div>
      <p className="mt-2 text-sm text-zinc-400">Unlocks at Day {unlockDay} (after more check-ins)</p>
    </section>
  );
}
