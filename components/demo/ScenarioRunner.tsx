"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OVERLOAD_RECOVERY_SCENARIO,
  type DemoCheckinInput,
} from "@/lib/demo/scenarios/overload-recovery";

type ScenarioRunMode = "AUTO" | "STEP";
type GuardrailState = "OPEN" | "CAUTION" | "LOCKDOWN";
type ScenarioStatus = "Running" | "Paused" | "Completed";

type ScenarioEvent = {
  id: string;
  day: string;
  type:
    | "CHECKIN_RECORDED (demo)"
    | "GUARDRAIL_TRANSITION (demo)"
    | "PROTOCOL_GENERATED (demo)"
    | "PROTOCOL_APPLIED (demo)";
  message: string;
};

type SimulatedDay = {
  input: DemoCheckinInput;
  lifeScore: number;
  load: number;
  recovery: number;
  risk: number;
  guardrail: GuardrailState;
};

type ScenarioProtocol = {
  mode: "STABILIZE";
  constraints: string[];
  applied: boolean;
  applyDay: number | null;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function deriveGuardrail(risk: number): GuardrailState {
  if (risk >= 70) return "LOCKDOWN";
  if (risk >= 40) return "CAUTION";
  return "OPEN";
}

function simulateDay({
  input,
  previousRisk,
  protocol,
}: {
  input: DemoCheckinInput;
  previousRisk: number | null;
  protocol: ScenarioProtocol | null;
}): SimulatedDay {
  const workloadSignal = input.deepWorkMinutes * 0.32 + input.learningMinutes * 0.2;
  const stressSignal = input.stress * 6;
  const workoutSignal = input.workout ? 10 : 0;
  const load = clamp(workloadSignal + stressSignal + workoutSignal, 0, 100);

  const recoveryRaw =
    input.sleepHours * 10 + input.sleepQuality * 4 - input.stress * 1.8 + (input.workout ? -4 : 3);
  const protocolRecoveryBoost = protocol?.applied ? 6 : 0;
  const recovery = clamp(recoveryRaw + protocolRecoveryBoost, 0, 100);

  const riskRaw = clamp(30 + load * 0.48 - recovery * 0.38, 0, 100);
  const momentumRisk = previousRisk == null ? riskRaw : previousRisk * 0.45 + riskRaw * 0.55;
  const protocolRiskOffset = protocol?.applied ? -10 : 0;
  const risk = clamp(momentumRisk + protocolRiskOffset, 0, 100);

  const lifeScore = clamp(100 - risk * 0.45 - load * 0.18 + recovery * 0.33, 0, 100);

  return {
    input,
    lifeScore,
    load,
    recovery,
    risk,
    guardrail: deriveGuardrail(risk),
  };
}

export function ScenarioRunner() {
  const [mode, setMode] = useState<ScenarioRunMode>("AUTO");
  const [running, setRunning] = useState(false);
  const [dayIndex, setDayIndex] = useState(-1);
  const [days, setDays] = useState<SimulatedDay[]>([]);
  const [events, setEvents] = useState<ScenarioEvent[]>([]);
  const [protocol, setProtocol] = useState<ScenarioProtocol | null>(null);
  const autoTimeoutRef = useRef<number | null>(null);

  const completed = dayIndex >= OVERLOAD_RECOVERY_SCENARIO.length - 1;
  const status: ScenarioStatus = completed ? "Completed" : running ? "Running" : "Paused";
  const currentDay = dayIndex >= 0 ? days[dayIndex] : null;

  const addEvent = (event: Omit<ScenarioEvent, "id">) => {
    setEvents((current) => [{ ...event, id: `${Date.now()}-${Math.random()}` }, ...current].slice(0, 16));
  };

  const resetScenario = () => {
    if (autoTimeoutRef.current) {
      window.clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
    setRunning(false);
    setDayIndex(-1);
    setDays([]);
    setEvents([]);
    setProtocol(null);
  };

  const stepOneDay = useCallback(() => {
    if (completed) {
      setRunning(false);
      return;
    }
    const nextIndex = dayIndex + 1;
    const input = OVERLOAD_RECOVERY_SCENARIO[nextIndex];
    if (!input) {
      setRunning(false);
      return;
    }

    const previousDay = days[days.length - 1] ?? null;
    const nextDay = simulateDay({
      input,
      previousRisk: previousDay?.risk ?? null,
      protocol,
    });

    setDays((current) => [...current, nextDay]);
    setDayIndex(nextIndex);
    addEvent({
      day: input.label,
      type: "CHECKIN_RECORDED (demo)",
      message: `Daily check-in processed for ${input.label}.`,
    });

    if (previousDay && previousDay.guardrail !== nextDay.guardrail) {
      addEvent({
        day: input.label,
        type: "GUARDRAIL_TRANSITION (demo)",
        message: `Guardrail transition: ${previousDay.guardrail} -> ${nextDay.guardrail}.`,
      });
    }

    const shouldGenerateProtocol =
      (nextDay.guardrail === "CAUTION" || nextDay.guardrail === "LOCKDOWN") && protocol == null;

    if (shouldGenerateProtocol) {
      setProtocol({
        mode: "STABILIZE",
        constraints: [
          "Deep work cap: 60-90m",
          "Training: light only",
          "No late caffeine",
          "Re-evaluate in 12h",
        ],
        applied: false,
        applyDay: null,
      });
      addEvent({
        day: input.label,
        type: "PROTOCOL_GENERATED (demo)",
        message: "Recommended protocol: STABILIZE.",
      });
    }

    if (nextIndex >= OVERLOAD_RECOVERY_SCENARIO.length - 1) {
      setRunning(false);
    }
  }, [completed, dayIndex, days, protocol]);

  const runScenario = () => {
    resetScenario();
    if (mode === "AUTO") {
      setRunning(true);
    } else {
      setRunning(false);
    }
  };

  const applyProtocol = () => {
    if (!protocol || protocol.applied) return;
    setProtocol((current) =>
      current
        ? {
            ...current,
            applied: true,
            applyDay: dayIndex >= 0 ? dayIndex + 1 : null,
          }
        : current
    );
    addEvent({
      day: dayIndex >= 0 ? `Day ${dayIndex + 1}` : "Scenario",
      type: "PROTOCOL_APPLIED (demo)",
      message: "Protocol applied to demo state.",
    });
  };

  useEffect(() => {
    if (!running || mode !== "AUTO" || completed) return;
    autoTimeoutRef.current = window.setTimeout(() => {
      stepOneDay();
    }, 1100);
    return () => {
      if (autoTimeoutRef.current) {
        window.clearTimeout(autoTimeoutRef.current);
        autoTimeoutRef.current = null;
      }
    };
  }, [completed, mode, running, dayIndex, stepOneDay]);

  const statusText = useMemo(() => {
    if (!completed) return null;
    const finalGuardrail = currentDay?.guardrail ?? "OPEN";
    return `Scenario completed. System returned to ${finalGuardrail}.`;
  }, [completed, currentDay?.guardrail]);

  return (
    <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Controlled Scenario</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Run a deterministic sequence to observe guardrails and protocol enforcement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("AUTO")}
              className={`min-h-9 rounded px-2.5 py-1 ${mode === "AUTO" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}
            >
              AUTO
            </button>
            <button
              type="button"
              onClick={() => setMode("STEP")}
              className={`min-h-9 rounded px-2.5 py-1 ${mode === "STEP" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"}`}
            >
              STEP
            </button>
          </div>
          <button
            type="button"
            onClick={runScenario}
            className="min-h-9 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100"
          >
            Run scenario
          </button>
          <button
            type="button"
            onClick={resetScenario}
            className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
          >
            Reset
          </button>
          {mode === "STEP" ? (
            <button
              type="button"
              onClick={stepOneDay}
              disabled={completed}
              className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 disabled:opacity-50"
            >
              Next day
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-zinc-300">
              Simulated day: {dayIndex >= 0 ? `${dayIndex + 1} / ${OVERLOAD_RECOVERY_SCENARIO.length}` : "0 / 10"}
              {currentDay ? ` • ${currentDay.input.label}` : ""}
            </p>
            <p className="text-zinc-400">Scenario status: {status}</p>
          </div>
          {statusText ? <p className="mt-2 text-[11px] text-zinc-400">{statusText}</p> : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Guardrail</p>
              <p className="mt-1 text-xs text-zinc-100">{currentDay?.guardrail ?? "OPEN"}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Life Score</p>
              <p className="mt-1 text-xs text-zinc-100">{currentDay ? currentDay.lifeScore.toFixed(1) : "—"}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Risk</p>
              <p className="mt-1 text-xs text-zinc-100">{currentDay ? currentDay.risk.toFixed(1) : "—"}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Recovery</p>
              <p className="mt-1 text-xs text-zinc-100">{currentDay ? currentDay.recovery.toFixed(1) : "—"}</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Protocol</p>
            {protocol ? (
              <>
                <p className="mt-1 text-xs text-zinc-200">
                  Recommended: {protocol.mode} {protocol.applied ? "(applied)" : "(not applied)"}
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-400">
                  {protocol.constraints.slice(0, 4).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={applyProtocol}
                  disabled={protocol.applied}
                  className="mt-2 min-h-9 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 disabled:opacity-50"
                >
                  Apply protocol
                </button>
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Recommended protocol pending guardrail escalation.</p>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Scenario Event Log</p>
          {events.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No events yet.</p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {events.map((event) => (
                <li key={event.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-500">{event.day}</span>
                    <span className="text-zinc-300">{event.type}</span>
                  </div>
                  <p className="mt-1 text-zinc-400">{event.message}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
