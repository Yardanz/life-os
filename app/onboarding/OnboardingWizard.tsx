"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OnboardingWizardProps = {
  userEmail: string | null;
};

type OnboardingStep = {
  title: string;
  subtitle: string;
  bullets: string[];
};

const STEPS: OnboardingStep[] = [
  {
    title: "What is measured",
    subtitle: "Deterministic signal set: Load, Recovery, Risk.",
    bullets: [
      "Load = current system pressure.",
      "Recovery = restoration capacity.",
      "Risk = near-term overload probability.",
    ],
  },
  {
    title: "What the system does",
    subtitle: "Guardrails apply operational constraints.",
    bullets: [
      "State model: OPEN -> CAUTION -> LOCKDOWN.",
      "Transitions are threshold-driven.",
      "Constraints override intention when risk rises.",
    ],
  },
  {
    title: "What the system needs",
    subtitle: "Commissioning required before stable projections.",
    bullets: [
      "Collect 7 check-ins to stabilize baseline.",
      "Daily check-in target: 60 seconds.",
      "Model confidence is limited until baseline stabilizes.",
    ],
  },
];

export function OnboardingWizard({ userEmail }: OnboardingWizardProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const total = STEPS.length;
  const isLast = stepIndex === total - 1;

  const progressPct = useMemo(() => Math.round(((stepIndex + 1) / total) * 100), [stepIndex, total]);

  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/setup/complete-onboarding", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to complete onboarding.");
      }
      router.push("/app");
      router.refresh();
    } catch (finishError) {
      const message = finishError instanceof Error ? finishError.message : "Failed to complete onboarding.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 text-zinc-100 sm:px-6">
      <section className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Commissioning</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100 sm:text-3xl">System Commissioning</h1>
            <p className="mt-2 text-sm text-zinc-400">{userEmail ?? "Authenticated user"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Step {stepIndex + 1}/{total}
            </p>
            <p className="mt-1 text-xs text-cyan-200">{progressPct}%</p>
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-cyan-400/80 transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-zinc-100">{step.title}</h2>
          <p className="mt-2 text-sm text-zinc-300">{step.subtitle}</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {step.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={stepIndex === 0 || isSubmitting}
            onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
            className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Back
          </button>

          {!isLast ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStepIndex((value) => Math.min(total - 1, value + 1))}
              className="min-h-10 w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleFinish()}
              className="min-h-10 w-full rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? "Finishing..." : "Finish"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
