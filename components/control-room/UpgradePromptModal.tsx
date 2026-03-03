"use client";

import { useRouter } from "next/navigation";
import { ModalShell } from "@/components/ui/ModalShell";
import { t, type Locale } from "@/lib/i18n";

type UpgradePromptModalProps = {
  open: boolean;
  capability: string | null;
  onClose: () => void;
  locale: Locale;
};

export function UpgradePromptModal({ open, capability, onClose, locale }: UpgradePromptModalProps) {
  const router = useRouter();

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Operator license modal" panelClassName="max-w-[420px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-100">Operator License Required</h3>
              <p className="mt-1 text-xs text-zinc-400">This capability extends the control system:</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
            Trigger: <span className="text-zinc-100">{capability ?? "Operator capability"}</span>
          </div>

          <ul className="space-y-1 text-xs text-zinc-300">
            <li>- Forward simulation</li>
            <li>- Scenario comparison</li>
            <li>- Anti-chaos tightening</li>
            <li>- Extended protocol horizons</li>
          </ul>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                requestClose(() => {
                  router.push("/pricing");
                })
              }
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-300"
            >
              {t("ctaViewCapabilitySpec", locale)}
            </button>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Return
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
