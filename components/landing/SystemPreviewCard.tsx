"use client";

import { useEffect, useRef, useState } from "react";

type GuardrailState = "OPEN" | "CAUTION" | "LOCKDOWN";
type EventType = "Baseline" | "High load" | "Overload" | "Recovery";

type PreviewState = {
  lifeScore: number;
  recovery: number;
  riskPct: number;
  guardrail: GuardrailState;
  eventType: EventType;
};

function useAnimatedNumber(target: number, durationMs = 260) {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const start = currentRef.current;
    const startTs = performance.now();
    let frame = 0;

    const tick = (ts: number) => {
      const progress = Math.min(1, (ts - startTs) / durationMs);
      const next = start + (target - start) * progress;
      currentRef.current = next;
      setValue(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function intInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function guardrailFromRisk(riskPct: number): GuardrailState {
  if (riskPct > 40) return "LOCKDOWN";
  if (riskPct > 25) return "CAUTION";
  return "OPEN";
}

function getBaseSeed(): number {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateSeed = Number(`${yyyy}${mm}${dd}`);
  return (dateSeed + hashString("LIFEOS")) >>> 0;
}

function buildBaseline(seed: number): PreviewState {
  const rng = mulberry32(seed);
  const lifeScore = intInRange(rng, 58, 72);
  const recovery = intInRange(rng, 70, 88);
  const riskPct = intInRange(rng, 8, 18);
  return {
    lifeScore,
    recovery,
    riskPct,
    guardrail: "OPEN",
    eventType: "Baseline",
  };
}

const EVENT_SEQUENCE: EventType[] = ["High load", "Overload", "Recovery", "Baseline"];

function nextEventInSequence(current: EventType): EventType {
  const index = EVENT_SEQUENCE.indexOf(current);
  if (index < 0) {
    return EVENT_SEQUENCE[0];
  }
  return EVENT_SEQUENCE[(index + 1) % EVENT_SEQUENCE.length];
}

function injectEvent(state: PreviewState, baseSeed: number, clickCounter: number, eventType: EventType): PreviewState {
  const effectiveSeed = (baseSeed + clickCounter * 101) >>> 0;
  const rng = mulberry32(effectiveSeed);

  const delta =
    eventType === "High load"
      ? {
          lifeScore: -intInRange(rng, 6, 11),
          recovery: -intInRange(rng, 8, 14),
          riskPct: intInRange(rng, 9, 16),
        }
      : eventType === "Overload"
        ? {
            lifeScore: -intInRange(rng, 11, 18),
            recovery: -intInRange(rng, 14, 22),
            riskPct: intInRange(rng, 16, 25),
          }
        : eventType === "Recovery"
          ? {
              lifeScore: intInRange(rng, 4, 10),
              recovery: intInRange(rng, 8, 16),
              riskPct: -intInRange(rng, 7, 14),
            }
          : {
              lifeScore: 0,
              recovery: 0,
              riskPct: 0,
            };

  const lifeScore = clamp(state.lifeScore + delta.lifeScore, 5, 95);
  const recovery = clamp(state.recovery + delta.recovery, 5, 95);
  const riskPct = clamp(state.riskPct + delta.riskPct, 1, 99);
  const guardrail = guardrailFromRisk(riskPct);

  return { lifeScore, recovery, riskPct, guardrail, eventType };
}

export function SystemPreviewCard() {
  const [baseSeed] = useState<number>(() => getBaseSeed());
  const [baseline] = useState<PreviewState>(() => buildBaseline(baseSeed));
  const [, setClickCounter] = useState(0);
  const [isInjecting, setIsInjecting] = useState(false);
  const [nextEventType, setNextEventType] = useState<EventType>("High load");
  const cooldownRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<PreviewState>(baseline);

  const life = useAnimatedNumber(preview.lifeScore);
  const recovery = useAnimatedNumber(preview.recovery);
  const risk = useAnimatedNumber(preview.riskPct);

  useEffect(() => {
    return () => {
      if (cooldownRef.current !== null) {
        window.clearTimeout(cooldownRef.current);
      }
    };
  }, []);

  return (
    <section id="system-preview" className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_20px_48px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Preview</p>
      <p className="mt-1 text-[11px] text-zinc-500">Live state simulation</p>
      <p className="text-[11px] text-zinc-600">Model version: 0.3.1</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["Baseline", "High load", "Overload", "Recovery"] as const).map((event) => (
          <button
            key={event}
            type="button"
            onClick={() => setNextEventType(event)}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition duration-200 ${
              nextEventType === event
                ? "border-cyan-400/60 bg-cyan-500/12 text-cyan-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {event}
          </button>
        ))}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-zinc-800/70 pb-2">
          <dt className="text-zinc-400">Life Score</dt>
          <dd className="tabular-nums text-zinc-100 transition-all duration-200">{Math.round(life)}</dd>
        </div>
        <div className="flex items-center justify-between border-b border-zinc-800/70 pb-2">
          <dt className="text-zinc-400">Guardrail</dt>
          <dd
            className={`rounded border px-2 py-0.5 text-xs font-medium transition-all duration-200 ${
              preview.guardrail === "OPEN"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : preview.guardrail === "CAUTION"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  : "border-rose-500/50 bg-rose-500/10 text-rose-200"
            }`}
          >
            {preview.guardrail}
          </dd>
        </div>
        <div className="flex items-center justify-between border-b border-zinc-800/70 pb-2">
          <dt className="text-zinc-400">Recovery</dt>
          <dd className="tabular-nums text-zinc-100 transition-all duration-200">{Math.round(recovery)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-400">Overload Risk</dt>
          <dd className="tabular-nums text-zinc-100 transition-all duration-200">
            {Math.round(risk)}% <span className="text-zinc-500">(24h)</span>
          </dd>
        </div>
      </dl>

      <button
        type="button"
        disabled={isInjecting}
        onClick={() => {
          if (isInjecting) {
            return;
          }
          setIsInjecting(true);
          setClickCounter((prev) => {
            const next = prev + 1;
            setPreview(injectEvent(baseline, baseSeed, next, nextEventType));
            setNextEventType(nextEventInSequence(nextEventType));
            return next;
          });
          cooldownRef.current = window.setTimeout(() => {
            setIsInjecting(false);
          }, 850);
        }}
        className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition duration-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isInjecting ? "Injecting..." : "Trigger event"}
      </button>
      <p className="mt-1 text-[11px] text-zinc-500">See how guardrails respond</p>
      <p className="mt-2 text-xs text-zinc-500">Event type: {preview.eventType}</p>
      <p className={`text-xs text-zinc-500 transition-opacity duration-200 ${preview.guardrail !== "OPEN" ? "opacity-100" : "opacity-0"}`}>
        Stabilization protocol engaged.
      </p>
    </section>
  );
}
