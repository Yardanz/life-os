"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PresetNumberField } from "@/components/checkin/PresetNumberField";
import { WorkoutToggle } from "@/components/checkin/WorkoutToggle";
import { CHECKIN_LIMITS, normalizeCheckinCore, normalizeFloat, normalizeInteger, normalizeMoney } from "@/lib/checkinLimits";
import { addDaysISO, getLocalISODate, parseISODateParam } from "@/lib/date/localDate";
import { deriveWakeFromBedtime, minutesToTimeInput, timeInputToMinutes } from "@/lib/date/timeMinutes";

type CheckinFormState = {
  sleepHours: number;
  sleepQuality: number;
  bedtimeMinutes: number;
  wakeTimeMinutes: number;
  workout: boolean;
  deepWorkMin: number;
  learningMin: number;
  moneyDelta: string;
  stress: number;
};

const STORAGE_PREFIX = "lifeos.checkin";

function getDateKey(isoDate: string): string {
  return `${STORAGE_PREFIX}.${isoDate}`;
}

function createInitialState(): CheckinFormState {
  return {
    sleepHours: CHECKIN_LIMITS.sleepHours.defaultValue,
    sleepQuality: CHECKIN_LIMITS.sleepQuality.defaultValue,
    bedtimeMinutes: CHECKIN_LIMITS.bedtimeMinutes.defaultValue,
    wakeTimeMinutes: CHECKIN_LIMITS.wakeTimeMinutes.defaultValue,
    workout: false,
    deepWorkMin: CHECKIN_LIMITS.deepWorkMin.defaultValue,
    learningMin: CHECKIN_LIMITS.learningMin.defaultValue,
    moneyDelta: "0",
    stress: CHECKIN_LIMITS.stress.defaultValue,
  };
}

