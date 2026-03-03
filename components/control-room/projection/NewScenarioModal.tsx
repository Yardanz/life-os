"use client";

import { useState } from "react";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { ModalShell } from "@/components/ui/ModalShell";

export type ScenarioPreset = "BASELINE" | "HIGH_LOAD" | "STABILIZE";

export type NewScenarioPayload = {
  name: string;
  preset: ScenarioPreset;
  sleepMinutesDelta: number;
  deepWorkPctDelta: number;
};

type NewScenarioModalProps = {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  errorId?: string | null;
  onClose: () => void;
  onSave: (payload: NewScenarioPayload) => void;
};

function presetDefaults(preset: ScenarioPreset): { sleepMinutesDelta: number; deepWorkPctDelta: number } {
  if (preset === "HIGH_LOAD") {
    return { sleepMinutesDelta: -30, deepWorkPctDelta: 20 };
  }
  if (preset === "STABILIZE") {
    return { sleepMinutesDelta: 60, deepWorkPctDelta: -25 };
  }
  return { sleepMinutesDelta: 0, deepWorkPctDelta: 0 };
}

function presetLabel(preset: ScenarioPreset): string {
  if (preset === "HIGH_LOAD") return "High load";
  if (preset === "STABILIZE") return "Stabilize (tightened)";
  return "Baseline";
}

export function NewScenarioModal({
  open,
  saving = false,
  error = null,
  errorId = null,
  onClose,
  onSave,
}: NewScenarioModalProps) {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<ScenarioPreset>("BASELINE");
  const [sleepMinutesDelta, setSleepMinutesDelta] = useState(0);
  const [deepWorkPctDelta, setDeepWorkPctDelta] = useState(0);

  const canSave = name.trim().length > 0 && !saving;

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="New scenario modal" panelClassName="max-w-[460px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-100">New scenario</h3>
              <p className="mt-1 text-xs text-zinc-400">Create Scenario B with preset + planned adjustments.</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Scenario B"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Mode preset</span>
            <select
              value={preset}
              onChange={(event) => {
                const nextPreset = event.target.value as ScenarioPreset;
                const defaults = presetDefaults(nextPreset);
                setPreset(nextPreset);
                setSleepMinutesDelta(defaults.sleepMinutesDelta);
                setDeepWorkPctDelta(defaults.deepWorkPctDelta);
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50"
            >
              {(["BASELINE", "HIGH_LOAD", "STABILIZE"] as const).map((value) => (
                <option key={value} value={value}>
                  {presetLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Optional sliders</p>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Planned Sleep ({sleepMinutesDelta >= 0 ? "+" : ""}{sleepMinutesDelta}m)</span>
              <input
                type="range"
                min={-60}
                max={120}
                step={15}
                value={sleepMinutesDelta}
                onChange={(event) => setSleepMinutesDelta(Number(event.target.value))}
                className="w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">
                Planned Deep Work ({deepWorkPctDelta >= 0 ? "+" : ""}
                {deepWorkPctDelta}%)
              </span>
              <input
                type="range"
                min={-50}
                max={30}
                step={5}
                value={deepWorkPctDelta}
                onChange={(event) => setDeepWorkPctDelta(Number(event.target.value))}
                className="w-full"
              />
            </label>
          </div>

          {error ? (
            errorId ? (
              <ErrorIdNotice message={error} errorId={errorId} />
            ) : (
              <p className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{error}</p>
            )
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => requestClose()}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                onSave({
                  name: name.trim(),
                  preset,
                  sleepMinutesDelta,
                  deepWorkPctDelta: deepWorkPctDelta / 100,
                })
              }
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
