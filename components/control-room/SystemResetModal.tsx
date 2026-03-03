"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { ModalShell } from "@/components/ui/ModalShell";

type SystemResetModalProps = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

export function SystemResetModal({ open, onClose, onDone }: SystemResetModalProps) {
  const [status, setStatus] = useState<"idle" | "resetting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError(null);
      setErrorId(null);
    }
  }, [open]);

  const canConfirm = useMemo(() => status === "idle", [status]);

  const handleReset = async (requestClose: (afterClose?: () => void) => void) => {
    if (!canConfirm) return;
    try {
      setStatus("resetting");
      setError(null);
      setErrorId(null);
      const response = await fetch("/api/setup/reset", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string; errorId?: string };
      if (!response.ok || !payload.ok) {
        if (payload.error === "SYSTEM_FAULT" && payload.errorId) {
          setErrorId(payload.errorId);
          throw new Error("System fault.");
        }
        throw new Error(payload.error ?? "Failed to reset system.");
      }
      setStatus("done");
      window.setTimeout(() => {
        requestClose(onDone);
      }, 350);
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : "Failed to reset system.";
      setError(message);
      setStatus("idle");
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="System reset modal" panelClassName="max-w-[520px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Reset</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">Reset System</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              disabled={status === "resetting"}
            >
              Close
            </button>
          </div>

          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-300">
            <li>This will permanently remove all operational history.</li>
            <li>Baseline calibration will restart (7 check-ins required).</li>
            <li>This action cannot be undone.</li>
          </ul>

          {error ? (
            errorId ? (
              <ErrorIdNotice message="System fault." errorId={errorId} />
            ) : (
              <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>
            )
          ) : null}

          {status === "done" ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
              System reset complete.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => requestClose()}
              disabled={status === "resetting"}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleReset(requestClose)}
              disabled={!canConfirm}
              className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "resetting" ? "Resetting..." : "Confirm Reset"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
