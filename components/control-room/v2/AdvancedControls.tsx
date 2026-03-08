"use client";

import Link from "next/link";

type AdvancedControlsProps = {
  readOnly: boolean;
  onExport: () => void;
  onExplain: () => void;
  onReportIssue: () => void;
  onGlossary: () => void;
  onLogout: () => void;
  onReset: () => void;
  onDelete: () => void;
};

export function AdvancedControls({
  readOnly,
  onExport,
  onExplain,
  onReportIssue,
  onGlossary,
  onLogout,
  onReset,
  onDelete,
}: AdvancedControlsProps) {
  return (
    <details className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">Advanced Controls v</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onExport} className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">
          Export system log
        </button>
        <button type="button" onClick={onExplain} className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">
          Explain state
        </button>
        <button type="button" onClick={onReportIssue} className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">
          Report issue
        </button>
        <button type="button" onClick={onGlossary} className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500">
          Glossary
        </button>
        <Link href="/app/settings" className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-sm text-zinc-200 hover:border-zinc-500">
          Settings
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
        >
          Logout
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={readOnly}
          title={readOnly ? "Simulation account is read-only." : undefined}
          className="min-h-10 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset system
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={readOnly}
          title={readOnly ? "Simulation account is read-only." : undefined}
          className="min-h-10 rounded-md border border-rose-700/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete account
        </button>
      </div>
    </details>
  );
}
