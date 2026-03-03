"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { GLOSSARY_ENTRIES } from "@/lib/glossary";

type GlossaryModalProps = {
  open: boolean;
  onClose: () => void;
};

export function GlossaryModal({ open, onClose }: GlossaryModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return GLOSSARY_ENTRIES;
    return GLOSSARY_ENTRIES.filter((entry) => {
      return (
        entry.term.toLowerCase().includes(normalized) ||
        entry.definition.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  return (
    <ModalShell
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      ariaLabel="Glossary"
      panelClassName="max-w-3xl p-5 sm:p-6"
    >
      {({ requestClose }) => (
        <div className="flex max-h-[80vh] flex-col">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Glossary</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-100">System Terms</h2>
              <p className="mt-1 text-xs text-zinc-400">Short operational definitions.</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose(() => setQuery(""))}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter terms"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
          />

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {filtered.length > 0 ? (
              filtered.map((entry) => (
                <article key={entry.term} className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <h3 className="text-sm font-medium text-zinc-100">{entry.term}</h3>
                  <p className="mt-1 text-xs text-zinc-400">{entry.definition}</p>
                </article>
              ))
            ) : (
              <p className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-500">
                No terms match this filter.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
            <Link href="/pricing" className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200">
              Capability Specification
            </Link>
            <Link href="/privacy" className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200">
              Privacy
            </Link>
            <Link href="/terms" className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200">
              Terms
            </Link>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
