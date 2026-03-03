"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { ModalShell } from "@/components/ui/ModalShell";

type DeleteAccountModalProps = {
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
};

export function DeleteAccountModal({ open, onClose, onDone }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setStatus("idle");
      setError(null);
      setErrorId(null);
    }
  }, [open]);

  const canConfirm = useMemo(() => confirmText.trim() === "DELETE" && status === "idle", [confirmText, status]);

  const handleDelete = async (requestClose: (afterClose?: () => void) => void) => {
    if (!canConfirm) return;
    try {
      setStatus("deleting");
      setError(null);
      setErrorId(null);

      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string; errorId?: string };

      if (!response.ok || !payload.ok) {
        if (payload.error === "SYSTEM_FAULT" && payload.errorId) {
          setErrorId(payload.errorId);
          throw new Error("System fault.");
        }
        throw new Error(payload.error ?? "Failed to delete account.");
      }

      setStatus("done");
      window.setTimeout(() => {
        requestClose(() => {
          void onDone();
        });
      }, 350);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete account.";
      setError(message);
      setStatus("idle");
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Delete account modal" panelClassName="max-w-[520px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Account</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">Delete Account</h2>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              disabled={status === "deleting"}
            >
              Close
            </button>
          </div>

          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-300">
            <li>This will permanently delete your account and all associated data.</li>
            <li>This action cannot be undone.</li>
          </ul>

          <p className="text-xs text-zinc-500">Type DELETE to confirm.</p>

          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="Type DELETE"
            autoComplete="off"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/40"
            disabled={status === "deleting"}
          />

          {error ? (
            errorId ? (
              <ErrorIdNotice message="System fault." errorId={errorId} />
            ) : (
              <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>
            )
          ) : null}

          {status === "done" ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
              Account deleted.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => requestClose()}
              disabled={status === "deleting"}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(requestClose)}
              disabled={!canConfirm}
              className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "deleting" ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
