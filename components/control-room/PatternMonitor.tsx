"use client";

import type { ControlRoomPatterns, PatternType } from "@/lib/control-room/types";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type PatternMonitorProps = {
  patterns: ControlRoomPatterns;
  locale: Locale;
  onDetails: () => void;
};

const PATTERN_LABELS: Record<PatternType, string> = {
  cyclical_stress_load: "Cyclical stress load",
  sleep_irregularity: "Sleep irregularity",
  burnout_acceleration: "Burnout acceleration",
  autonomic_drift: "Autonomic drift",
  circadian_drift: "Circadian drift",
};

function severityTone(severity: number): string {
  if (severity >= 3) return "text-rose-200 border-rose-500/40 bg-rose-500/10";
  if (severity >= 2) return "text-amber-200 border-amber-500/40 bg-amber-500/10";
  if (severity >= 1) return "text-cyan-200 border-cyan-500/40 bg-cyan-500/10";
  return "text-zinc-300 border-zinc-700 bg-zinc-900";
}

export function PatternMonitor({ patterns, locale, onDetails }: PatternMonitorProps) {
  const modeName =
    patterns.systemMode === "stable"
      ? t("modeStableWord", locale)
      : patterns.systemMode === "overload"
        ? t("modeOverload", locale)
        : patterns.systemMode === "drift"
          ? t("modeDrift", locale)
          : t("modeCycle", locale);
  const modeText = `${t("modePrefix", locale)}: ${modeName}`;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{t("patternMonitor", locale)}</p>
          <p className="mt-1 text-sm text-zinc-100">
            {modeText} ({Math.round(patterns.systemModeConfidence * 100)}%)
          </p>
        </div>
        <button
          type="button"
          onClick={onDetails}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
        >
          {t("details", locale)}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {patterns.topPatterns.length > 0 ? (
          patterns.topPatterns.map((signal) => (
            <div
              key={signal.type}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2"
            >
              <span className="text-xs text-zinc-300">{PATTERN_LABELS[signal.type]}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${severityTone(signal.severity)}`}>S{signal.severity}</span>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-xs text-zinc-400">
            {t("noDominantPattern", locale)}
          </div>
        )}
      </div>
    </section>
  );
}
