"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type SystemReportModalProps = {
  open: boolean;
  onClose: () => void;
  reportText: string;
  supportEmail?: string | null;
};

export function SystemReportModal({ open, onClose, reportText, supportEmail }: SystemReportModalProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const mailtoHref = useMemo(() => {
    if (!supportEmail) return null;
    const subject = encodeURIComponent("LIFE OS System Report");
    const body = encodeURIComponent(reportText);
    return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  }, [reportText, supportEmail]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="System report modal" panelClassName="max-w-[560px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">System Report</h2>
              <p className="mt-1 text-xs text-zinc-400">Copy this report and send it to support.</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <textarea
            readOnly
            value={reportText}
            className="h-64 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300 outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-400"
            >
              Copy report
            </button>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                Email support
              </a>
            ) : null}
            {copyState === "copied" ? <span className="text-xs text-emerald-300">Copied</span> : null}
            {copyState === "error" ? <span className="text-xs text-rose-300">Copy failed</span> : null}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

