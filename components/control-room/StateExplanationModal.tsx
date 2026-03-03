"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import type { StateExplanation } from "@/lib/control-room/stateExplanation";
import { t, type Locale } from "@/lib/i18n";

type StateExplanationModalProps = {
  open: boolean;
  onClose: () => void;
  explanation: StateExplanation;
  locale: Locale;
};

function buildCopyText(explanation: StateExplanation): string {
  const lines: string[] = [explanation.title, ""];
  if (explanation.lines.length > 0) {
    lines.push("Summary:");
    for (const line of explanation.lines) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }
  if (explanation.drivers.length > 0) {
    lines.push("Primary drivers:");
    for (const driver of explanation.drivers) {
      lines.push(`- ${driver}`);
    }
  }
  return lines.join("\n");
}

export function StateExplanationModal({ open, onClose, explanation, locale }: StateExplanationModalProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const copyText = useMemo(() => buildCopyText(explanation), [explanation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="State explanation modal" panelClassName="max-w-[560px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{t("explainStateModalTitle", locale)}</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">{explanation.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
            {explanation.lines.length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-zinc-300">
                {explanation.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No deterministic explanation lines available.</p>
            )}
            </div>

            {explanation.drivers.length > 0 ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Primary drivers</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-300">
                  {explanation.drivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400"
            >
              Copy
            </button>
            {copyState === "copied" ? <span className="text-xs text-emerald-300">Copied.</span> : null}
            {copyState === "error" ? <span className="text-xs text-rose-300">Copy failed.</span> : null}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
