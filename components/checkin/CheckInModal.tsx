"use client";

import { DailyCheckinForm } from "@/components/checkin/DailyCheckinForm";
import { ModalShell } from "@/components/ui/ModalShell";

type CheckInModalProps = {
  open: boolean;
  dateISO: string;
  baselineLifeScore?: number | null;
  activeProtocol?: {
    state: "OPEN" | "CAUTION" | "LOCKDOWN";
    horizonHours: number;
    constraints: Array<{ label: string; value: string; severity: "hard" | "soft" }>;
  } | null;
  onClose: () => void;
  onSaved: () => void;
};

export function CheckInModal({
  open,
  dateISO,
  baselineLifeScore = null,
  activeProtocol = null,
  onClose,
  onSaved,
}: CheckInModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Daily Check-In modal" panelClassName="max-w-3xl p-0">
      {({ requestClose }) => (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Daily Check-In</p>
              <p className="mt-1 truncate text-xs text-zinc-400">{dateISO}</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            <DailyCheckinForm
              initialDateISO={dateISO}
              baselineLifeScore={baselineLifeScore}
              activeProtocol={activeProtocol}
              onSuccess={() => requestClose(onSaved)}
            />
          </div>
        </div>
      )}
    </ModalShell>
  );
}
