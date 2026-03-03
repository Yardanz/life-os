"use client";

type PanelStateProps = {
  kind: "loading" | "empty" | "insufficient" | "error";
  title: string;
  subtitle?: string;
};

export function PanelState({ kind, title, subtitle }: PanelStateProps) {
  const toneClass =
    kind === "error"
      ? "border-rose-500/35 bg-rose-950/20 text-rose-200"
      : "border-zinc-800 bg-zinc-950/70 text-zinc-400";

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${toneClass}`}>
      <p className={kind === "error" ? "text-rose-100" : "text-zinc-300"}>{title}</p>
      {subtitle ? <p className="mt-1">{subtitle}</p> : null}
    </div>
  );
}
