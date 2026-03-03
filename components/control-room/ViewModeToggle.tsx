"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import type { ViewMode } from "@/hooks/useViewMode";

type ViewModeToggleProps = {
  mode: ViewMode;
  onToggle: () => void;
};

export function ViewModeToggle({ mode, onToggle }: ViewModeToggleProps) {
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950/85 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:border-zinc-500"
        >
          VIEW: {mode === "simplified" ? "SIMPLIFIED" : "FULL"}
        </button>
        <button
          type="button"
          onClick={() => setExplainOpen(true)}
          className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500"
        >
          Explain
        </button>
      </div>
      <ModalShell
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        ariaLabel="View mode explanation"
        panelClassName="max-w-md p-4 sm:p-5"
      >
        <h3 className="text-sm font-medium text-zinc-100">View mode</h3>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-zinc-300">
          <li>SIMPLIFIED: operational core loop only.</li>
          <li>FULL: all diagnostics and scenario layers.</li>
        </ul>
      </ModalShell>
    </>
  );
}
