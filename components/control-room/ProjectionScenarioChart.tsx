"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectionChartContainer } from "@/components/control-room/projection/ProjectionChartContainer";
import { RiskEnvelopeChart } from "@/components/control-room/projection/RiskEnvelopeChart";
import { AntiChaosPanel } from "@/components/control-room/projection/AntiChaosPanel";
import { ScenarioLibraryPanel } from "@/components/control-room/projection/ScenarioLibraryPanel";
import {
  NewScenarioModal,
  type NewScenarioPayload,
} from "@/components/control-room/projection/NewScenarioModal";
import { UpgradePromptModal } from "@/components/control-room/UpgradePromptModal";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { ModalShell } from "@/components/ui/ModalShell";
import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
import { generate72hProtocol } from "@/lib/engine/protocol72h";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type ProjectionPoint = {
  dateOffset: number;
  lifeScore: number;
  risk: number;
  burnoutRisk: number;
  energy: number;
  focus: number;
};

type Projection30d = {
  baseline: ProjectionPoint[];
  stabilization: ProjectionPoint[];
  overload: ProjectionPoint[];
};

type InterventionModifiers = {
  sleepMinutesDelta: number;
  deepWorkPctDelta: number;
  stressDelta: number;
};

type DeltaAt30d = {
  lifeScore: number;
  risk: number;
  burnout: number;
};

type RiskEnvelopePoint = {
  tLabel: string;
  riskStabilize: number;
  riskBaseline: number;
  riskOverload: number;
};

type ImpactContribution = {
  lever: string;
  delta: number;
  label: string;
};

type ImpactResult = {
  horizonHours: number;
  metric: "risk" | "burnout";
  baseEnd: number;
  modeEnd: number;
  netDelta: number;
  contributions: ImpactContribution[];
};

type EnvelopeImpactPayload = {
  stabilize: {
    risk: ImpactResult;
    burnout: ImpactResult;
  };
  overload: {
    risk: ImpactResult;
    burnout: ImpactResult;
  };
};

type DecisionBudget72h = {
  allowableLoadDelta: number;
  allowableStressDelta: number;
  maxWorkoutIntensity: number;
  safeWindowHours: number;
};

type ProjectionScenarioChartProps = {
  locale: Locale;
  userId: string;
  isAdmin?: boolean;
  readOnly?: boolean;
  projection: Projection30d;
  custom?: ProjectionPoint[] | null;
  deltasAt30d?: DeltaAt30d | null;
  customLoading?: boolean;
  modifiers: InterventionModifiers;
  onModifiersChange: (modifiers: InterventionModifiers) => void;
  onApplyCustom: () => void;
  onResetCustom: () => void;
  selectedDateISO: string;
  isPro: boolean;
  onAntiChaosProtocolChange?: (protocol: AntiChaosProtocol | null) => void;
  patternContext: {
    systemMode: string;
    topPattern: string | null;
  };
  calibrationConfidence: number;
  guardrail: {
    level: 0 | 1 | 2;
    label: "OPEN" | "CAUTION" | "LOCKDOWN";
    reasons: string[];
    avgRisk14d: number;
  };
  envelope72h?: RiskEnvelopePoint[] | null;
  impact72h?: EnvelopeImpactPayload | null;
  decisionBudget72h?: DecisionBudget72h | null;
  modelConfidence: {
    confidence: number;
    notes: string[];
  };
  matchTrajectoryStyle?: boolean;
};

type ScenarioLibraryItem = {
  id: string;
  createdAt: string;
  name?: string | null;
  horizonDays?: number;
  tags?: string | null;
  baseDateISO: string;
  source: string;
  inputModifiers: Record<string, unknown>;
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

function lineClass(value: number): string {
  if (value > 0) return "text-emerald-200 border-emerald-700/60";
  if (value < 0) return "text-rose-200 border-rose-700/60";
  return "text-zinc-200 border-zinc-700/60";
}

function formatBudgetValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return value.toFixed(1);
}

function getPrimaryBudgetViolation(args: {
  riskExceeded: boolean;
  recoveryExceeded: boolean;
  loadExceeded: boolean;
}): string | null {
  if (args.riskExceeded) return "Risk crosses CAUTION limit";
  if (args.recoveryExceeded) return "Recovery reserve below threshold";
  if (args.loadExceeded) return "Load inertia exceeds envelope";
  return null;
}

