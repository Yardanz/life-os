"use client";

import type { RequiredActionsOutput, RequiredActionCta } from "@/lib/control-room/requiredActions";

type RequiredActionsPanelProps = {
  model: RequiredActionsOutput;
  onAction: (action: RequiredActionCta["action"]) => void;
};

function statusClass(status: "pending" | "done" | "blocked"): string {
  if (status === "done") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "blocked") return "border-zinc-700 bg-zinc-900/70 text-zinc-400";
  return "border-amber-500/40 bg-amber-500/10 text-amber-200";
}

export function RequiredActionsPanel({ model, onAction }: RequiredActionsPanelProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-medium text-zinc-200">REQUIRED ACTIONS</h2>
      <div className="mt-3 space-y-2">
        {model.steps.map((step, index) => (
          <div key={step.id} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-zinc-300">
                {index + 1}. {step.label}
              </p>
              <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusClass(step.status)}`}>
                {step.status}
              </span>
            </div>
            {step.cta ? (
              <button
                type="button"
                onClick={() => onAction(step.cta!.action)}
                className="mt-2 min-h-9 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-400"
              >
                {step.cta.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {model.warningLine ? <p className="mt-3 text-xs text-amber-200">{model.warningLine}</p> : null}
      {model.noteLine ? <p className="mt-1 text-[11px] text-zinc-500">{model.noteLine}</p> : null}
      {model.readOnlyLine ? <p className="mt-1 text-[11px] text-zinc-500">{model.readOnlyLine}</p> : null}
    </section>
  );
}

