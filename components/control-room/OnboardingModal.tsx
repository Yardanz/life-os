"use client";

import { ModalShell } from "@/components/ui/ModalShell";

type OnboardingModalProps = {
  open: boolean;
  step: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onStartCheckin: () => void;
};

type StepContent = {
  title: string;
  subtitle: string;
  bullets: string[];
};

const STEPS: StepContent[] = [
  {
    title: "Onboarding / Control Room",
    subtitle: "Initialize the operating loop in three quick steps.",
    bullets: [
      "Record one daily check-in.",
      "Compute risk, recovery, and load baseline.",
      "Enable forward envelope and guardrails.",
    ],
  },
  {
    title: "Signal Capture",
    subtitle: "The system uses measurable inputs only.",
    bullets: [
      "Sleep and stress drive recovery dynamics.",
      "Deep work and workout affect load pressure.",
      "State transitions remain deterministic.",
    ],
  },
  {
    title: "Calibration Mode",
    subtitle: "Early phase runs with reduced confidence until enough check-ins accumulate.",
    bullets: [
      "Target: 7+ check-ins for stable baseline.",
      "Guardrails remain active during calibration.",
      "You can start with today's check-in now.",
    ],
  },
];

export function OnboardingModal({
  open,
  step,
  totalSteps,
  onNext,
  onBack,
  onClose,
  onStartCheckin,
}: OnboardingModalProps) {
  const current = STEPS[Math.max(0, Math.min(step, STEPS.length - 1))];
  const isLast = step >= totalSteps - 1;

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Control Room onboarding" panelClassName="max-w-xl p-5 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Step {Math.min(step + 1, totalSteps)} / {totalSteps}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">{current.title}</h2>
            <p className="mt-2 text-sm text-zinc-300">{current.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
          >
            Close
          </button>
        </div>

        <ul className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-300">
          {current.bullets.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Back
            </button>
          ) : null}
          {!isLast ? (
            <button
              type="button"
              onClick={onNext}
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
            >
              Next
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartCheckin}
                className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
              >
                Create check-in
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              >
                Open Control Room
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