export function ProjectionScenarioChart({
  locale,
  userId,
  isAdmin = false,
  readOnly = false,
  projection,
  custom,
  deltasAt30d,
  customLoading = false,
  modifiers,
  onModifiersChange,
  onApplyCustom,
  onResetCustom,
  selectedDateISO,
  isPro,
  onAntiChaosProtocolChange,
  patternContext,
  calibrationConfidence,
  guardrail,
  envelope72h = null,
  impact72h = null,
  decisionBudget72h = null,
  modelConfidence,
  matchTrajectoryStyle = false,
}: ProjectionScenarioChartProps) {
  const WHY_POPOVER_ID = "projection-budget-why-popover";
  const guardrailLabel = guardrail.label === "OPEN" ? t("open", locale) : guardrail.label === "CAUTION" ? t("caution", locale) : t("lockdown", locale);

  const hasData = projection.baseline.length > 0 || projection.stabilization.length > 0 || projection.overload.length > 0;
  const hasEnvelopeData = (envelope72h?.length ?? 0) > 0;
  const baselineRisk0 = envelope72h?.[0]?.riskBaseline;
  const baselineBreachKind =
    guardrail.level === 2
      ? "LOCKDOWN"
      : typeof baselineRisk0 !== "number" || !Number.isFinite(baselineRisk0)
        ? "INVALID"
        : baselineRisk0 >= 80
          ? "CRITICAL"
          : baselineRisk0 >= 65
            ? "CAUTION"
            : "NONE";
  const debugSafeWindow = decisionBudget72h?.safeWindowHours;
  const budgetLoadLimit =
    typeof decisionBudget72h?.allowableLoadDelta === "number" && Number.isFinite(decisionBudget72h.allowableLoadDelta)
      ? decisionBudget72h.allowableLoadDelta
      : null;
  const budgetStressLimit =
    typeof decisionBudget72h?.allowableStressDelta === "number" && Number.isFinite(decisionBudget72h.allowableStressDelta)
      ? decisionBudget72h.allowableStressDelta
      : null;
  const budgetWorkoutLimit =
    typeof decisionBudget72h?.maxWorkoutIntensity === "number" && Number.isFinite(decisionBudget72h.maxWorkoutIntensity)
      ? decisionBudget72h.maxWorkoutIntensity
      : null;
  const overloadStressDelta = 2;
  const overloadBlockedByGuardrail = guardrail.level === 2;
  const overloadBlockedByLoadBudget = budgetLoadLimit !== null && budgetLoadLimit <= 0;
  const overloadBlockedByWorkoutBudget = budgetWorkoutLimit !== null && budgetWorkoutLimit < 1;
  const overloadBlockedByStressBudget = budgetStressLimit !== null && budgetStressLimit < overloadStressDelta;
  const overloadExceedsBudget =
    overloadBlockedByLoadBudget || overloadBlockedByWorkoutBudget || overloadBlockedByStressBudget;
  const overloadPrimaryViolation = getPrimaryBudgetViolation({
    riskExceeded: guardrail.level >= 1,
    recoveryExceeded: overloadBlockedByWorkoutBudget || overloadBlockedByStressBudget,
    loadExceeded: overloadBlockedByLoadBudget,
  });
  const overloadToggleDisabled = overloadBlockedByGuardrail || overloadExceedsBudget;
  const overloadBlockLabel = overloadBlockedByGuardrail
    ? "Blocked by Guardrail (LOCKDOWN)"
    : overloadBlockedByLoadBudget
      ? "Exceeds Budget"
      : overloadExceedsBudget
        ? "Exceeds 72h Budget"
        : null;

  const proposedStressIncrease = Math.max(0, modifiers.stressDelta);
  const proposedLoadIncrease = Math.max(0, modifiers.deepWorkPctDelta);
  const applyBlockedByLoadBudget =
    budgetLoadLimit !== null && budgetLoadLimit <= 0 && proposedLoadIncrease > 0;
  const applyBlockedByStressBudget =
    budgetStressLimit !== null && proposedStressIncrease > budgetStressLimit;
  const applyExceedsBudget = applyBlockedByLoadBudget || applyBlockedByStressBudget;
  const applyPrimaryViolation = getPrimaryBudgetViolation({
    riskExceeded: guardrail.level >= 1,
    recoveryExceeded: applyBlockedByStressBudget,
    loadExceeded: applyBlockedByLoadBudget,
  });
  const applyBudgetLabel = applyBlockedByLoadBudget ? "Exceeds Budget" : applyExceedsBudget ? "Exceeds 72h Budget" : null;
  const budgetWhyTooltip =
    "Budget is the allowable load envelope given current recovery capacity.\nPrimary violation indicates the first constraint exceeded.";
  const [whyPopoverOpen, setWhyPopoverOpen] = useState<"overload" | "apply" | null>(null);
  const whyPopoverRef = useRef<HTMLDivElement | null>(null);
  const whyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [horizonHours, setHorizonHours] = useState<24 | 48 | 72>(24);
  const [viewMode, setViewMode] = useState<"projection30d" | "envelope72h">("projection30d");
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [protocolCache, setProtocolCache] = useState<Record<string, AntiChaosProtocol>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorId, setSaveErrorId] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryRows, setLibraryRows] = useState<ScenarioLibraryItem[]>([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareScenarioId, setCompareScenarioId] = useState<string>("");
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [newScenarioSaving, setNewScenarioSaving] = useState(false);
  const [newScenarioError, setNewScenarioError] = useState<string | null>(null);
  const [newScenarioErrorId, setNewScenarioErrorId] = useState<string | null>(null);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptCapability, setUpgradePromptCapability] = useState<string | null>(null);
  const [projectionHelpOpen, setProjectionHelpOpen] = useState(false);
  const [overloadEnabled, setOverloadEnabled] = useState<boolean>(guardrail.level === 0);
  const protocol72h = useMemo(
    () =>
      generate72hProtocol({
        decisionBudget: decisionBudget72h,
        guardrailLevel: guardrail.level,
        envelope72h,
      }),
    [decisionBudget72h, envelope72h, guardrail.level]
  );

  const cacheKey = `${userId}:${selectedDateISO}:${horizonHours}`;
  const activeProtocol = useMemo(() => protocolCache[cacheKey] ?? null, [cacheKey, protocolCache]);
  const compareScenario = useMemo(
    () => libraryRows.find((row) => row.id === compareScenarioId) ?? null,
    [libraryRows, compareScenarioId]
  );
  const compareLimited = calibrationConfidence < 0.6 || modelConfidence.confidence < 0.6;

  const compareSeries = useMemo<ProjectionPoint[] | null>(() => {
    if (!compareEnabled || !compareScenario || projection.baseline.length === 0) return null;
    const baselineSorted = [...projection.baseline].sort((a, b) => a.dateOffset - b.dateOffset);
    const baselineLast = baselineSorted[baselineSorted.length - 1];
    if (!baselineLast) return null;

    const targetLife = compareScenario.projectionResult.lifeScore30;
    const targetRisk = compareScenario.projectionResult.risk30;
    const targetBurnout = compareScenario.projectionResult.burnout30;
    const deltaLife = targetLife - baselineLast.lifeScore;
    const deltaRisk = targetRisk - baselineLast.risk;
    const deltaBurnout = targetBurnout - baselineLast.burnoutRisk;

    const series = baselineSorted.map((point, idx) => {
      const factor = (idx + 1) / baselineSorted.length;
      const lifeScore = Math.max(0, Math.min(100, point.lifeScore + deltaLife * factor));
      const risk = Math.max(0, Math.min(100, point.risk + deltaRisk * factor));
      const burnoutRisk = Math.max(0, Math.min(100, point.burnoutRisk + deltaBurnout * factor));
      return {
        ...point,
        lifeScore: Number(lifeScore.toFixed(1)),
        risk: Number(risk.toFixed(1)),
        burnoutRisk: Number(burnoutRisk.toFixed(1)),
      };
    });

    const last = series[series.length - 1];
    if (last) {
      last.lifeScore = Number(targetLife.toFixed(1));
      last.risk = Number(targetRisk.toFixed(1));
      last.burnoutRisk = Number(targetBurnout.toFixed(1));
    }
    return series;
  }, [compareEnabled, compareScenario, projection.baseline]);

  const compareDelta = useMemo(() => {
    if (!compareEnabled || !compareScenario || projection.baseline.length === 0) return null;
    const baselineLast = [...projection.baseline].sort((a, b) => a.dateOffset - b.dateOffset).at(-1);
    if (!baselineLast) return null;
    const riskToGuardrail = (risk: number): "OPEN" | "CAUTION" | "LOCKDOWN" => {
      if (risk >= 85) return "LOCKDOWN";
      if (risk >= 70) return "CAUTION";
      return "OPEN";
    };
    return {
      life: Number((compareScenario.projectionResult.lifeScore30 - baselineLast.lifeScore).toFixed(1)),
      risk: Number((compareScenario.projectionResult.risk30 - baselineLast.risk).toFixed(1)),
      guardrailFrom: riskToGuardrail(baselineLast.risk),
      guardrailTo: riskToGuardrail(compareScenario.projectionResult.risk30),
    };
  }, [compareEnabled, compareScenario, projection.baseline]);

  const showUpgradePrompt = (capability: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("upgrade_prompt_shown", { capability });
    }
    setUpgradePromptCapability(capability);
    setUpgradePromptOpen(true);
  };

  const saveNewScenario = async (payload: NewScenarioPayload) => {
    if (readOnly) {
      setNewScenarioError("Simulation account is read-only.");
      setNewScenarioErrorId(null);
      return;
    }
    if (!isPro) {
      showUpgradePrompt("New scenario");
      return;
    }
    try {
      setNewScenarioSaving(true);
      setNewScenarioError(null);
      setNewScenarioErrorId(null);
      setSaveError(null);
      setSaveErrorId(null);

      const presetModifiers =
        payload.preset === "HIGH_LOAD"
          ? { stressDelta: 2, workoutForcedOff: false, tag: "PLANNED" }
          : payload.preset === "STABILIZE"
            ? { stressDelta: -2, workoutForcedOff: true, tag: "STABILIZE" }
            : { stressDelta: 0, workoutForcedOff: false, tag: "BASELINE" };

      const projectionResponse = await fetch("/api/projection/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          date: selectedDateISO,
          modifiers: {
            sleepMinutesDelta: payload.sleepMinutesDelta,
            deepWorkPctDelta: payload.deepWorkPctDelta,
            stressDelta: presetModifiers.stressDelta,
            workoutForcedOff: presetModifiers.workoutForcedOff,
          },
        }),
      });

      const projectionPayload = (await projectionResponse.json()) as
        | {
            ok: true;
            data: {
              custom: ProjectionPoint[] | null;
            };
          }
        | { ok: false; error?: string; message?: string };

      if (!projectionResponse.ok || !projectionPayload.ok || !projectionPayload.data.custom?.length) {
        throw new Error(
          projectionPayload.ok ? "Failed to build scenario projection." : projectionPayload.error ?? "Failed to build scenario projection."
        );
      }

      const customSeries = projectionPayload.data.custom;
      const last = customSeries[customSeries.length - 1];
      if (!last) {
        throw new Error("Failed to build scenario projection.");
      }
      const riskSeries = customSeries.map((point) => point.risk);
      const volatility = Number(stddev(riskSeries).toFixed(1));

      const saveResponse = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          name: payload.name,
          horizonDays: 30,
          tags: presetModifiers.tag,
          baseDateISO: selectedDateISO,
          source: "intervention",
          inputModifiers: {
            preset: payload.preset,
            sleepMinutesDelta: payload.sleepMinutesDelta,
            deepWorkPctDelta: payload.deepWorkPctDelta,
            stressDelta: presetModifiers.stressDelta,
            workoutForcedOff: presetModifiers.workoutForcedOff,
          },
          projectionResult: {
            lifeScore30: Number(last.lifeScore.toFixed(1)),
            risk30: Number(last.risk.toFixed(1)),
            burnout30: Number(last.burnoutRisk.toFixed(1)),
            volatility,
          },
          patternContext,
          calibrationConfidence,
        }),
      });

      const savePayload = (await saveResponse.json()) as
        | { ok: true; data: { scenario: ScenarioLibraryItem } }
        | { ok: false; error?: string; message?: string; errorId?: string };

      if (!saveResponse.ok || !savePayload.ok) {
        if (!savePayload.ok && savePayload.error === "SYSTEM_FAULT" && savePayload.errorId) {
          setNewScenarioError("System fault.");
          setNewScenarioErrorId(savePayload.errorId);
          setSaveError("System fault.");
          setSaveErrorId(savePayload.errorId);
          return;
        }
        throw new Error(savePayload.ok ? "Failed to save scenario." : savePayload.error ?? "Failed to save scenario.");
      }

      setSaveNotice("Scenario saved.");
      setNewScenarioOpen(false);
      setCompareScenarioId(savePayload.data.scenario.id);
      setCompareEnabled(true);
      await loadScenarioLibrary();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save scenario.";
      setNewScenarioError(message);
      setNewScenarioErrorId(null);
      setSaveError(message);
      setSaveErrorId(null);
    } finally {
      setNewScenarioSaving(false);
    }
  };

  const loadScenarioLibrary = async () => {
    if (!isPro) return;
    try {
      setLibraryLoading(true);
      const response = await fetch(`/api/scenarios?userId=${userId}&limit=50`, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { scenarios?: ScenarioLibraryItem[] };
        error?: string;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Failed to load scenarios.");
      }
      setLibraryRows(payload.data?.scenarios ?? []);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to load scenarios.");
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    void loadScenarioLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedDateISO, isPro]);

  useEffect(() => {
    if (!compareScenarioId && libraryRows.length > 0) {
      setCompareScenarioId(libraryRows[0].id);
    }
  }, [compareScenarioId, libraryRows]);

  useEffect(() => {
    if (overloadToggleDisabled) {
      setOverloadEnabled(false);
      return;
    }
    if (guardrail.level === 1) {
      setOverloadEnabled(false);
      return;
    }
    setOverloadEnabled(true);
  }, [guardrail.level, overloadToggleDisabled]);

  useEffect(() => {
    if (guardrail.level !== 2) return;
    const constrained = {
      sleepMinutesDelta: Math.min(Math.max(modifiers.sleepMinutesDelta, 0), 60),
      deepWorkPctDelta: Math.min(Math.max(modifiers.deepWorkPctDelta, -0.3), 0),
      stressDelta: Math.min(Math.max(modifiers.stressDelta, -3), -1),
    };
    if (
      constrained.sleepMinutesDelta !== modifiers.sleepMinutesDelta ||
      constrained.deepWorkPctDelta !== modifiers.deepWorkPctDelta ||
      constrained.stressDelta !== modifiers.stressDelta
    ) {
      onModifiersChange(constrained);
    }
  }, [guardrail.level, modifiers, onModifiersChange]);

  useEffect(() => {
    if (!whyPopoverOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (whyPopoverRef.current?.contains(target)) return;
      if (whyTriggerRef.current?.contains(target)) return;
      setWhyPopoverOpen(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWhyPopoverOpen(null);
        whyTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [whyPopoverOpen]);

  useEffect(() => {
    onAntiChaosProtocolChange?.(activeProtocol);
  }, [activeProtocol, onAntiChaosProtocolChange]);

  const setHorizon = (hours: 24 | 48 | 72) => {
    setHorizonHours(hours);
    onAntiChaosProtocolChange?.(protocolCache[`${userId}:${selectedDateISO}:${hours}`] ?? null);
  };

  const generateProtocol = async () => {
    if (!isPro) return;
    if (protocolCache[cacheKey]) {
      setProtocolError(null);
      return;
    }

    try {
      setProtocolLoading(true);
      setProtocolError(null);
      const response = await fetch("/api/anti-chaos/protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: selectedDateISO, horizonHours }),
      });
      const payload = (await response.json()) as { ok?: boolean; data?: AntiChaosProtocol | null; error?: string; message?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? payload.message ?? "Failed to generate anti-chaos protocol.");
      }
      const protocol = payload.data as AntiChaosProtocol;
      setProtocolCache((prev) => ({ ...prev, [cacheKey]: protocol }));
      onAntiChaosProtocolChange?.(protocol);
    } catch (error) {
      setProtocolError(error instanceof Error ? error.message : "Failed to generate anti-chaos protocol.");
    } finally {
      setProtocolLoading(false);
    }
  };

  const toggleScenarioSelect = (id: string) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const stddev = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  };

  const impactLineClass = (value: number): string => {
    if (value > 0) return "text-rose-200";
    if (value < 0) return "text-emerald-200";
    return "text-zinc-300";
  };

  const toggleOverload = () => {
    if (overloadToggleDisabled) return;
    if (!overloadEnabled && guardrail.level === 1) {
      const ok = window.confirm("Proceed into overload simulation?");
      if (!ok) return;
    }
    setOverloadEnabled((prev) => !prev);
  };

  const saveScenario = async () => {
    if (readOnly) {
      setSaveError("Simulation account is read-only.");
      setSaveErrorId(null);
      return;
    }
    if (!isPro) {
      showUpgradePrompt("Save Scenario");
      return;
    }
    const source: "projection" | "intervention" | "anti_chaos" = activeProtocol
      ? "anti_chaos"
      : custom && custom.length > 0
        ? "intervention"
        : "projection";
    const series =
      source === "anti_chaos"
        ? activeProtocol?.series.protocol ?? []
        : source === "intervention"
          ? custom ?? []
          : projection.baseline;
    const last = series[series.length - 1];
    if (!last) {
      setSaveError("No scenario series available to save.");
      return;
    }
    const riskSeries = series.map((point) => point.risk);
    const inputModifiers =
      source === "anti_chaos"
        ? { actions: activeProtocol?.actions ?? null }
        : source === "intervention"
          ? { ...modifiers }
          : { scenario: "baseline" };

    try {
      setSaveLoading(true);
      setSaveNotice(null);
      setSaveError(null);
      setSaveErrorId(null);
      const response = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          baseDateISO: selectedDateISO,
          source,
          inputModifiers,
          projectionResult: {
            lifeScore30: Number(last.lifeScore.toFixed(1)),
            risk30: Number(last.risk.toFixed(1)),
            burnout30: Number(last.burnoutRisk.toFixed(1)),
            volatility: Number(stddev(riskSeries).toFixed(1)),
          },
          patternContext,
          calibrationConfidence,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; message?: string; errorId?: string };
      if (!response.ok || !payload.ok) {
        if (payload.error === "SYSTEM_FAULT" && payload.errorId) {
          setSaveError("System fault.");
          setSaveErrorId(payload.errorId);
          return;
        }
        throw new Error(payload.error ?? payload.message ?? "Failed to save scenario.");
      }
      setSaveNotice("Scenario saved.");
      await loadScenarioLibrary();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save scenario.");
      setSaveErrorId(null);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-100">Last 30 days</h3>
            <button
              type="button"
              onClick={() => setProjectionHelpOpen(true)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Help
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{t("modelConfidence", locale)}: {modelConfidence.confidence.toFixed(2)}</span>
            <span
              className={`rounded border px-1.5 py-0.5 ${
                guardrail.level === 2
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                  : guardrail.level === 1
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              }`}
              title={
                guardrail.reasons.length > 0
                  ? guardrail.reasons.join(", ")
                  : `avgRisk14d=${guardrail.avgRisk14d.toFixed(1)}`
              }
            >
              {t("guardrail", locale)}: {guardrailLabel}
            </span>
            {modelConfidence.confidence < 0.45 ? (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-200"
                title={
                  modelConfidence.notes.length > 0
                    ? modelConfidence.notes.join(", ")
                    : t("lowModelConfidence", locale)
                }
                aria-label="Low model confidence"
              >
                !
              </span>
            ) : null}
          </div>
        </div>
      </header>
      {saveNotice ? <p className="mb-2 text-xs text-emerald-300">{saveNotice}</p> : null}
      {saveError ? (
        saveErrorId ? (
          <ErrorIdNotice
            message={saveError}
            errorId={saveErrorId}
            className="mb-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200"
          />
        ) : (
          <p className="mb-2 text-xs text-rose-300">{saveError}</p>
        )
      ) : null}
      <div className="mb-3 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/45 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Chart mode</p>
          <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950/80 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode("projection30d")}
              className={`rounded px-2 py-1 transition ${
                viewMode === "projection30d" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              30-Day trajectory
            </button>
            <button
              type="button"
              onClick={() => setViewMode("envelope72h")}
              className={`rounded px-2 py-1 transition ${
                viewMode === "envelope72h" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t("envelope72h", locale)}
            </button>
          </div>
        </div>
        <div className="border-t border-zinc-800/80" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Overload simulation</p>
          <button
            type="button"
            onClick={toggleOverload}
            disabled={overloadToggleDisabled}
            title={
              overloadBlockedByGuardrail
                ? `Locked by guardrail${guardrail.reasons.length > 0 ? `: ${guardrail.reasons.join(", ")}` : ""}`
                : overloadExceedsBudget
                  ? "Exceeds 72h Budget"
                : guardrail.level === 1
                  ? "Proceed into overload simulation?"
                  : "Toggle overload scenario"
            }
            className={`min-h-9 rounded-md border px-2.5 py-1 text-xs transition ${
              overloadToggleDisabled
                ? "cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-500"
                : overloadEnabled
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {t("overload", locale)}: {overloadEnabled ? t("on", locale) : t("off", locale)}
          </button>
        </div>
      </div>
      {overloadBlockLabel ? (
        <div className="mb-3">
          <p className="text-xs text-amber-300">{overloadBlockLabel}</p>
          {overloadPrimaryViolation ? (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-amber-200/90">Primary violation: {overloadPrimaryViolation}</p>
              <div className="relative">
                <button
                  ref={whyPopoverOpen === "overload" ? whyTriggerRef : null}
                  type="button"
                  onClick={() => setWhyPopoverOpen((current) => (current === "overload" ? null : "overload"))}
                  aria-expanded={whyPopoverOpen === "overload"}
                  aria-controls={whyPopoverOpen === "overload" ? WHY_POPOVER_ID : undefined}
                  className="rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
                >
                  Why?
                </button>
                {whyPopoverOpen === "overload" ? (
                  <div
                    id={WHY_POPOVER_ID}
                    ref={whyPopoverRef}
                    role="dialog"
                    aria-label="Budget explanation"
                    className="absolute left-0 top-[calc(100%+6px)] z-20 w-64 rounded-md border border-zinc-700 bg-zinc-950/95 px-2.5 py-2 text-[11px] text-zinc-200 whitespace-pre-line shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                  >
                    {budgetWhyTooltip}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {viewMode === "envelope72h" ? (
        hasEnvelopeData ? (
          <>
            <RiskEnvelopeChart
              points={envelope72h ?? []}
              showOverload={overloadEnabled}
              safeWindowHours={decisionBudget72h?.safeWindowHours ?? null}
              guardrailLevel={guardrail.level}
            />
            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">
                {t("impactBreakdown", locale)}
              </summary>
              {impact72h ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(["stabilize", "overload"] as const).map((mode) => (
                    <section key={mode} className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                        {mode === "stabilize" ? t("stabilize", locale) : t("overload", locale)}
                      </h4>
                      {(["risk", "burnout"] as const).map((metric) => {
                        const result = impact72h[mode][metric];
                        return (
                          <div key={`${mode}-${metric}`} className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="uppercase tracking-wide text-zinc-400">{metric}</span>
                              <span className={impactLineClass(result.netDelta)}>
                                Net {result.netDelta >= 0 ? "+" : ""}
                                {result.netDelta.toFixed(1)} vs baseline
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 font-mono text-xs tabular-nums">
                              {result.contributions.map((line) => (
                                <div key={`${mode}-${metric}-${line.lever}`} className="flex items-center justify-between">
                                  <span className="text-zinc-300">{line.label}</span>
                                  <span className={impactLineClass(line.delta)}>
                                    {line.delta >= 0 ? "+" : ""}
                                    {line.delta.toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">{t("impactUnavailable", locale)}</p>
              )}
            </details>
            <section className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <h4 className="text-sm font-medium text-zinc-200">Decision Budget (72h)</h4>
              {process.env.NODE_ENV !== "production" && isAdmin ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  debug: safeWindowHours={formatBudgetValue(debugSafeWindow)} breachKind={baselineBreachKind}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Safe Load Margin: {formatBudgetValue(decisionBudget72h?.allowableLoadDelta)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Stress Capacity: {formatBudgetValue(decisionBudget72h?.allowableStressDelta)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Workout Allowance: {formatBudgetValue(decisionBudget72h?.maxWorkoutIntensity)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Time to Caution:{" "}
                  {typeof debugSafeWindow === "number" && Number.isFinite(debugSafeWindow)
                    ? `${Math.max(0, Math.round(debugSafeWindow))}h`
                    : "-"}
                </div>
              </div>
            </section>
            <section className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <h4 className="text-sm font-medium text-zinc-200">72h Operational Protocol</h4>
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Mode: {protocol72h.mode}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Load Limit: {formatBudgetValue(protocol72h.loadLimit)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Stress Limit: {formatBudgetValue(protocol72h.stressLimit)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200">
                  Workout Limit: {formatBudgetValue(protocol72h.workoutLimit)}
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-200 md:col-span-2">
                  Recommended Focus: {protocol72h.recommendedFocus}
                </div>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-zinc-300">
                {protocol72h.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
            {t("envelope72hUnavailable", locale)}
          </div>
        )
      ) : hasData ? (
        <>
          <section>
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Chart projection</p>
            <ProjectionChartContainer
              locale={locale}
              projection={projection}
              custom={custom}
              compareEnabled={compareEnabled}
              compareB={compareSeries}
              antiChaosProtocol={activeProtocol}
              selectedDateISO={selectedDateISO}
              isPro={isPro}
              customLoading={customLoading}
              showOverload={overloadEnabled}
              matchTrajectoryStyle={matchTrajectoryStyle}
            />
          </section>

          <div className="my-4 border-t border-zinc-800/80" />

          <section className="rounded-md border border-zinc-800 bg-zinc-950/65 px-3 py-2">
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Scenario actions</p>
            <div className="flex flex-wrap items-start gap-2 text-xs sm:items-center">
              <button
                type="button"
                onClick={() => void saveScenario()}
                disabled={saveLoading || readOnly}
                title={readOnly ? "Simulation account is read-only." : !isPro ? "Extension layer: forward simulation & scenarios" : undefined}
                className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("saveScenario", locale)} {!isPro ? "Operator capability" : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isPro) {
                    showUpgradePrompt("Compare ON");
                    return;
                  }
                  setCompareEnabled((prev) => !prev);
                }}
                title={!isPro ? "Extension layer: forward simulation & scenarios" : undefined}
                className={`min-h-9 rounded-md border px-2.5 py-1 transition ${
                  compareEnabled
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                Compare {compareEnabled ? "ON" : "OFF"} {!isPro ? "Operator capability" : ""}
              </button>
              <span className="text-zinc-500">Scenario A: BASE</span>
              <span className="hidden text-zinc-600 sm:inline">|</span>
              <span className="text-zinc-500">Scenario B:</span>
              <select
                value={compareScenarioId}
                onChange={(event) => setCompareScenarioId(event.target.value)}
                disabled={!isPro}
                title={!isPro ? "Extension layer: forward simulation & scenarios" : undefined}
                className="min-h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 sm:w-auto"
              >
                {libraryRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {(row.name && row.name.trim().length > 0 ? row.name : row.source).toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (readOnly) {
                    setNewScenarioError("Simulation account is read-only.");
                    setNewScenarioErrorId(null);
                    return;
                  }
                  if (!isPro) {
                    showUpgradePrompt("New scenario");
                    return;
                  }
                  setNewScenarioError(null);
                  setNewScenarioOpen(true);
                }}
                disabled={readOnly}
                title={readOnly ? "Simulation account is read-only." : !isPro ? "Extension layer: forward simulation & scenarios" : undefined}
                className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                New scenario {!isPro ? "Operator capability" : ""}
              </button>
              {!isPro ? (
                <Link
                  href="/pricing"
                  className="min-h-9 w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200 transition hover:border-amber-400 sm:w-auto"
                >
                  Pay for Operator License
                </Link>
              ) : null}
            </div>
            {compareEnabled && compareLimited ? (
              <p className="mt-2 text-xs text-amber-300">Compare limited (low confidence)</p>
            ) : null}
            {compareEnabled && compareDelta ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                <span className={`${compareDelta.life >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  Δ LifeScore: {compareDelta.life >= 0 ? "+" : ""}
                  {compareDelta.life.toFixed(1)}
                </span>
                <span className="text-zinc-600">|</span>
                <span className={`${compareDelta.risk >= 0 ? "text-rose-200" : "text-emerald-200"}`}>
                  Δ Risk: {compareDelta.risk >= 0 ? "+" : ""}
                  {compareDelta.risk.toFixed(1)}
                </span>
                <span className="text-zinc-600">|</span>
                {compareDelta.guardrailFrom === compareDelta.guardrailTo ? (
                  <span className="text-zinc-300">Guardrail unchanged</span>
                ) : (
                  <span className="text-zinc-300">
                    Guardrail: {compareDelta.guardrailFrom} {"->"} {compareDelta.guardrailTo}
                  </span>
                )}
              </div>
            ) : null}
          </section>

          <div className="my-4 border-t border-zinc-800/80" />

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Protocol generation</p>
            <AntiChaosPanel
              locale={locale}
              isPro={isPro}
              horizonHours={horizonHours}
              onHorizonChange={setHorizon}
              onGenerate={() => void generateProtocol()}
              onUpgradePrompt={showUpgradePrompt}
              loading={protocolLoading}
              protocol={activeProtocol}
              error={protocolError}
            />
          </section>

          {isPro ? (
            <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200">
                {t("interventionSimulator", locale)}
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300">
                  <span>{t("sleepDelta", locale)}: {modifiers.sleepMinutesDelta} min</span>
                  <input
                    type="range"
                    min={guardrail.level === 2 ? 0 : -60}
                    max={guardrail.level === 2 ? 60 : 120}
                    step={15}
                    value={modifiers.sleepMinutesDelta}
                    onChange={(event) =>
                      onModifiersChange({
                        ...modifiers,
                        sleepMinutesDelta:
                          guardrail.level === 2
                            ? Math.min(Math.max(Number(event.target.value), 0), 60)
                            : Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full"
                  />
                </label>
                <label className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300">
                  <span>{t("deepWorkDelta", locale)}: {(modifiers.deepWorkPctDelta * 100).toFixed(0)}%</span>
                  <input
                    type="range"
                    min={guardrail.level === 2 ? -30 : -50}
                    max={guardrail.level === 2 ? 0 : 30}
                    step={5}
                    value={Math.round(modifiers.deepWorkPctDelta * 100)}
                    onChange={(event) =>
                      onModifiersChange({
                        ...modifiers,
                        deepWorkPctDelta:
                          guardrail.level === 2
                            ? Math.min(Math.max(Number(event.target.value) / 100, -0.3), 0)
                            : Number(event.target.value) / 100,
                      })
                    }
                    className="mt-2 w-full"
                  />
                </label>
                <label className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300">
                  <span>{t("stressDelta", locale)}: {modifiers.stressDelta}</span>
                  <input
                    type="range"
                    min={-3}
                    max={guardrail.level === 2 ? -1 : 3}
                    step={1}
                    value={modifiers.stressDelta}
                    onChange={(event) =>
                      onModifiersChange({
                        ...modifiers,
                        stressDelta:
                          guardrail.level === 2
                            ? Math.min(Math.max(Number(event.target.value), -3), -1)
                            : Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onApplyCustom}
                  disabled={customLoading || applyExceedsBudget}
                  className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("apply", locale)}
                </button>
                <button
                  type="button"
                  onClick={onResetCustom}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  {t("reset", locale)}
                </button>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                {t("customProjectionHint", locale)}
              </p>
              {guardrail.level === 2 ? (
                <p className="mt-1 text-xs text-amber-300">
                  {t("guardrailConstrained", locale)}
                </p>
              ) : null}
              {applyBudgetLabel ? (
                <div className="mt-1">
                  <p className="text-xs text-amber-300">{applyBudgetLabel}</p>
                  {applyPrimaryViolation ? (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[11px] text-amber-200/90">Primary violation: {applyPrimaryViolation}</p>
                      <div className="relative">
                        <button
                          ref={whyPopoverOpen === "apply" ? whyTriggerRef : null}
                          type="button"
                          onClick={() => setWhyPopoverOpen((current) => (current === "apply" ? null : "apply"))}
                          aria-expanded={whyPopoverOpen === "apply"}
                          aria-controls={whyPopoverOpen === "apply" ? WHY_POPOVER_ID : undefined}
                          className="rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
                        >
                          Why?
                        </button>
                        {whyPopoverOpen === "apply" ? (
                          <div
                            id={WHY_POPOVER_ID}
                            ref={whyPopoverRef}
                            role="dialog"
                            aria-label="Budget explanation"
                            className="absolute left-0 top-[calc(100%+6px)] z-20 w-64 rounded-md border border-zinc-700 bg-zinc-950/95 px-2.5 py-2 text-[11px] text-zinc-200 whitespace-pre-line shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                          >
                            {budgetWhyTooltip}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {deltasAt30d ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className={`rounded-md border bg-zinc-950/80 px-3 py-2 text-xs ${lineClass(deltasAt30d.lifeScore)}`}>
                    {t("deltaLife30d", locale)}: {deltasAt30d.lifeScore > 0 ? "+" : ""}
                    {deltasAt30d.lifeScore.toFixed(1)}
                  </div>
                  <div className={`rounded-md border bg-zinc-950/80 px-3 py-2 text-xs ${lineClass(-deltasAt30d.risk)}`}>
                    {t("deltaRisk30d", locale)}: {deltasAt30d.risk > 0 ? "+" : ""}
                    {deltasAt30d.risk.toFixed(1)}
                  </div>
                  <div className={`rounded-md border bg-zinc-950/80 px-3 py-2 text-xs ${lineClass(-deltasAt30d.burnout)}`}>
                    {t("deltaBurnout30d", locale)}: {deltasAt30d.burnout > 0 ? "+" : ""}
                    {deltasAt30d.burnout.toFixed(1)}
                  </div>
                </div>
              ) : null}
            </details>
          ) : null}
          <div className="my-4 border-t border-zinc-800/80" />

          <section>
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Scenario library</p>
            <ScenarioLibraryPanel
              locale={locale}
              isPro={isPro}
              loading={libraryLoading}
              rows={libraryRows}
              selectedIds={selectedScenarioIds}
              onToggleSelect={toggleScenarioSelect}
              onRefresh={() => void loadScenarioLibrary()}
            />
          </section>
        </>
      ) : (
        <div className="flex h-52 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
          {t("projectionUnavailable", locale)}
        </div>
      )}
      <NewScenarioModal
        open={newScenarioOpen}
        saving={newScenarioSaving}
        error={newScenarioError}
        errorId={newScenarioErrorId}
        onClose={() => {
          setNewScenarioOpen(false);
          setNewScenarioError(null);
          setNewScenarioErrorId(null);
        }}
        onSave={(payload) => {
          void saveNewScenario(payload);
        }}
      />
      <UpgradePromptModal
        open={upgradePromptOpen}
        capability={upgradePromptCapability}
        locale={locale}
        onClose={() => {
          setUpgradePromptOpen(false);
          setUpgradePromptCapability(null);
        }}
      />
      <ModalShell
        open={projectionHelpOpen}
        onClose={() => setProjectionHelpOpen(false)}
        ariaLabel="Projection help"
        panelClassName="max-w-xl p-5 sm:p-6"
      >
        {({ requestClose }) => (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-semibold text-zinc-100">Scenario projection help</h4>
              <button
                type="button"
                onClick={() => requestClose()}
                className="min-h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm text-zinc-300">
              <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">BASE trajectory</p>
                <p className="mt-1">
                  BASE is the default forward path from your current state without additional intervention changes.
                </p>
              </section>
              <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Scenario comparison</p>
                <p className="mt-1">
                  Compare overlays saved Scenario B against BASE (Scenario A) and shows deltas at day 30.
                </p>
              </section>
              <section className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">How to use</p>
                <p className="mt-1">Save Scenario: snapshot current/custom/protocol trajectory into the library.</p>
                <p className="mt-1">Compare: turn ON, choose Scenario B, then review Δ LifeScore, Δ Risk, and guardrail change.</p>
                <p className="mt-1">Generate Protocol: build the 24h/48h/72h protocol in the protocol section and optionally save it.</p>
              </section>
            </div>
          </div>
        )}
      </ModalShell>
    </section>
  );
}


