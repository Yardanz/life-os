"use client";

type CalibrationStage = "BOOTSTRAP" | "LEARNING" | "STABILIZING";

type CalibrationModePanelProps = {
  stage: CalibrationStage;
  confidencePct: number;
  checkins7d: number;
};

const STAGE_TEXT: Record<CalibrationStage, { label: string; detail: string }> = {
  BOOTSTRAP: {
    label: "Bootstrap",
    detail: "Model is initializing from sparse input history.",
  },
  LEARNING: {
    label: "Learning",
    detail: "Calibration is active; confidence is still building.",
  },
  STABILIZING: {
    label: "Stabilizing",
    detail: "Signals are converging toward baseline stability.",
  },
};

export function CalibrationModePanel({ stage, confidencePct, checkins7d }: CalibrationModePanelProps) {
  const stageContent = STAGE_TEXT[stage];

  return (
    <section className="mt-3 rounded-lg border border-cyan-400/25 bg-cyan-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Calibration Mode</p>
        <span className="rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100">
          {stageContent.label}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-300">{stageContent.detail}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Confidence {confidencePct}% • Recent check-ins {checkins7d}/7
      </p>
    </section>
  );
}
