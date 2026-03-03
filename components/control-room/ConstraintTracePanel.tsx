"use client";

import { PanelState } from "@/components/control-room/PanelState";
import { type ConstraintTraceItem, formatTraceValue } from "@/lib/control-room/constraintTrace";

type ConstraintTracePanelProps = {
  hasActiveProtocol: boolean;
  hasConstraints: boolean;
  items: ConstraintTraceItem[];
  guardrailLabel: "OPEN" | "CAUTION" | "LOCKDOWN";
  lastEnforcedAt: string | null;
  readOnly: boolean;
  onApplyProtocol: () => void;
  onViewLastEvent: () => void;
};

function statusClass(status: ConstraintTraceItem["status"]): string {
  if (status === "VIOLATION") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (status === "NEAR") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (status === "OK") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
}

export function ConstraintTracePanel({
  hasActiveProtocol,
  hasConstraints,
  items,
  guardrailLabel,
  lastEnforcedAt,
  readOnly,
  onApplyProtocol,
  onViewLastEvent,
}: ConstraintTracePanelProps) {
  const showLockState = !hasActiveProtocol || !hasConstraints;

  return (
    <section id="constraint-trace" className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Constraint Trace</h2>
      <p className="mt-1 text-[11px] text-zinc-500">Active boundaries and current margin.</p>

      {lastEnforcedAt ? (
        <p className="mt-2 text-[11px] text-zinc-500">Last enforced: {new Date(lastEnforcedAt).toLocaleString()}</p>
      ) : null}

      {showLockState ? (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs text-zinc-300">Inactive — no enforced constraints.</p>
          <p className="mt-1 text-[11px] text-zinc-500">Trace activates after protocol application.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onApplyProtocol}
              disabled={readOnly}
              className="min-h-9 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply protocol
            </button>
            <button
              type="button"
              onClick={onViewLastEvent}
              className="text-[11px] text-zinc-400 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-200"
            >
              View last protocol apply event
            </button>
          </div>
          {guardrailLabel === "LOCKDOWN" ? (
            <p className="mt-2 text-[11px] text-amber-200">Guardrail requires enforced constraints.</p>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3">
          <PanelState kind="empty" title="No active constraints." subtitle="Apply a protocol to enable trace." />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-200">{item.label}</p>
                <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="mt-1 grid gap-1 text-zinc-400 sm:grid-cols-2">
                <p>Limit: {formatTraceValue(item.limitValue, item.unit)}</p>
                <p>Window: {item.windowLabel ?? "—"}</p>
                <p>Current: {formatTraceValue(item.currentValue, item.unit)}</p>
                <p>
                  Margin:{" "}
                  {item.margin == null
                    ? "—"
                    : `${item.margin >= 0 ? "+" : ""}${formatTraceValue(item.margin, item.unit)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">Trace reflects enforced protocol constraints. No black-box inference.</p>
    </section>
  );
}
