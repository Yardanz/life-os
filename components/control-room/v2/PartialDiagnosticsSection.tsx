"use client";

import Link from "next/link";
import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type PartialDiagnosticsSectionProps = {
  plan: "FREE" | "PRO";
  antiChaosEnabled: boolean;
  antiChaosActionEnabled?: boolean;
  onOpenAntiChaosAction?: () => void;
  recovery: number;
  load: number;
  risk: number;
  driftState: "STABLE" | "DRIFT" | "STRAIN";
  driftScore: number;
  calibrationActive: boolean;
  calibrationConfidence: number;
};

type Card = {
  id: "anti_chaos" | "recovery" | "load" | "risk" | "drift" | "calibration";
  title: string;
  value: string;
  subtitle: string;
  locked: boolean;
};

type DetailCopy = {
  unlockedTitle: string;
  unlockedText: string;
  lockedTitle: string;
  lockedText: string;
};

const CARD_DETAILS: Record<Card["id"], DetailCopy> = {
  anti_chaos: {
    unlockedTitle: "Protocol stabilization layer active",
    unlockedText:
      "Anti-Chaos is the protocol stabilization layer. It helps contain instability and reduce the chance of cascading system degradation under strain.",
    lockedTitle: "Plan-restricted diagnostics layer",
    lockedText:
      "Anti-Chaos belongs to deeper operator-depth diagnostics. This account can see that the layer exists, but full interaction is restricted on the current plan.",
  },
  recovery: {
    unlockedTitle: "Recovery capacity signal",
    unlockedText:
      "Recovery Capacity represents current restorative capacity and how much strain the system can absorb before degradation risk rises.",
    lockedTitle: "Recovery capacity access limited",
    lockedText: "Recovery Capacity indicates restorative headroom. Detailed access is currently limited by system depth.",
  },
  load: {
    unlockedTitle: "Load pressure signal",
    unlockedText: "Load Pressure represents current operational demand being applied to the system.",
    lockedTitle: "Load pressure access limited",
    lockedText: "Load Pressure indicates active demand on the system. Detailed access is restricted on this account.",
  },
  risk: {
    unlockedTitle: "Risk probability signal",
    unlockedText: "Risk Probability reflects the estimated overload and instability risk under current conditions.",
    lockedTitle: "Risk probability restricted",
    lockedText: "Risk Probability belongs to deeper operator diagnostics and is currently restricted by plan depth.",
  },
  drift: {
    unlockedTitle: "System drift signal",
    unlockedText: "System Drift reflects integrity deviation from stable operating patterns.",
    lockedTitle: "System drift restricted",
    lockedText: "System Drift belongs to deeper operator diagnostics and is currently restricted by plan depth.",
  },
  calibration: {
    unlockedTitle: "Calibration status signal",
    unlockedText: "Calibration Status reflects model readiness, calibration progress, and confidence maturity.",
    lockedTitle: "Calibration status restricted",
    lockedText: "Calibration Status indicates model readiness and confidence maturity. Detailed depth is currently restricted.",
  },
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function riskLabel(risk: number): string {
  if (risk >= 70) return "High risk";
  if (risk >= 45) return "Moderate risk";
  return "Contained risk";
}

function driftLabel(state: "STABLE" | "DRIFT" | "STRAIN"): string {
  if (state === "STRAIN") return "Elevated strain";
  if (state === "DRIFT") return "Drift detected";
  return "Stable";
}

function lockOverlay(show: boolean, message = "Locked") {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border border-amber-500/30 bg-zinc-950/70 backdrop-blur-[1px]">
      <p className="text-xs uppercase tracking-[0.12em] text-amber-200">{message}</p>
    </div>
  );
}

export function PartialDiagnosticsSection({
  plan,
  antiChaosEnabled,
  antiChaosActionEnabled = false,
  onOpenAntiChaosAction,
  recovery,
  load,
  risk,
  driftState,
  driftScore,
  calibrationActive,
  calibrationConfidence,
}: PartialDiagnosticsSectionProps) {
  const isPro = plan === "PRO";
  const antiChaosLocked = !antiChaosEnabled;
  const [selectedCardId, setSelectedCardId] = useState<Card["id"] | null>(null);

  const cards: Card[] = [
    {
      id: "anti_chaos",
      title: "Anti-Chaos system",
      value: antiChaosEnabled ? "Available" : "Restricted",
      subtitle: antiChaosEnabled ? "Protocol stabilization layer is active." : "Protocol stabilization layer is plan-restricted.",
      locked: antiChaosLocked,
    },
    {
      id: "recovery",
      title: "Recovery capacity",
      value: `${clampPercent(recovery).toFixed(1)}%`,
      subtitle: "Current restorative capacity.",
      locked: false,
    },
    {
      id: "load",
      title: "Load pressure",
      value: `${clampPercent(load).toFixed(1)}%`,
      subtitle: "Operational demand currently applied.",
      locked: false,
    },
    {
      id: "risk",
      title: "Risk probability",
      value: `${clampPercent(risk).toFixed(1)}%`,
      subtitle: riskLabel(risk),
      locked: !isPro,
    },
    {
      id: "drift",
      title: "System drift",
      value: `${driftLabel(driftState)} (${Math.round(clampPercent(driftScore))}%)`,
      subtitle: "Integrity and drift status.",
      locked: !isPro,
    },
    {
      id: "calibration",
      title: "Calibration status",
      value: `${calibrationActive ? "Calibrating" : "Stable"} (${Math.round(clampPercent(calibrationConfidence * 100))}%)`,
      subtitle: "Model confidence readiness.",
      locked: false,
    },
  ];

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null;

  return (
    <>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Diagnostics</p>
        <p className="mt-2 text-sm text-zinc-300">Partial diagnostic layer unlocked from current system state.</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCardId(card.id)}
              className="relative min-h-[132px] rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-left transition hover:border-cyan-500/40"
            >
              {lockOverlay(card.locked)}
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{card.title}</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{card.value}</p>
              <p className="mt-2 text-xs text-zinc-400">{card.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <ModalShell
        open={selectedCard !== null}
        onClose={() => setSelectedCardId(null)}
        ariaLabel="Diagnostic explanation"
        panelClassName="max-w-xl p-5"
      >
        {({ requestClose }) => (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{selectedCard?.title ?? "Diagnostics"}</p>
                <h3 className="mt-1 text-base font-semibold text-zinc-100">
                  {selectedCard
                    ? selectedCard.locked
                      ? CARD_DETAILS[selectedCard.id].lockedTitle
                      : CARD_DETAILS[selectedCard.id].unlockedTitle
                    : "System diagnostics"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>

            {selectedCard ? (
              <p className="text-sm text-zinc-300">
                {selectedCard.locked ? CARD_DETAILS[selectedCard.id].lockedText : CARD_DETAILS[selectedCard.id].unlockedText}
              </p>
            ) : null}

            {selectedCard?.locked && !isPro ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-400">This layer is available on Operator License.</p>
                <Link
                  href="/pricing"
                  className="mt-2 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)] transition duration-200 hover:border-cyan-300 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  Get Operator License
                </Link>
              </div>
            ) : null}

            {selectedCard?.id === "anti_chaos" ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-400">Anti-Chaos action</p>
                <button
                  type="button"
                  disabled={!antiChaosActionEnabled}
                  onClick={() => {
                    if (!antiChaosActionEnabled) return;
                    onOpenAntiChaosAction?.();
                    requestClose();
                  }}
                  className="mt-2 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
                >
                  Open Anti-Chaos controls
                </button>
              </div>
            ) : null}
          </div>
        )}
      </ModalShell>
    </>
  );
}
