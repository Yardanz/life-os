"use client";

type NextActionCardProps = {
  title: string;
  description: string;
  statusItems: string[];
  primaryLabel: string;
  onPrimaryAction: () => void;
  onViewLastCheckin: (() => void) | null;
};

type NextActionPrimaryButtonProps = {
  label: string;
  onClick?: () => void;
  inert?: boolean;
};

export function NextActionPrimaryButton({ label, onClick, inert = false }: NextActionPrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      aria-disabled={inert || undefined}
      tabIndex={inert ? -1 : undefined}
      className={`mt-4 min-h-12 w-full rounded-lg border border-cyan-400 bg-cyan-400/90 px-5 py-3 text-base font-semibold text-zinc-950 transition hover:bg-cyan-300 ${
        inert ? "pointer-events-none" : ""
      }`}
    >
      {label}
    </button>
  );
}

export function NextActionCard({
  title,
  description,
  statusItems,
  primaryLabel,
  onPrimaryAction,
  onViewLastCheckin,
}: NextActionCardProps) {
  return (
    <section className="rounded-2xl border border-cyan-500/35 bg-zinc-900/70 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Next Action</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Operational next step</p>
        </div>
        <span className="inline-flex rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-cyan-100">
          Action now
        </span>
      </div>
      <h2 className="mt-2 text-xl font-semibold text-zinc-100 sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-zinc-300">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {statusItems.map((item) => (
          <span
            key={item}
            className="inline-flex rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-200"
          >
            {item}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-cyan-500/30 bg-zinc-950/60 px-3 py-2 sm:mt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/90">Check-in operation</p>
        <p className="mt-1 text-xs text-zinc-300">Record a daily check-in to update the current operational day.</p>
      </div>
      <NextActionPrimaryButton label={primaryLabel} onClick={onPrimaryAction} />
      {onViewLastCheckin ? (
        <button
          type="button"
          onClick={onViewLastCheckin}
          className="mt-3 min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 sm:w-auto"
        >
          Open latest check-in
        </button>
      ) : null}
    </section>
  );
}
