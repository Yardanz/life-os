"use client";

import { useMemo } from "react";
import { t, type Locale } from "@/lib/i18n";

type ScenarioRow = {
  id: string;
  createdAt: string;
  baseDateISO: string;
  source: string;
  projectionResult: {
    lifeScore30: number;
    risk30: number;
    burnout30: number;
    volatility: number;
  };
  patternContext: {
    systemMode: string;
    topPattern: string | null;
  };
  calibrationConfidence: number;
};

type ScenarioLibraryPanelProps = {
  locale: Locale;
  isPro: boolean;
  loading: boolean;
  rows: ScenarioRow[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onRefresh: () => void;
};

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function metricTone(delta: number, inverse = false): string {
  const adjusted = inverse ? -delta : delta;
  if (adjusted > 0) return "text-emerald-300";
  if (adjusted < 0) return "text-rose-300";
  return "text-zinc-300";
}

export function ScenarioLibraryPanel({
  locale,
  isPro,
  loading,
  rows,
  selectedIds,
  onToggleSelect,
  onRefresh,
}: ScenarioLibraryPanelProps) {
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)).slice(0, 3),
    [rows, selectedIds]
  );
  const base = selectedRows[0] ?? null;

  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-200">{t("scenarioLibrary", locale)}</h4>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500"
        >
          {t("refresh", locale)}
        </button>
      </div>

      {!isPro ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
          {t("scenarioProOnly", locale)}
        </div>
      ) : null}

      {isPro ? (
        <>
          <div className="max-h-52 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/70">
            {loading ? (
              <div className="px-3 py-2 text-xs text-zinc-500">{t("loadingScenarios", locale)}</div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">{t("noSavedScenarios", locale)}</div>
            ) : (
              rows.map((row) => {
                const checked = selectedIds.includes(row.id);
                const disabled = !checked && selectedIds.length >= 3;
                return (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggleSelect(row.id)}
                        className="h-3.5 w-3.5 accent-zinc-200"
                      />
                      <span className="text-zinc-200">{row.source}</span>
                      <span className="text-zinc-500">{new Date(row.createdAt).toISOString().slice(0, 10)}</span>
                      <span className="text-zinc-500">{row.baseDateISO}</span>
                    </span>
                    <span className="text-zinc-300">
                      LS {row.projectionResult.lifeScore30.toFixed(1)} | R {row.projectionResult.risk30.toFixed(1)} |
                      B {row.projectionResult.burnout30.toFixed(1)} | {row.patternContext.systemMode}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {selectedRows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-900/70">
              <table className="min-w-full text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("scenario", locale)}</th>
                    <th className="px-3 py-2 text-left">{t("lifeScore30Delta", locale)}</th>
                    <th className="px-3 py-2 text-left">{t("risk30Delta", locale)}</th>
                    <th className="px-3 py-2 text-left">{t("burnout30Delta", locale)}</th>
                    <th className="px-3 py-2 text-left">{t("volatilityDelta", locale)}</th>
                    <th className="px-3 py-2 text-left">{t("systemMode", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row) => {
                    const lsDelta = base ? row.projectionResult.lifeScore30 - base.projectionResult.lifeScore30 : 0;
                    const riskDelta = base ? row.projectionResult.risk30 - base.projectionResult.risk30 : 0;
                    const burnoutDelta = base ? row.projectionResult.burnout30 - base.projectionResult.burnout30 : 0;
                    const volDelta = base ? row.projectionResult.volatility - base.projectionResult.volatility : 0;
                    return (
                      <tr key={row.id} className="border-b border-zinc-800 text-zinc-200 last:border-b-0">
                        <td className="px-3 py-2">{row.source}</td>
                        <td className={`px-3 py-2 ${metricTone(lsDelta)}`}>
                          {row.projectionResult.lifeScore30.toFixed(1)} ({signed(lsDelta)})
                        </td>
                        <td className={`px-3 py-2 ${metricTone(riskDelta, true)}`}>
                          {row.projectionResult.risk30.toFixed(1)} ({signed(riskDelta)})
                        </td>
                        <td className={`px-3 py-2 ${metricTone(burnoutDelta, true)}`}>
                          {row.projectionResult.burnout30.toFixed(1)} ({signed(burnoutDelta)})
                        </td>
                        <td className={`px-3 py-2 ${metricTone(volDelta, true)}`}>
                          {row.projectionResult.volatility.toFixed(1)} ({signed(volDelta)})
                        </td>
                        <td className="px-3 py-2">{row.patternContext.systemMode}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
