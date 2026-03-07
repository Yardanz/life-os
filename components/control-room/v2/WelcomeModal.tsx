"use client";

import { ModalShell } from "@/components/ui/ModalShell";

type WelcomeModalProps = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onBeginCheckin: () => void;
  onContinue: () => void;
};

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function WelcomeModal({ open, saving, error, onBeginCheckin, onContinue }: WelcomeModalProps) {
  return (
    <ModalShell open={open} onClose={onContinue} ariaLabel="Welcome to LIFE OS" panelClassName="max-w-3xl p-5 sm:p-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System orientation</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">Welcome to LIFE OS</h2>
        </div>

        <Section
          title="Purpose"
          lines={[
            "LIFE OS is a system stability console, not a productivity app.",
            "Its purpose is to reduce overload risk and maintain sustainable operating capacity.",
          ]}
        />

        <Section
          title="Check-in guidance"
          lines={[
            "Record daily operational signals through check-ins.",
            "Each check-in updates current system state and improves model calibration.",
          ]}
        />

        <Section
          title="How progression works"
          lines={[
            "The first days are calibration phase.",
            "As baseline stabilizes, deeper capabilities become available.",
          ]}
        />

        <Section
          title="What to expect"
          lines={["Life Score", "Guardrail state", "Trajectory", "Diagnostics", "Protocol and system guidance"]}
        />

        {error ? <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBeginCheckin}
            disabled={saving}
            className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Begin check-in"}
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={saving}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to Control Room
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
