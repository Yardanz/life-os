"use client";

type SystemEvolutionStripProps = {
  currentDay: 1 | 3 | 5 | 7;
  completedCheckins: number;
};

type StageItem = {
  day: 1 | 3 | 5 | 7;
  label: string;
};

const STAGES: StageItem[] = [
  { day: 1, label: "Core status" },
  { day: 3, label: "Trajectory" },
  { day: 5, label: "Advanced controls" },
  { day: 7, label: "Full diagnostics" },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 text-emerald-300">
      <path d="M6.2 10.9 3.5 8.2l-1 1 3.7 3.7L13.5 5.6l-1-1z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 text-zinc-500">
      <path d="M11 6V5a3 3 0 1 0-6 0v1H4v7h8V6zm-5 0V5a2 2 0 1 1 4 0v1z" fill="currentColor" />
    </svg>
  );
}

export function SystemEvolutionStrip({ currentDay, completedCheckins }: SystemEvolutionStripProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">SYSTEM EVOLUTION</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {STAGES.map((stage) => {
          const complete = completedCheckins >= stage.day;
          const current = currentDay === stage.day;
          const future = !complete && !current;
          return (
            <div
              key={stage.day}
              className={[
                "rounded-lg border px-3 py-2 text-xs",
                current
                  ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                  : complete
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-400",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Day {stage.day}</p>
                {complete ? <CheckIcon /> : future ? <LockIcon /> : <span className="h-3.5 w-3.5 rounded-full border border-cyan-300/70" />}
              </div>
              <p className="mt-1">{stage.label}</p>
              {future ? <p className="mt-1 text-[11px] text-zinc-500">Locked</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