type DailyCheckinFormProps = {
  initialDateISO?: string;
  activeProtocol?: {
    state: "OPEN" | "CAUTION" | "LOCKDOWN";
    horizonHours: number;
    constraints: Array<{ label: string; value: string; severity: "hard" | "soft" }>;
  } | null;
  onSuccess?: () => void;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeProjectionSignals(input: CheckinFormState) {
  const sleep = clampNumber(input.sleepHours / 8, 0, 1);
  const sleepQuality = clampNumber(input.sleepQuality / 5, 0, 1);
  const workout = input.workout ? 1 : 0;
  const stressN = clampNumber((input.stress - 1) / 9, 0, 1);
  const deepWork = clampNumber(input.deepWorkMin / 240, 0, 1);
  const learning = clampNumber(input.learningMin / 180, 0, 1);
  const parsedMoney = Number(input.moneyDelta || 0);
  const safeMoney = Number.isFinite(parsedMoney) ? parsedMoney : 0;
  const money = clampNumber(safeMoney / 10000, -1, 1);

  const recovery = clampNumber((sleep * 0.45 + sleepQuality * 0.35 + workout * 0.2 - stressN * 0.2) * 100, 0, 100);
  const load = clampNumber((deepWork * 0.55 + learning * 0.3 + stressN * 0.35 + Math.max(0, money) * 0.1) * 100, 0, 100);
  const risk = clampNumber(load * 0.6 + (100 - recovery) * 0.5, 0, 100);
  const lifeScore = clampNumber(100 - risk * 0.45 + recovery * 0.4 - load * 0.2, 0, 100);

  return {
    recovery,
    load,
    risk,
    lifeScore,
  };
}

export function DailyCheckinForm({ initialDateISO, activeProtocol = null, onSuccess }: DailyCheckinFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = initialDateISO ?? parseISODateParam(searchParams.get("date")) ?? getLocalISODate();
  const initialFormRef = useRef<CheckinFormState>(createInitialState());
  const [form, setForm] = useState<CheckinFormState>(initialFormRef.current);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingScreen, setIsUpdatingScreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectionLimited, setProjectionLimited] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState<string>(String(initialFormRef.current.sleepHours));
  const [sleepQualityInput, setSleepQualityInput] = useState<string>(String(initialFormRef.current.sleepQuality));
  const [moneyAdjusted, setMoneyAdjusted] = useState(false);

  const canSubmit = useMemo(() => !isSubmitting && !isUpdatingScreen, [isSubmitting, isUpdatingScreen]);
  const hasChanges = useMemo(() => {
    const initial = initialFormRef.current;
    return (
      form.sleepHours !== initial.sleepHours ||
      form.sleepQuality !== initial.sleepQuality ||
      form.bedtimeMinutes !== initial.bedtimeMinutes ||
      form.wakeTimeMinutes !== initial.wakeTimeMinutes ||
      form.workout !== initial.workout ||
      form.deepWorkMin !== initial.deepWorkMin ||
      form.learningMin !== initial.learningMin ||
      form.moneyDelta !== initial.moneyDelta ||
      form.stress !== initial.stress
    );
  }, [form]);
  const canApply = canSubmit && hasChanges;

  const baseProjection = useMemo(() => computeProjectionSignals(initialFormRef.current), []);
  const projected = useMemo(() => computeProjectionSignals(form), [form]);
  const recoveryDelta = projected.recovery - baseProjection.recovery;
  const loadDelta = projected.load - baseProjection.load;
  const riskDelta = projected.risk - baseProjection.risk;
  const riskDirection = Math.abs(riskDelta) < 0.5 ? "stable" : riskDelta > 0 ? "up" : "down";
  const activeProtocolDeepWorkCap = useMemo(() => {
    if (!activeProtocol) return null;
    const deepWorkConstraint = activeProtocol.constraints.find((item) => item.label.toLowerCase().includes("deep work cap"));
    if (!deepWorkConstraint) return null;
    const numericParts = deepWorkConstraint.value.match(/\d+/g);
    if (!numericParts || numericParts.length === 0) return null;
    return Math.max(...numericParts.map((raw) => Number(raw)));
  }, [activeProtocol]);
  const activeProtocolLightTrainingOnly = useMemo(() => {
    if (!activeProtocol) return false;
    return activeProtocol.constraints.some(
      (item) => item.label.toLowerCase().includes("training") && item.value.toLowerCase().includes("light")
    );
  }, [activeProtocol]);
  const activeProtocolNoLateCaffeine = useMemo(() => {
    if (!activeProtocol) return false;
    return activeProtocol.constraints.some(
      (item) => item.label.toLowerCase().includes("late caffeine") || item.value.toLowerCase().includes("after 14:00")
    );
  }, [activeProtocol]);
  const exceedsDeepWorkCap = activeProtocolDeepWorkCap !== null && form.deepWorkMin > activeProtocolDeepWorkCap;
  const compliancePreview = useMemo(() => {
    const hardViolated = exceedsDeepWorkCap;
    const softViolated = !hardViolated && activeProtocolLightTrainingOnly && form.workout;
    if (hardViolated) {
      return { value: 100, label: "Hard constraint exceeded" };
    }
    if (softViolated) {
      return { value: 50, label: "Soft constraint exceeded" };
    }
    return { value: 0, label: "No constraint pressure" };
  }, [activeProtocolLightTrainingOnly, exceedsDeepWorkCap, form.workout]);

  const updateField = <K extends keyof CheckinFormState>(key: K, value: CheckinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applySleepHoursFromInput = (raw: string) => {
    const normalized = normalizeFloat(raw, CHECKIN_LIMITS.sleepHours);
    updateField("sleepHours", normalized.value);
    setSleepHoursInput(String(normalized.value));
    updateField("wakeTimeMinutes", deriveWakeFromBedtime(form.bedtimeMinutes, normalized.value));
  };

  const applySleepQualityFromInput = (raw: string) => {
    const normalized = normalizeInteger(raw, CHECKIN_LIMITS.sleepQuality);
    updateField("sleepQuality", normalized.value);
    setSleepQualityInput(String(normalized.value));
  };

  useEffect(() => {
    let cancelled = false;

    const loadSetupState = async () => {
      try {
        const response = await fetch("/api/setup/state", { cache: "no-store" });
        const payload = (await response.json()) as
          | { ok: true; data: { confidence: number } }
          | { ok: false; error?: string };
        if (cancelled) return;
        if (!response.ok || !payload.ok) {
          setProjectionLimited(true);
          return;
        }
        setProjectionLimited(payload.data.confidence < 0.6);
      } catch {
        if (!cancelled) setProjectionLimited(true);
      }
    };

    void loadSetupState();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyYesterday = () => {
    setError(null);
    try {
      const yesterdayKey = getDateKey(addDaysISO(selectedDate, -1));
      const raw = localStorage.getItem(yesterdayKey) ?? localStorage.getItem(`${STORAGE_PREFIX}.last`);
      if (!raw) {
        setError("No data from yesterday found.");
        return;
      }

      const parsed = JSON.parse(raw) as Partial<CheckinFormState>;
      const base = form;
      const next = {
        ...base,
        sleepHours: Number(parsed.sleepHours ?? base.sleepHours),
        sleepQuality: Number(parsed.sleepQuality ?? base.sleepQuality),
        bedtimeMinutes: Number(parsed.bedtimeMinutes ?? base.bedtimeMinutes),
        wakeTimeMinutes: Number(parsed.wakeTimeMinutes ?? base.wakeTimeMinutes),
        workout: Boolean(parsed.workout ?? base.workout),
        deepWorkMin: Number(parsed.deepWorkMin ?? base.deepWorkMin),
        learningMin: Number(parsed.learningMin ?? base.learningMin),
        moneyDelta: String(parsed.moneyDelta ?? base.moneyDelta),
        stress: Number(parsed.stress ?? base.stress),
      };
      const normalized = normalizeCheckinCore(next);
      setForm((prev) => ({
        ...prev,
        ...normalized.values,
        moneyDelta: String(normalized.values.moneyDelta),
      }));
      setSleepHoursInput(String(normalized.values.sleepHours));
      setSleepQualityInput(String(normalized.values.sleepQuality));
      setMoneyAdjusted(normalized.adjusted.moneyDelta);
    } catch {
      setError("Failed to load yesterday metrics.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const normalized = normalizeCheckinCore({
        sleepHours: sleepHoursInput === "" ? form.sleepHours : sleepHoursInput,
        sleepQuality: sleepQualityInput === "" ? form.sleepQuality : sleepQualityInput,
        bedtimeMinutes: form.bedtimeMinutes,
        wakeTimeMinutes: form.wakeTimeMinutes,
        workout: form.workout,
        deepWorkMin: form.deepWorkMin,
        learningMin: form.learningMin,
        moneyDelta: form.moneyDelta === "" || form.moneyDelta === "-" ? 0 : form.moneyDelta,
        stress: form.stress,
      });
      const sanitizedForm: CheckinFormState = {
        sleepHours: normalized.values.sleepHours,
        sleepQuality: normalized.values.sleepQuality,
        bedtimeMinutes: normalized.values.bedtimeMinutes,
        wakeTimeMinutes: normalized.values.wakeTimeMinutes,
        workout: normalized.values.workout,
        deepWorkMin: normalized.values.deepWorkMin,
        learningMin: normalized.values.learningMin,
        moneyDelta: String(normalized.values.moneyDelta),
        stress: normalized.values.stress,
      };
      setSleepHoursInput(String(sanitizedForm.sleepHours));
      setSleepQualityInput(String(sanitizedForm.sleepQuality));
      setMoneyAdjusted(normalized.adjusted.moneyDelta);
      setForm(sanitizedForm);

      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          tzOffsetMinutes: -new Date().getTimezoneOffset(),
          sleepHours: sanitizedForm.sleepHours,
          sleepQuality: sanitizedForm.sleepQuality,
          bedtimeMinutes: sanitizedForm.bedtimeMinutes,
          wakeTimeMinutes: sanitizedForm.wakeTimeMinutes,
          workout: sanitizedForm.workout ? 1 : 0,
          deepWorkMin: sanitizedForm.deepWorkMin,
          learningMin: sanitizedForm.learningMin,
          moneyDelta: normalized.values.moneyDelta,
          stress: sanitizedForm.stress,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(response.status === 400 ? "Invalid input." : payload.error ?? "Data unavailable.");
      }

      const snapshot = JSON.stringify(sanitizedForm);
      localStorage.setItem(getDateKey(selectedDate), snapshot);
      localStorage.setItem(`${STORAGE_PREFIX}.last`, snapshot);

      if (onSuccess) {
        onSuccess();
        return;
      }

      setIsUpdatingScreen(true);
      window.setTimeout(() => {
        router.push(`/app?date=${selectedDate}`);
      }, 850);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Request failed.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  if (isUpdatingScreen) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
        <h2 className="mt-4 text-lg font-medium text-zinc-100">System Update...</h2>
        <p className="mt-2 text-sm text-zinc-400">Recalculating daily state</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {activeProtocol ? (
        <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Active protocol: {activeProtocol.state} ({activeProtocol.horizonHours}h)
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Recovery Signals</p>
        </div>
        <div>
          <label htmlFor="bedtime" className="mb-1 block text-sm font-medium text-zinc-200">
            Bedtime
          </label>
          <input
            id="bedtime"
            data-autofocus
            type="time"
            value={minutesToTimeInput(form.bedtimeMinutes)}
            onChange={(event) => {
              const minutes = timeInputToMinutes(event.target.value);
              if (minutes === null) return;
              updateField("bedtimeMinutes", minutes);
              updateField("wakeTimeMinutes", deriveWakeFromBedtime(minutes, form.sleepHours));
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>

        <div>
          <label htmlFor="wakeTime" className="mb-1 block text-sm font-medium text-zinc-200">
            Wake time
          </label>
          <input
            id="wakeTime"
            type="time"
            value={minutesToTimeInput(form.wakeTimeMinutes)}
            onChange={(event) => {
              const minutes = timeInputToMinutes(event.target.value);
              if (minutes === null) return;
              updateField("wakeTimeMinutes", minutes);
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sleepHours" className="mb-1 block text-sm font-medium text-zinc-200">
            Sleep hours
          </label>
          <input
            id="sleepHours"
            type="number"
            min={CHECKIN_LIMITS.sleepHours.min}
            max={CHECKIN_LIMITS.sleepHours.max}
            step={CHECKIN_LIMITS.sleepHours.step}
            inputMode="numeric"
            value={sleepHoursInput}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "" || /^\d*([.,]\d*)?$/.test(raw)) {
                setSleepHoursInput(raw);
              }
            }}
            onBlur={(event) => {
              const raw = event.target.value.trim();
              if (raw === "") {
                setSleepHoursInput("");
                return;
              }
              applySleepHoursFromInput(raw);
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>

        <div>
          <label htmlFor="sleepQuality" className="mb-1 block text-sm font-medium text-zinc-200">
            Sleep quality (1-5)
          </label>
          <input
            id="sleepQuality"
            type="number"
            min={CHECKIN_LIMITS.sleepQuality.min}
            max={CHECKIN_LIMITS.sleepQuality.max}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={sleepQualityInput}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "" || /^\d+$/.test(raw)) {
                setSleepQualityInput(raw.replace(/^0+(?=\d)/, ""));
              }
            }}
            onBlur={(event) => {
              const raw = event.target.value.trim();
              if (raw === "") {
                setSleepQualityInput("");
                return;
              }
              applySleepQualityFromInput(raw);
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
      </div>

      <WorkoutToggle checked={form.workout} onChange={(next) => updateField("workout", next)} />
      {activeProtocolLightTrainingOnly ? (
        <p className="text-[11px] text-zinc-500">Light intensity only (protocol constraint)</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Load Signals</p>
        </div>
        <div className={exceedsDeepWorkCap ? "rounded-md border border-amber-400/40 bg-amber-500/5 p-2" : undefined}>
          <PresetNumberField
            id="deepWorkMin"
            label="Deep Work minutes"
            value={form.deepWorkMin}
            presets={[0, 30, 60, 90, 120]}
            min={0}
            max={CHECKIN_LIMITS.deepWorkMin.max}
            step={5}
            onChange={(value) => updateField("deepWorkMin", Math.max(0, value))}
          />
        </div>
        {activeProtocolDeepWorkCap !== null ? (
          <p className={`-mt-2 text-[11px] ${exceedsDeepWorkCap ? "text-amber-300" : "text-zinc-500"}`}>
            Protocol cap: {activeProtocolDeepWorkCap}m
          </p>
        ) : null}

        <PresetNumberField
          id="learningMin"
          label="Learning minutes"
          value={form.learningMin}
          presets={[0, 15, 30, 45, 60]}
          min={0}
          max={CHECKIN_LIMITS.learningMin.max}
          step={5}
          onChange={(value) => updateField("learningMin", Math.max(0, value))}
        />

        <div>
          <label htmlFor="moneyDelta" className="mb-1 block text-sm font-medium text-zinc-200">
            Money delta
          </label>
          <p className="mb-1 text-[11px] text-zinc-500">
            Net financial change today. Positive = gain, Negative = loss.
          </p>
          <input
            id="moneyDelta"
            type="number"
            min={CHECKIN_LIMITS.moneyDelta.min}
            max={CHECKIN_LIMITS.moneyDelta.max}
            step={1}
            inputMode="numeric"
            pattern="-?[0-9]*"
            value={form.moneyDelta}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "" || /^-?\d*$/.test(raw)) {
                updateField("moneyDelta", raw);
                setMoneyAdjusted(false);
              }
            }}
            onBlur={(event) => {
              const raw = event.target.value.trim();
              if (raw === "" || raw === "-") {
                updateField("moneyDelta", "");
                setMoneyAdjusted(false);
                return;
              }
              const normalized = normalizeMoney(raw);
              updateField("moneyDelta", String(normalized.value));
              setMoneyAdjusted(normalized.adjusted);
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
          />
          {moneyAdjusted ? <p className="mt-1 text-[11px] text-zinc-500">Adjusted to allowed range.</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="stress" className="mb-1 block text-sm font-medium text-zinc-200">
          Stress: <span className="text-zinc-300">{form.stress}</span>
        </label>
        <input
          id="stress"
          type="range"
          min={1}
          max={10}
          step={1}
          value={form.stress}
          onChange={(event) => updateField("stress", Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-400"
        />
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">System Projection</p>
        {projectionLimited ? (
          <p className="mt-2 text-xs text-zinc-400">Projection limited - baseline not stabilized</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs text-zinc-300">
            <p>
              Recovery: {recoveryDelta >= 0 ? "+" : ""}
              {recoveryDelta.toFixed(1)}
            </p>
            <p>
              Load: {loadDelta >= 0 ? "+" : ""}
              {loadDelta.toFixed(1)}
            </p>
            <p>Risk: {riskDirection === "up" ? "up" : riskDirection === "down" ? "down" : "stable"}</p>
            <p>
              Life Score: {baseProjection.lifeScore.toFixed(1)} {"->"} {projected.lifeScore.toFixed(1)}
            </p>
          </div>
        )}
        <p className="mt-2 text-[11px] text-zinc-500">
          Preview based on current model state. No data saved until applied.
        </p>
      </section>

      {activeProtocol ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Active constraints</p>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-400">
            {activeProtocolDeepWorkCap !== null ? <li>Deep work cap: {activeProtocolDeepWorkCap}m</li> : null}
            {activeProtocolLightTrainingOnly ? <li>Training: light intensity only</li> : null}
            {activeProtocolNoLateCaffeine ? <li>No late caffeine: after 14:00 blocked</li> : null}
          </ul>
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Compliance (preview)</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className={`h-full ${
                  compliancePreview.value >= 100
                    ? "bg-rose-400/80"
                    : compliancePreview.value >= 50
                      ? "bg-amber-400/80"
                      : "bg-cyan-400/70"
                }`}
                style={{ width: `${compliancePreview.value}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {compliancePreview.value}% • {compliancePreview.label}
            </p>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canApply}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60 disabled:text-zinc-300"
        >
          {isSubmitting ? "Applying..." : "Apply to System"}
        </button>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={applyYesterday}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use yesterday
        </button>
      </div>
    </form>
  );
}
