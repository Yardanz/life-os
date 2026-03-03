"use client";

import { useMemo, useState } from "react";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { ModalShell } from "@/components/ui/ModalShell";

type ExportFormat = "json" | "csv";
type ExportRange = "7" | "30" | "all";

type ExportSystemLogModalProps = {
  open: boolean;
  onClose: () => void;
};

function currentDateLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExportSystemLogModal({ open, onClose }: ExportSystemLogModalProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [range, setRange] = useState<ExportRange>("30");
  const [status, setStatus] = useState<"idle" | "downloading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const canDownload = useMemo(() => status === "idle", [status]);

  const handleDownload = async (requestClose: (afterClose?: () => void) => void) => {
    if (!canDownload) return;
    try {
      setStatus("downloading");
      setError(null);
      setErrorId(null);

      const response = await fetch(`/api/export?format=${format}&range=${range}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; errorId?: string }
          | null;
        if (payload?.error === "SYSTEM_FAULT" && payload.errorId) {
          setErrorId(payload.errorId);
          throw new Error("System fault.");
        }
        throw new Error(payload?.error ?? "Failed to export data.");
      }

      const blob = await response.blob();
      const ext = format === "csv" ? "csv" : "json";
      const filename = `lifeos_export_${range}_${currentDateLabel()}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      requestClose();
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : "Failed to export data.";
      setError(message);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Export system log modal" panelClassName="max-w-[440px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Export</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">Export System Log</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              disabled={status === "downloading"}
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.14em] text-zinc-500">Format</label>
            <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
              {(["json", "csv"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  className={`rounded px-3 py-1.5 transition ${
                    format === value ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="export-range" className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Range
            </label>
            <select
              id="export-range"
              value={range}
              onChange={(event) => setRange(event.target.value as ExportRange)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All (capped to 365 days)</option>
            </select>
          </div>

          {error ? (
            errorId ? (
              <ErrorIdNotice message="System fault." errorId={errorId} />
            ) : (
              <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>
            )
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => requestClose()}
              disabled={status === "downloading"}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDownload(requestClose)}
              disabled={!canDownload}
              className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "downloading" ? "Downloading..." : "Download"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
