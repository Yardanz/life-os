"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DeleteAccountModal } from "@/components/control-room/DeleteAccountModal";
import { ExportSystemLogModal } from "@/components/control-room/ExportSystemLogModal";
import { SystemResetModal } from "@/components/control-room/SystemResetModal";
import { PlanBadge } from "@/components/ui/PlanBadge";

type SettingsPanelProps = {
  plan: "FREE" | "PRO";
  providerLabel: "Google" | "GitHub" | "OAuth" | "Unknown";
  isAdmin?: boolean;
};

type SystemSnapshotRecord = {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export function SettingsPanel({ plan, providerLabel, isAdmin = false }: SettingsPanelProps) {
  const router = useRouter();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const [snapshotsEnabled, setSnapshotsEnabled] = useState(true);
  const [snapshots, setSnapshots] = useState<SystemSnapshotRecord[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [snapshotCopiedId, setSnapshotCopiedId] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    try {
      setSnapshotsLoading(true);
      setSnapshotsError(null);
      const response = await fetch("/api/snapshots?limit=5", { cache: "no-store" });
      if (response.status === 404) {
        setSnapshotsEnabled(false);
        setSnapshots([]);
        return;
      }
      const payload = (await response.json()) as
        | { ok: true; data: SystemSnapshotRecord[] }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setSnapshots([]);
        setSnapshotsError(payload.ok ? null : payload.error ?? "Failed to load snapshots.");
        return;
      }
      setSnapshots(payload.data);
      setSnapshotsEnabled(true);
    } catch {
      setSnapshots([]);
      setSnapshotsError("Failed to load snapshots.");
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const handleGenerateSnapshot = async () => {
    try {
      setSnapshotsError(null);
      setSnapshotNotice(null);
      const response = await fetch("/api/snapshots", { method: "POST" });
      const payload = (await response.json()) as
        | { ok: true; url: string; retryAfterMs?: number }
        | { ok: false; error?: string; retryAfterMs?: number };
      if (!response.ok || !payload.ok) {
        const retrySec = Math.max(1, Math.round(((payload as { retryAfterMs?: number }).retryAfterMs ?? 0) / 1000));
        if ((payload as { error?: string }).error === "RATE_LIMITED") {
          setSnapshotsError(`Rate limited. Try again in ~${retrySec}s.`);
          return;
        }
        setSnapshotsError((payload as { error?: string }).error ?? "Failed to generate snapshot.");
        return;
      }
      setSnapshotNotice(`Snapshot link generated: ${window.location.origin}${payload.url}`);
      await loadSnapshots();
    } catch {
      setSnapshotsError("Failed to generate snapshot.");
    }
  };

  const handleRevokeSnapshot = async (snapshotId: string) => {
    try {
      setSnapshotsError(null);
      const response = await fetch(`/api/snapshots/${snapshotId}/revoke`, { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setSnapshotsError(payload.error ?? "Failed to revoke snapshot.");
        return;
      }
      setSnapshotNotice("Snapshot revoked.");
      await loadSnapshots();
    } catch {
      setSnapshotsError("Failed to revoke snapshot.");
    }
  };

  const handleCopySnapshotLink = async (token: string, snapshotId: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setSnapshotCopiedId(snapshotId);
      window.setTimeout(() => {
        setSnapshotCopiedId((current) => (current === snapshotId ? null : current));
      }, 1500);
    } catch {
      setSnapshotsError("Failed to copy snapshot link.");
    }
  };

  const handleResetDone = () => {
    setResetModalOpen(false);
    setResetNotice("System reset complete. Start a new baseline with a check-in.");
    router.refresh();
  };

  const handleAccountDeleted = async () => {
    setDeleteModalOpen(false);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Control Room</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Back to Control Room
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Account</h2>
            <p className="mt-3 text-sm text-zinc-300">
              Authentication: <span className="text-zinc-100">{providerLabel}</span>
            </p>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="mt-4 min-h-10 rounded-md border border-rose-700/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-500/70"
            >
              Delete Account
            </button>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">License</h2>
            <div className="mt-3">
              <PlanBadge plan={plan} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/pricing"
                className="inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              >
                Capability Specification
              </Link>
              <Link
                href="/app/settings/billing"
                className="inline-flex min-h-10 items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
              >
                Billing
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Data Controls</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
              >
                Export System Log
              </button>
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="min-h-10 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400/60"
              >
                Reset System
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Reset restarts baseline calibration.</p>
            {resetNotice ? <p className="mt-2 text-xs text-emerald-300/90">{resetNotice}</p> : null}
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Documents</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link href="/privacy" className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:border-zinc-500">
                Privacy
              </Link>
              <Link href="/terms" className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:border-zinc-500">
                Terms
              </Link>
              <Link href="/status" className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:border-zinc-500">
                Status
              </Link>
            </div>
          </section>
        </div>

        {isAdmin ? (
          <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Admin</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link
                href="/app/admin/health"
                className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-100 transition hover:border-cyan-400/60"
              >
                Internal Health Console
              </Link>
            </div>
          </section>
        ) : null}

        {snapshotsEnabled ? (
          <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Snapshots</h2>
                <p className="mt-1 text-xs text-zinc-500">Read-only public state links without personal data.</p>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateSnapshot()}
                className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
              >
                Generate Snapshot Link
              </button>
            </div>
            {snapshotNotice ? <p className="mt-2 text-[11px] text-emerald-300/90">{snapshotNotice}</p> : null}
            {snapshotsError ? <p className="mt-2 text-[11px] text-rose-300/90">{snapshotsError}</p> : null}
            {snapshotsLoading ? (
              <p className="mt-2 text-[11px] text-zinc-500">Loading...</p>
            ) : snapshots.length === 0 ? (
              <p className="mt-2 text-[11px] text-zinc-500">No snapshots yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <ul className="min-w-[620px] space-y-1.5 text-xs text-zinc-300">
                  {snapshots.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"
                    >
                      <div className="text-zinc-400">
                        <p>{new Date(row.createdAt).toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-500">Expires: {new Date(row.expiresAt).toLocaleString()}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          row.revokedAt
                            ? "border-zinc-700 text-zinc-400"
                            : new Date(row.expiresAt).getTime() <= Date.now()
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {row.revokedAt ? "Revoked" : new Date(row.expiresAt).getTime() <= Date.now() ? "Expired" : "Active"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopySnapshotLink(row.token, row.id)}
                          className="min-h-9 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-500"
                          disabled={Boolean(row.revokedAt) || new Date(row.expiresAt).getTime() <= Date.now()}
                        >
                          {snapshotCopiedId === row.id ? "Copied" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRevokeSnapshot(row.id)}
                          className="min-h-9 rounded border border-rose-700/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-200 hover:border-rose-500/70 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={Boolean(row.revokedAt)}
                        >
                          Revoke
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}
      </main>

      <ExportSystemLogModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <SystemResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} onDone={handleResetDone} />
      <DeleteAccountModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDone={handleAccountDeleted} />
    </>
  );
}
