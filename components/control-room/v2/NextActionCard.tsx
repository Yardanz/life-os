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
      className={`mt-5 min-h-12 w-full rounded-lg border border-cyan-400 bg-cyan-400/90 px-5 py-3 text-base font-semibold text-zinc-950 transition hover:bg-cyan-300 ${
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
    <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 to-zinc-900/80 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Next Action</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-100">{title}</h2>
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
      <NextActionPrimaryButton label={primaryLabel} onClick={onPrimaryAction} />
      {onViewLastCheckin ? (
        <button
          type="button"
          onClick={onViewLastCheckin}
          className="mt-3 min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
        >
          View last check-in
        </button>
      ) : null}
    </section>
  );
}
