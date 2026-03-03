"use client";

import Link from "next/link";
import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
import { t, type Locale } from "@/lib/i18n";

type AntiChaosPanelProps = {
  locale: Locale;
  isPro: boolean;
  horizonHours: 24 | 48 | 72;
  onHorizonChange: (hours: 24 | 48 | 72) => void;
  onGenerate: () => void;
  onUpgradePrompt?: (capability: string) => void;
  loading: boolean;
  protocol: AntiChaosProtocol | null;
  error: string | null;
};

function deltaClass(value: number, inverse = false): string {
  const normalized = inverse ? -value : value;
  if (normalized > 0.01) return "text-emerald-200";
  if (normalized < -0.01) return "text-rose-200";
  return "text-zinc-300";
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function AntiChaosPanel({
  locale,
  isPro,
  horizonHours,
  onHorizonChange,
  onGenerate,
  onUpgradePrompt,
  loading,
  protocol,
  error,
}: AntiChaosPanelProps) {
  return (
    <section className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-900/70 p-0.5 text-[11px]">
          {[24, 48, 72].map((hours) => (
            <button
              key={hours}
              type="button"
              title={!isPro ? "Extension layer: forward simulation & scenarios" : undefined}
              onClick={() => {
                if (!isPro) {
                  onUpgradePrompt?.(`${hours}h Anti-Chaos horizon`);
                  return;
                }
                onHorizonChange(hours as 24 | 48 | 72);
              }}
              className={`rounded px-2 py-1 transition ${
                horizonHours === hours ? "bg-zinc-700/70 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {hours}h {!isPro && hours > 24 ? "Operator capability" : ""}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!isPro) {
              onUpgradePrompt?.("Anti-Chaos tighten");
              return;
            }
            onGenerate();
          }}
          disabled={loading}
          title={!isPro ? "Extension layer: forward simulation & scenarios" : undefined}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("processing", locale) : t("generateProtocol", locale)}
        </button>
      </div>

      {!isPro ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <p>
            {t("antiChaosProtocol", locale)}{" "}
            <span className="rounded border border-amber-500/40 px-1 text-amber-200">Operator capability</span>
          </p>
          <Link
            href="/pricing"
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200 hover:border-amber-400"
          >
            Pay for Operator License
          </Link>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}

      {protocol ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1 font-mono text-[11px] tabular-nums text-zinc-200">
            {t("delta", locale)} {protocol.horizonHours}h:
            <span className={`ml-2 ${deltaClass(protocol.impact.deltas.risk, true)}`}>
              {t("risk", locale)} {formatSigned(protocol.impact.deltas.risk)}
            </span>
            {" | "}
            <span className={deltaClass(protocol.impact.deltas.lifeScore)}>
              {t("lifeScore", locale)} {formatSigned(protocol.impact.deltas.lifeScore)}
            </span>
            {" | "}
            <span className={deltaClass(protocol.impact.deltas.burnout, true)}>
              {t("burnout", locale)} {formatSigned(protocol.impact.deltas.burnout)}
            </span>
          </p>
          <ul className="space-y-1 text-[11px] text-zinc-300">
            <li>{t("sleep", locale)}: +{protocol.actions.sleepDeltaMin}m</li>
            <li>{t("deepWorkCap", locale)}: {protocol.actions.deepWorkCapMin === 0 ? t("none", locale) : `${protocol.actions.deepWorkCapMin}m`}</li>
            <li>{t("training", locale)}: {protocol.actions.trainingMode}</li>
            <li>{t("stressAdjustment", locale)}: {protocol.actions.stressDelta}</li>
            {protocol.actions.wakeAnchorShiftMin !== 0 ? (
              <li>{t("wakeAnchorShift", locale)}: {protocol.actions.wakeAnchorShiftMin}m</li>
            ) : null}
          </ul>
          <p className="text-[11px] text-zinc-400">
            {protocol.why.primaryDriver}
            {protocol.why.secondaryDriver ? ` | ${protocol.why.secondaryDriver}` : ""}
          </p>
          <p className="text-[11px] text-zinc-500">{protocol.why.summary}</p>
        </div>
      ) : null}
    </section>
  );
}
