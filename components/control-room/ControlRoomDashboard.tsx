"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { AntiChaosModal } from "@/components/control-room/AntiChaosModal";
import { CalibrationPanel } from "@/components/calibration/CalibrationPanel";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { DiagnosisBreakdownModal } from "@/components/control-room/DiagnosisBreakdownModal";
import { ProjectionScenarioChart } from "@/components/control-room/ProjectionScenarioChart";
import { PatternMonitor } from "@/components/control-room/PatternMonitor";
import { PanelState } from "@/components/control-room/PanelState";
import { SparklineChart } from "@/components/control-room/SparklineChart";
import { StatCard } from "@/components/control-room/StatCard";
import { StatusBadge } from "@/components/control-room/StatusBadge";
import { SystemResetModal } from "@/components/control-room/SystemResetModal";
import { ExportSystemLogModal } from "@/components/control-room/ExportSystemLogModal";
import { DeleteAccountModal } from "@/components/control-room/DeleteAccountModal";
import {
  SystemEventLogPanel,
  type Filter as EventLogFilter,
  type SystemEventLogItem,
} from "@/components/control-room/SystemEventLogPanel";
import { ModelTransparencyPanel } from "@/components/control-room/ModelTransparencyPanel";
import { SystemStatusBar } from "@/components/control-room/SystemStatusBar";
import { RequiredActionsPanel } from "@/components/control-room/RequiredActionsPanel";
import { ConstraintTracePanel } from "@/components/control-room/ConstraintTracePanel";
import { ViewModeToggle } from "@/components/control-room/ViewModeToggle";
import { StateExplanationModal } from "@/components/control-room/StateExplanationModal";
import { UpgradePromptModal } from "@/components/control-room/UpgradePromptModal";
import { ErrorIdNotice } from "@/components/ui/ErrorIdNotice";
import { GlossaryModal } from "@/components/ui/GlossaryModal";
import { PlanBadge } from "@/components/ui/PlanBadge";
import { SystemReportModal } from "@/components/ui/SystemReportModal";
import { formatContributionValue, formatFactorLabel } from "@/lib/control-room/formatting";
import { buildStateExplanation } from "@/lib/control-room/stateExplanation";
import { normalizeConstraintForTrace, type ConstraintTraceItem } from "@/lib/control-room/constraintTrace";
import { deriveIntegritySummary } from "@/lib/control-room/integritySummary";
import { buildDirectives } from "@/lib/directives";
import { buildSystemReport } from "@/lib/systemReport";
import { getCalibrationStage } from "@/lib/calibrationStage";
import { deriveSystemStatus } from "@/lib/control-room/systemStatus";
import { deriveRequiredActions } from "@/lib/control-room/requiredActions";
import type { ProtocolObject } from "@/lib/engine/protocolRules";
import { t, type Locale } from "@/lib/i18n";
import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
import type {
  ControlRoomBreakdown,
  ControlRoomCalibration,
  ControlRoomDiagnosis,
  ControlRoomExecutiveSummary,
  ControlRoomPatterns,
} from "@/lib/control-room/types";
import { addDaysISO, getLocalISODate, parseISODateParam } from "@/lib/date/localDate";
import { DEFAULT_TZ_OFFSET_MINUTES, getDayKeyAtOffset } from "@/lib/date/dayKey";
import { useViewMode } from "@/hooks/useViewMode";

type RoomStatus = "Stable" | "Overloaded" | "Declining" | "Growth";
type RecommendedOperatingMode = "BUILD" | "CONSOLIDATE" | "STABILIZE" | "CAUTION";

type SetupStatePayload = {
  onboardingCompleted: boolean;
  calibrationCheckinsDone: number;
  calibrationCheckinsNeeded: number;
  confidence: number;
  confidencePct: number;
};

type OperatingModePresentation = {
  mode: RecommendedOperatingMode;
  accentClass: string;
  directives: [string, string, string];
};

const OPERATING_MODE_PRESET: Record<RecommendedOperatingMode, OperatingModePresentation> = {
  BUILD: {
    mode: "BUILD",
    accentClass: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    directives: [
      "Increase load only while recovery stays at or above load.",
      "Keep stress increments bounded and review next-day risk drift.",
      "Maintain workout progression inside decision budget limits.",
    ],
  },
  CONSOLIDATE: {
    mode: "CONSOLIDATE",
    accentClass: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
    directives: [
      "Hold current load profile and preserve recovery surplus.",
      "Keep stress intake low and avoid unnecessary volatility.",
      "Use moderate workout intensity without escalation.",
    ],
  },
  STABILIZE: {
    mode: "STABILIZE",
    accentClass: "text-amber-200 border-amber-500/40 bg-amber-500/10",
    directives: [
      "Reduce load pressure until recovery re-aligns with demand.",
      "Cap stress exposure and remove optional overload inputs.",
      "Use low-variance training volume for the next cycle.",
    ],
  },
  CAUTION: {
    mode: "CAUTION",
    accentClass: "text-rose-200 border-rose-500/40 bg-rose-500/10",
    directives: [
      "Freeze additional load and prioritize stabilization actions.",
      "Minimize stressors until guardrail returns to OPEN.",
      "Do not escalate workout intensity above current baseline.",
    ],
  },
};

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

type ProjectionModifiers = {
  sleepMinutesDelta: number;
  deepWorkPctDelta: number;
  stressDelta: number;
  workoutForcedOff?: boolean;
};

type ProjectionCustomResponse =
  | {
      ok: true;
      data: {
        custom: ProjectionPoint[] | null;
        deltasAt30d: { lifeScore: number; risk: number; burnout: number } | null;
      };
    }
  | { ok: false; error?: string; message?: string };

type ControlRoomData = {
  userId: string;
  demoMode?: boolean;
  isAdmin: boolean;
  plan: "FREE" | "PRO";
  featureAccess: {
    antiChaos: boolean;
    forecast30d: boolean;
    allStats: boolean;
    history: boolean;
  };
  todayCheckInExists: boolean;
  telemetry: {
    quality: "High" | "Medium" | "Low";
    filledFields: number;
    totalFields: number;
    estimated: boolean;
  };
  checkinInputs: {
    deepWorkMin: number;
    workout: number;
    stress: number;
  };
  checkinSnapshot: {
    date: string;
    sleepHours: number | null;
    sleepQuality: number | null;
    deepWorkMin: number | null;
    learningMin: number | null;
    stress: number | null;
    workout: number | null;
    moneyDelta: number | null;
  } | null;
  systemMetrics: {
    load: number;
    recovery: number;
    risk: number;
  };
  diagnosis: ControlRoomDiagnosis;
  executiveSummary: ControlRoomExecutiveSummary;
  patterns: ControlRoomPatterns;
  calibration: ControlRoomCalibration;
  modelConfidence: {
    confidence: number;
    notes: string[];
    components: {
      coverageScore: number;
      completenessScore: number;
      stabilityScore: number;
      convergenceScore: number;
      patternScore: number;
      sensitivityScore: number;
    };
  };
  guardrail: {
    level: 0 | 1 | 2;
    label: "OPEN" | "CAUTION" | "LOCKDOWN";
    reasons: string[];
    avgRisk14d: number;
  };
  integrity: {
    score: number;
    state: "STABLE" | "DRIFT" | "STRAIN";
    violations: string[];
    hasActiveProtocol: boolean;
  };
  adaptiveBaseline: {
    riskOffset: number;
    recoveryOffset: number;
  };
  breakdown: ControlRoomBreakdown;
  date: string;
  status: RoomStatus;
  snapshot: {
    id: string;
    lifeScore: number;
    stats: {
      energy: number;
      focus: number;
      discipline: number | null;
      finance: number | null;
      growth: number | null;
    };
    configVersion: number;
  };
  topContributions: Array<{
    statType: string;
    factorType: string;
    contribution: number;
    impact: number;
  }>;
  series7d: Array<{
    date: string;
    lifeScore: number;
    stats: {
      energy: number;
      focus: number;
      discipline: number;
      finance: number;
      growth: number;
    };
  }>;
  series30d: Array<{
    date: string;
    lifeScore: number;
    stats: {
      energy: number;
      focus: number;
      discipline: number;
      finance: number;
      growth: number;
    };
  }>;
};

type ProjectionApiResponse =
  | { ok: true; data: { projection30d: Projection30d | null } }
  | { ok: false; error?: string; message?: string };

type EnvelopeApiResponse =
  | {
      ok: true;
      data: {
        envelope72h: RiskEnvelopePoint[] | null;
        impact72h: EnvelopeImpactPayload | null;
        decisionBudget: DecisionBudget72h | null;
      };
    }
  | { ok: false; error?: string; message?: string };

type ApiResponse =
  | { ok: true; data: ControlRoomData }
  | {
      ok: false;
      error?: string;
      code?: string;
      message?: string;
      date?: string;
      hasAnyCheckins?: boolean;
    };

type ProtocolRunRecord = {
  id: string;
  createdAt: string;
  horizonHours: number;
  mode?: "STANDARD" | "STABILIZE" | string;
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  confidence: number;
  inputs: unknown;
  protocol: ProtocolObject;
  appliedAt: string | null;
  outcome?: {
    riskDelta?: number;
    recoveryDelta?: number;
    loadDelta?: number;
    guardrailAtApply?: string;
    guardrailNow?: string;
  } | null;
  integrityAtEnd?: {
    finalScore?: number;
    finalState?: "STABLE" | "DRIFT" | "STRAIN" | string;
  } | null;
};

type SystemSnapshotRecord = {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

type SystemMetricBarProps = {
  label: string;
  value: number;
  hint: string;
  tone: "cyan" | "green" | "rose";
  tooltip?: string;
  uninitialized?: boolean;
};

function SystemMetricBar({ label, value, hint, tone, tooltip, uninitialized = false }: SystemMetricBarProps) {
  const width = Math.max(0, Math.min(100, value));
  const toneClass =
    tone === "green"
      ? "bg-emerald-400"
      : tone === "rose"
        ? "bg-rose-400"
        : "bg-cyan-400";

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3" title={tooltip}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
        <p className="text-sm font-medium text-zinc-100">{uninitialized ? "—" : value.toFixed(1)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={["h-full", toneClass].join(" ")} style={{ width: `${uninitialized ? 0 : width}%` }} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{uninitialized ? "Insufficient data." : hint}</p>
    </article>
  );
}

export type ControlRoomDashboardProps = {
  userId?: string;
  userEmail?: string | null;
  demoMode?: boolean;
  appVersion?: string;
  supportEmail?: string | null;
  initialSelectedDate?: string;
  latestCheckinDate?: string | null;
  initialActiveProtocol?: ProtocolRunRecord | null;
};

export function ControlRoomDashboard({
  userId = "demo-user",
  userEmail = null,
  demoMode = false,
  appVersion = "dev",
  supportEmail = null,
  initialSelectedDate,
  latestCheckinDate = null,
  initialActiveProtocol = null,
}: ControlRoomDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinNotFoundDate, setCheckinNotFoundDate] = useState<string | null>(null);
  const [hasAnyCheckins, setHasAnyCheckins] = useState<boolean | null>(null);
  const [data, setData] = useState<ControlRoomData | null>(null);
  const [antiChaosOpen, setAntiChaosOpen] = useState(false);
  const [antiChaosProtocol, setAntiChaosProtocol] = useState<AntiChaosProtocol | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [whyPopoverOpen, setWhyPopoverOpen] = useState(false);
  const whyPopoverRef = useRef<HTMLDivElement | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [projection30d, setProjection30d] = useState<Projection30d | null>(null);
  const [envelope72h, setEnvelope72h] = useState<RiskEnvelopePoint[] | null>(null);
  const [impact72h, setImpact72h] = useState<EnvelopeImpactPayload | null>(null);
  const [decisionBudget72h, setDecisionBudget72h] = useState<DecisionBudget72h | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customProjection, setCustomProjection] = useState<ProjectionPoint[] | null>(null);
  const [customDeltasAt30d, setCustomDeltasAt30d] = useState<{
    lifeScore: number;
    risk: number;
    burnout: number;
  } | null>(null);
  const [projectionModifiers, setProjectionModifiers] = useState<ProjectionModifiers>({
    sleepMinutesDelta: 0,
    deepWorkPctDelta: 0,
    stressDelta: 0,
  });
  const [devPlanOverride, setDevPlanOverride] = useState<"free" | "pro" | null>(null);
  const [devPlanSaving, setDevPlanSaving] = useState(false);
  const [devSimSeed, setDevSimSeed] = useState("");
  const [devSimOverwrite, setDevSimOverwrite] = useState(true);
  const [devSimLoading, setDevSimLoading] = useState(false);
  const [devSimNotice, setDevSimNotice] = useState<string | null>(null);
  const [devSimError, setDevSimError] = useState<string | null>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInModalDate, setCheckInModalDate] = useState<string | null>(null);
  const [setupState, setSetupState] = useState<SetupStatePayload | null>(null);
  const [setupStateUnavailable, setSetupStateUnavailable] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [checkinUpdateNotice, setCheckinUpdateNotice] = useState<{ title: string; body: string } | null>(null);
  const [guardrailTransitionNotice, setGuardrailTransitionNotice] = useState<{ title: string; body: string } | null>(null);
  const [protocolHorizon, setProtocolHorizon] = useState<24 | 48 | 72>(24);
  const [protocolCurrent, setProtocolCurrent] = useState<ProtocolRunRecord | null>(initialActiveProtocol);
  const [protocolRuns, setProtocolRuns] = useState<ProtocolRunRecord[]>(initialActiveProtocol ? [initialActiveProtocol] : []);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [protocolApplying, setProtocolApplying] = useState(false);
  const [protocolNotice, setProtocolNotice] = useState<string | null>(null);
  const [directivesCopied, setDirectivesCopied] = useState(false);
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [protocolErrorId, setProtocolErrorId] = useState<string | null>(null);
  const [protocolLogOpen, setProtocolLogOpen] = useState(false);
  const [protocolLogExpandedId, setProtocolLogExpandedId] = useState<string | null>(null);
  const [stabilizeLoading, setStabilizeLoading] = useState(false);
  const [stabilizeNotice, setStabilizeNotice] = useState<string | null>(null);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptCapability, setUpgradePromptCapability] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SystemSnapshotRecord[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [snapshotCopiedId, setSnapshotCopiedId] = useState<string | null>(null);
  const [systemEvents, setSystemEvents] = useState<SystemEventLogItem[]>([]);
  const [systemEventsLoading, setSystemEventsLoading] = useState(false);
  const [systemEventsError, setSystemEventsError] = useState<string | null>(null);
  const [eventLogFilter, setEventLogFilter] = useState<EventLogFilter>("all");
  const [stateExplanationOpen, setStateExplanationOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [tzOffsetMinutes, setTzOffsetMinutes] = useState<number>(DEFAULT_TZ_OFFSET_MINUTES);
  const locale: Locale = "en";
  const { mode: viewMode, setMode: setViewMode } = useViewMode();
  const [reloadKey, setReloadKey] = useState(0);
  const [operatorBriefDismissed, setOperatorBriefDismissed] = useState(false);
  const [calibrationStripDismissed, setCalibrationStripDismissed] = useState(false);
  const whyPopoverId = "diagnosis-why-popover";
  const previousGuardrailRef = useRef<string | null>(null);
  const previousIntegrityStateRef = useRef<"STABLE" | "DRIFT" | "STRAIN" | string | null>(null);
  const guardrailTransitionTimeoutRef = useRef<number | null>(null);
  const [recentGuardrailTransition, setRecentGuardrailTransition] = useState(false);
  const selectedDate = parseISODateParam(searchParams.get("date")) ?? initialSelectedDate ?? getLocalISODate();
  const showDevDateNavigator =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SHOW_DEV_CONTROLS === "true" &&
    Boolean(data?.isAdmin);
  const isDevelopment = process.env.NODE_ENV === "development";
  const canSeeAdminDebug = isDevelopment && Boolean(data?.isAdmin);
  const isSimplifiedView = viewMode === "simplified";
  const isDemoReadOnly = demoMode || Boolean(data?.demoMode);
  const todayDayKey = useMemo(() => getDayKeyAtOffset(new Date(), tzOffsetMinutes), [tzOffsetMinutes]);

  useEffect(() => {
    const detectedOffset = -new Date().getTimezoneOffset();
    if (Number.isFinite(detectedOffset)) {
      setTzOffsetMinutes(Math.trunc(detectedOffset));
    }
  }, []);

  const operatorBriefStorageKey = useMemo(() => `lifeos.operator_brief.dismissed.${userId}`, [userId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(operatorBriefStorageKey);
      setOperatorBriefDismissed(stored === "1");
    } catch {
      setOperatorBriefDismissed(false);
    }
  }, [operatorBriefStorageKey]);

  const setDateInUrl = (isoDate: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", isoDate);
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
  };

  const openCheckInModal = (dateISO: string) => {
    if (isDemoReadOnly) return;
    setCheckInModalDate(dateISO);
    setCheckInModalOpen(true);
  };

  const closeCheckInModal = () => {
    setCheckInModalOpen(false);
  };

  const handleCheckInSaved = () => {
    const dateISO = checkInModalDate ?? selectedDate;
    const needed = Math.max(1, setupState?.calibrationCheckinsNeeded ?? 7);
    const previousDone = Math.max(0, setupState?.calibrationCheckinsDone ?? data?.series7d.length ?? 0);
    const projectedDone = Math.min(needed, previousDone + 1);
    if (projectedDone < 2) {
      setCheckinUpdateNotice({
        title: "System updated",
        body: `Baseline calibration: ${projectedDone}/${needed} complete. Confidence limited until baseline stabilizes.`,
      });
    } else {
      setCheckinUpdateNotice(null);
    }
    setCheckInModalOpen(false);
    setCheckInModalDate(null);
    setCheckinNotFoundDate(null);
    setHasAnyCheckins(true);
    setDateInUrl(dateISO);
    setReloadKey((current) => current + 1);
    router.refresh();
    void loadSystemEvents();
  };

  useEffect(() => {
    setWhyPopoverOpen(false);
  }, [selectedDate, reloadKey]);

  useEffect(() => {
    if (!checkinUpdateNotice) return;
    const timeoutId = window.setTimeout(() => {
      setCheckinUpdateNotice(null);
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [checkinUpdateNotice]);

  useEffect(() => {
    if (!guardrailTransitionNotice) return;
    if (guardrailTransitionTimeoutRef.current) {
      window.clearTimeout(guardrailTransitionTimeoutRef.current);
    }
    guardrailTransitionTimeoutRef.current = window.setTimeout(() => {
      setGuardrailTransitionNotice(null);
      setRecentGuardrailTransition(false);
      guardrailTransitionTimeoutRef.current = null;
    }, 8000);
    return () => {
      if (guardrailTransitionTimeoutRef.current) {
        window.clearTimeout(guardrailTransitionTimeoutRef.current);
        guardrailTransitionTimeoutRef.current = null;
      }
    };
  }, [guardrailTransitionNotice]);

  useEffect(() => {
    const currentState = data?.guardrail?.label ?? null;
    if (!currentState) return;

    const previousState = previousGuardrailRef.current;
    if (!previousState) {
      previousGuardrailRef.current = currentState;
      return;
    }
    if (previousState === currentState) return;

    previousGuardrailRef.current = currentState;

    const message =
      previousState === "CAUTION" && currentState === "OPEN"
        ? "Guardrail relaxed - stability restored."
        : `Guardrail: ${previousState} → ${currentState} (risk threshold crossed).`;

    setGuardrailTransitionNotice({
      title: "State change detected",
      body: message,
    });
    setRecentGuardrailTransition(true);
    setSystemEvents((current) => [
      {
        id: `guardrail-transition-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "protocol" as const,
        type: "GUARDRAIL_TRANSITION" as const,
        message: `Guardrail transition: ${previousState} → ${currentState}.`,
        status: "COMPLETED" as const,
      },
      ...current,
    ].slice(0, 10));
  }, [data?.guardrail?.label]);

  useEffect(() => {
    if (!whyPopoverOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!whyPopoverRef.current) return;
      if (!whyPopoverRef.current.contains(event.target as Node)) {
        setWhyPopoverOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWhyPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [whyPopoverOpen]);

  const handleResetDone = () => {
    setResetModalOpen(false);
    setResetNotice("System reset complete. Start a new baseline with a check-in.");
    setCheckinNotFoundDate(null);
    setHasAnyCheckins(false);
    setData(null);
    setReloadKey((current) => current + 1);
    setDateInUrl(todayDayKey);
    openCheckInModal(todayDayKey);
    router.refresh();
    void loadSystemEvents();
  };

  const handleAccountDeleted = async () => {
    setDeleteAccountModalOpen(false);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      window.location.href = "/";
    }
  };

  const scrollToId = (sectionId: string, focusId?: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!focusId) return;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const focusTarget = document.getElementById(focusId);
        if (focusTarget instanceof HTMLElement) {
          focusTarget.focus();
        }
      }, 180);
    });
  };

  const handleRequiredAction = (action: "go-protocol-generate" | "go-protocol-apply" | "go-checkin") => {
    if (action === "go-checkin") {
      if (isDemoReadOnly) return;
      openCheckInModal(todayDayKey);
      return;
    }
    if (action === "go-protocol-apply") {
      scrollToId("operational-protocol", recommendedProtocol ? "apply-protocol-btn" : "generate-protocol-btn");
      return;
    }
    scrollToId("operational-protocol", "generate-protocol-btn");
  };

  const scrollToUpdatedState = () => {
    const anchor = document.getElementById("state-overview");
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const loadSetupState = useCallback(async () => {
    try {
      setSetupStateUnavailable(false);
      const response = await fetch("/api/setup/state", { cache: "no-store" });
      const payload = (await response.json()) as
        | { ok: true; data: SetupStatePayload }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setSetupState(null);
        setSetupStateUnavailable(true);
        return;
      }
      setSetupState(payload.data);
    } catch {
      setSetupState(null);
      setSetupStateUnavailable(true);
    }
  }, []);

  const loadProtocolRuns = useCallback(async () => {
    try {
      setProtocolError(null);
      setProtocolErrorId(null);
      const response = await fetch("/api/protocol/runs?limit=10", { cache: "no-store" });
      const payload = (await response.json()) as
        | { ok: true; data: ProtocolRunRecord[] }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setProtocolRuns([]);
        if (!protocolCurrent) {
          setProtocolCurrent(null);
        }
        setProtocolError(payload.ok ? null : payload.error ?? "Failed to load protocol log.");
        return;
      }
      setProtocolRuns(payload.data);
      if (!protocolCurrent && payload.data.length > 0) {
        setProtocolCurrent(payload.data[0]);
      }
    } catch {
      setProtocolRuns([]);
      if (!protocolCurrent) {
        setProtocolCurrent(null);
      }
      setProtocolError("Failed to load protocol log.");
      setProtocolErrorId(null);
    }
  }, [protocolCurrent]);

  const loadSystemEvents = useCallback(async () => {
    try {
      setSystemEventsLoading(true);
      setSystemEventsError(null);
      const response = await fetch("/api/events", { cache: "no-store" });
      const payload = (await response.json()) as
        | { ok: true; data: SystemEventLogItem[] }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setSystemEvents([]);
        setSystemEventsError(payload.ok ? null : payload.error ?? "Failed to load system events.");
        return;
      }
      setSystemEvents(payload.data);
    } catch {
      setSystemEvents([]);
      setSystemEventsError("Failed to load system events.");
    } finally {
      setSystemEventsLoading(false);
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    try {
      setSnapshotsLoading(true);
      setSnapshotsError(null);
      const response = await fetch("/api/snapshots?limit=5", { cache: "no-store" });
      const payload = (await response.json()) as
        | { ok: true; data: SystemSnapshotRecord[] }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setSnapshots([]);
        setSnapshotsError(payload.ok ? null : payload.error ?? "Failed to load snapshots.");
        return;
      }
      setSnapshots(payload.data);
    } catch {
      setSnapshots([]);
      setSnapshotsError("Failed to load snapshots.");
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  const handleGenerateSnapshot = useCallback(async () => {
    try {
      setSnapshotsError(null);
      setSnapshotNotice(null);
      const response = await fetch("/api/snapshots", { method: "POST" });
      const payload = (await response.json()) as
        | { ok: true; url: string; retryAfterMs?: number }
        | { ok: false; error?: string; retryAfterMs?: number; errorId?: string };
      if (!response.ok || !payload.ok) {
        const errorCode = "error" in payload ? payload.error : undefined;
        const retryAfterMs = "retryAfterMs" in payload ? payload.retryAfterMs : undefined;
        if (errorCode === "RATE_LIMITED") {
          const retrySec = Math.max(1, Math.round((retryAfterMs ?? 0) / 1000));
          setSnapshotsError(`Rate limited. Try again in ~${retrySec}s.`);
          return;
        }
        setSnapshotsError(errorCode ?? "Failed to generate snapshot.");
        return;
      }
      const fullUrl = `${window.location.origin}${payload.url}`;
      setSnapshotNotice(`Snapshot link generated: ${fullUrl}`);
      await loadSnapshots();
    } catch {
      setSnapshotsError("Failed to generate snapshot.");
    }
  }, [loadSnapshots]);

  const handleRevokeSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        setSnapshotsError(null);
        const response = await fetch(`/api/snapshots/${snapshotId}/revoke`, { method: "POST" });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setSnapshotsError(payload.error ?? "Failed to revoke snapshot.");
          return;
        }
        setSnapshotNotice("Snapshot revoked.");
        await loadSnapshots();
      } catch {
        setSnapshotsError("Failed to revoke snapshot.");
      }
    },
    [loadSnapshots]
  );

  const handleCopySnapshotLink = useCallback(async (token: string, snapshotId: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setSnapshotCopiedId(snapshotId);
      window.setTimeout(() => setSnapshotCopiedId((current) => (current === snapshotId ? null : current)), 1500);
    } catch {
      setSnapshotsError("Failed to copy snapshot link.");
    }
  }, []);

  useEffect(() => {
    void loadSetupState();
  }, [loadSetupState, reloadKey, userId]);

  useEffect(() => {
    if (!data) return;
    if (!protocolLogOpen && protocolRuns.length > 0 && reloadKey === 0) return;
    void loadProtocolRuns();
  }, [data, loadProtocolRuns, reloadKey, protocolLogOpen, protocolRuns.length]);

  useEffect(() => {
    if (!data) return;
    void loadSystemEvents();
  }, [data, reloadKey, loadSystemEvents]);

  useEffect(() => {
    if (!data) return;
    void loadSnapshots();
  }, [data, reloadKey, loadSnapshots]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setCheckinNotFoundDate(null);
      setHasAnyCheckins(null);

      try {
        const response = await fetch(
          `/api/control-room?userId=${userId}&date=${selectedDate}&tzOffsetMinutes=${tzOffsetMinutes}`,
          {
            cache: "no-store",
          }
        );

        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !("ok" in payload) || !payload.ok) {
          if ("code" in payload && payload.code === "CHECKIN_NOT_FOUND") {
            const missingDate = payload.date ?? selectedDate;
            const anyCheckins = payload.hasAnyCheckins ?? null;
            setCheckinNotFoundDate(missingDate);
            setHasAnyCheckins(anyCheckins);
            setCheckInModalDate(missingDate);
            setCheckInModalOpen(true);

            if (anyCheckins && latestCheckinDate) {
              const fallbackResponse = await fetch(
                `/api/control-room?userId=${userId}&date=${latestCheckinDate}&tzOffsetMinutes=${tzOffsetMinutes}`,
                {
                  cache: "no-store",
                }
              );
              const fallbackPayload = (await fallbackResponse.json()) as ApiResponse;
              if (fallbackResponse.ok && "ok" in fallbackPayload && fallbackPayload.ok) {
                setData(fallbackPayload.data);
                return;
              }
            }

            setData(null);
            return;
          }

          const message =
            ("message" in payload ? payload.message : undefined) ??
            ("error" in payload ? payload.error : undefined) ??
            "Failed to load control room.";
          throw new Error(message ?? "Failed to load control room.");
        }

        setData(payload.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load control room.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedDate, reloadKey, userId, latestCheckinDate, tzOffsetMinutes]);

  useEffect(() => {
    if (!showDevDateNavigator) return;
    const loadDevPlan = async () => {
      try {
        const response = await fetch("/api/dev/get-plan", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          data?: { plan: "free" | "pro" | null };
        };
        if (response.ok && payload.ok) {
          setDevPlanOverride(payload.data?.plan ?? null);
        }
      } catch {
        setDevPlanOverride(null);
      }
    };
    void loadDevPlan();
  }, [showDevDateNavigator, reloadKey]);

  const setDevPlan = async (plan: "free" | "pro") => {
    if (!showDevDateNavigator) return;
    try {
      setDevPlanSaving(true);
      const response = await fetch("/api/dev/set-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        throw new Error("Failed to set dev plan override.");
      }
      setDevPlanOverride(plan);
      setReloadKey((value) => value + 1);
      router.refresh();
    } catch (setPlanError) {
      const message = setPlanError instanceof Error ? setPlanError.message : "Failed to set dev plan override.";
      setError(message);
    } finally {
      setDevPlanSaving(false);
    }
  };

  const runDevSimulation = async (mode: "simulate" | "clear") => {
    if (!showDevDateNavigator || !data) return;
    try {
      setDevSimLoading(true);
      setDevSimError(null);
      setDevSimNotice(null);
      const response = await fetch("/api/dev/simulate-30d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.userId,
          endDateISO: selectedDate,
          days: 30,
          seed: devSimSeed.trim().length > 0 ? devSimSeed.trim() : `${selectedDate}`,
          overwrite: devSimOverwrite,
          mode,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; data?: { mode?: string }; message?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.error ?? "Failed to run dev simulation.");
      }
      setDevSimNotice(mode === "simulate" ? "Simulated 30 days and recalculated snapshots." : "Cleared 30-day generated window.");
      setReloadKey((current) => current + 1);
    } catch (simError) {
      const message = simError instanceof Error ? simError.message : "Failed to run dev simulation.";
      setDevSimError(message);
    } finally {
      setDevSimLoading(false);
    }
  };

  const generateOperationalProtocol = async () => {
    try {
      setProtocolLoading(true);
      setProtocolError(null);
      setProtocolErrorId(null);
      setProtocolNotice(null);
      const response = await fetch("/api/protocol/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horizonHours: protocolHorizon, mode: "STANDARD" }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: ProtocolRunRecord }
        | { ok: false; error?: string; errorId?: string };
      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.error === "SYSTEM_FAULT" && payload.errorId) {
          setProtocolError("System fault.");
          setProtocolErrorId(payload.errorId);
          return;
        }
        throw new Error(payload.ok ? "Failed to generate protocol." : payload.error ?? "Failed to generate protocol.");
      }
      setProtocolCurrent(payload.data);
      setProtocolRuns((prev) => [payload.data, ...prev.filter((item) => item.id !== payload.data.id)].slice(0, 10));
      await loadSystemEvents();
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Failed to generate protocol.";
      setProtocolError(message);
      setProtocolErrorId(null);
    } finally {
      setProtocolLoading(false);
    }
  };

  const applyOperationalProtocol = async () => {
    if (!recommendedProtocol) return;
    try {
      setProtocolApplying(true);
      setProtocolError(null);
      setProtocolErrorId(null);
      const response = await fetch("/api/protocol/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolRunId: recommendedProtocol.id }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: ProtocolRunRecord }
        | { ok: false; error?: string; errorId?: string };
      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.error === "SYSTEM_FAULT" && payload.errorId) {
          setProtocolError("System fault.");
          setProtocolErrorId(payload.errorId);
          return;
        }
        throw new Error(payload.ok ? "Failed to apply protocol." : payload.error ?? "Failed to apply protocol.");
      }
      setProtocolCurrent(payload.data);
      setProtocolRuns((prev) => prev.map((row) => (row.id === payload.data.id ? payload.data : row)));
      setProtocolLogExpandedId(payload.data.id);
      setProtocolNotice("Protocol applied.");
      setSystemEvents((current) =>
        [
          {
            id: `protocol-applied-${payload.data.id}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: "protocol" as const,
            type: "PROTOCOL_APPLIED" as const,
            message: `Protocol applied: ${payload.data.guardrailState} (${payload.data.horizonHours}h), ${payload.data.mode}.`,
            status: "APPLIED" as const,
          },
          ...current,
        ].slice(0, 10)
      );
      await loadSystemEvents();
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Failed to apply protocol.";
      setProtocolError(message);
      setProtocolErrorId(null);
    } finally {
      setProtocolApplying(false);
    }
  };

  const isProtocolRunActive = (run: ProtocolRunRecord | null): boolean => {
    if (!run?.appliedAt) return false;
    const expiresAt = new Date(run.appliedAt).getTime() + run.horizonHours * 60 * 60 * 1000;
    return Date.now() < expiresAt;
  };
  const activeProtocol = useMemo(() => {
    const candidates: ProtocolRunRecord[] = [];
    if (protocolCurrent) candidates.push(protocolCurrent);
    for (const run of protocolRuns) {
      if (!candidates.some((item) => item.id === run.id)) {
        candidates.push(run);
      }
    }
    return candidates.find((run) => isProtocolRunActive(run)) ?? null;
  }, [protocolCurrent, protocolRuns]);
  const recommendedProtocol = protocolCurrent;
  const recommendedDiffersFromActive = Boolean(
    recommendedProtocol && (!activeProtocol || recommendedProtocol.id !== activeProtocol.id)
  );
  const recommendedMatchesActive = Boolean(
    recommendedProtocol && activeProtocol && recommendedProtocol.id === activeProtocol.id
  );
  const enforcementToneClass =
    data?.guardrail.label === "LOCKDOWN"
      ? "border-rose-500/40 shadow-[0_0_0_1px_rgba(244,63,94,0.22)]"
      : data?.guardrail.label === "CAUTION"
        ? "border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.22)]"
        : "border-cyan-500/30 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]";
  const requiresProtocolGenerate = !isDemoReadOnly && !activeProtocol && !recommendedProtocol;
  const requiresProtocolApply = !isDemoReadOnly && !activeProtocol && Boolean(recommendedProtocol);
  const stabilizeActive = Boolean(activeProtocol && activeProtocol.mode === "STABILIZE" && isProtocolRunActive(activeProtocol));
  const isProPlan = data?.plan === "PRO";
  const showUpgradePrompt = (capability: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("upgrade_prompt_shown", { capability });
    }
    setUpgradePromptCapability(capability);
    setUpgradePromptOpen(true);
  };
  const stabilizeActiveUntilText = useMemo(() => {
    if (!stabilizeActive || !activeProtocol?.appliedAt) return null;
    const activeUntil = new Date(
      new Date(activeProtocol.appliedAt).getTime() + activeProtocol.horizonHours * 60 * 60 * 1000
    ).toLocaleString();
    return `Stabilize already active until ${activeUntil}`;
  }, [activeProtocol?.appliedAt, activeProtocol?.horizonHours, stabilizeActive]);

  useEffect(() => {
    const currentIntegrityState = data?.integrity?.state ?? null;
    if (!currentIntegrityState || !activeProtocol) {
      previousIntegrityStateRef.current = currentIntegrityState;
      return;
    }
    const previousIntegrityState = previousIntegrityStateRef.current;
    if (!previousIntegrityState) {
      previousIntegrityStateRef.current = currentIntegrityState;
      return;
    }
    if (previousIntegrityState === currentIntegrityState) return;

    const isThresholdDrift =
      (previousIntegrityState === "STABLE" && currentIntegrityState === "DRIFT") ||
      (previousIntegrityState === "DRIFT" && currentIntegrityState === "STRAIN");

    previousIntegrityStateRef.current = currentIntegrityState;
    if (!isThresholdDrift) return;

    setSystemEvents((current) =>
      [
        {
          id: `integrity-transition-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: "integrity" as const,
          type: "INTEGRITY_TRANSITION" as const,
          message: `Integrity drift detected: ${previousIntegrityState} → ${currentIntegrityState}.`,
          status: "COMPLETED" as const,
        },
        ...current,
      ].slice(0, 10)
    );
  }, [activeProtocol, data?.integrity?.state]);

  const applyStabilizeProtocol = async () => {
    if (stabilizeActive) return;
    try {
      setStabilizeLoading(true);
      setStabilizeNotice(null);
      setProtocolError(null);
      setProtocolErrorId(null);

      const generateResponse = await fetch("/api/protocol/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horizonHours: 24, mode: "STABILIZE" }),
      });
      const generatePayload = (await generateResponse.json()) as
        | { ok: true; data: ProtocolRunRecord }
        | { ok: false; error?: string; errorId?: string };
      if (!generateResponse.ok || !generatePayload.ok) {
        if (!generatePayload.ok && generatePayload.error === "SYSTEM_FAULT" && generatePayload.errorId) {
          setProtocolError("System fault.");
          setProtocolErrorId(generatePayload.errorId);
          return;
        }
        throw new Error(generatePayload.ok ? "Failed to generate stabilize protocol." : generatePayload.error ?? "Failed to generate stabilize protocol.");
      }

      const applyResponse = await fetch("/api/protocol/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocolRunId: generatePayload.data.id }),
      });
      const applyPayload = (await applyResponse.json()) as
        | { ok: true; data: ProtocolRunRecord }
        | { ok: false; error?: string; errorId?: string };
      if (!applyResponse.ok || !applyPayload.ok) {
        if (!applyPayload.ok && applyPayload.error === "SYSTEM_FAULT" && applyPayload.errorId) {
          setProtocolError("System fault.");
          setProtocolErrorId(applyPayload.errorId);
          return;
        }
        throw new Error(applyPayload.ok ? "Failed to apply stabilize protocol." : applyPayload.error ?? "Failed to apply stabilize protocol.");
      }

      setProtocolCurrent(applyPayload.data);
      setProtocolRuns((prev) => [applyPayload.data, ...prev.filter((item) => item.id !== applyPayload.data.id)].slice(0, 10));
      setProtocolLogExpandedId(applyPayload.data.id);
      setStabilizeNotice("Stabilize protocol applied (24h)");
      await loadProtocolRuns();
      await loadSystemEvents();
    } catch (stabilizeError) {
      const message = stabilizeError instanceof Error ? stabilizeError.message : "Failed to apply stabilize protocol.";
      setProtocolError(message);
      setProtocolErrorId(null);
    } finally {
      setStabilizeLoading(false);
    }
  };

  useEffect(() => {
    if (!data?.featureAccess.forecast30d) {
      setProjection30d(null);
      setEnvelope72h(null);
      setImpact72h(null);
      setDecisionBudget72h(null);
      setProjectionError(null);
      setProjectionLoading(false);
      setCustomProjection(null);
      setCustomDeltasAt30d(null);
      return;
    }

    const loadProjection = async () => {
      setProjectionLoading(true);
      setProjectionError(null);
      try {
        const [projectionResponse, envelopeResponse] = await Promise.all([
          fetch(
            `/api/projection?userId=${userId}&date=${selectedDate}&currentRisk=${data.systemMetrics.risk.toFixed(1)}`,
            {
              cache: "no-store",
            }
          ),
          fetch(
            `/api/projection/envelope?userId=${userId}&date=${selectedDate}&currentRisk=${data.systemMetrics.risk.toFixed(1)}`,
            {
              cache: "no-store",
            }
          ),
        ]);
        const projectionPayload = (await projectionResponse.json()) as ProjectionApiResponse;
        if (!projectionResponse.ok || !("ok" in projectionPayload) || !projectionPayload.ok) {
          const message =
            ("message" in projectionPayload ? projectionPayload.message : undefined) ??
            ("error" in projectionPayload ? projectionPayload.error : undefined) ??
            "Failed to load 30-day projection.";
          throw new Error(message);
        }
        const envelopePayload = (await envelopeResponse.json()) as EnvelopeApiResponse;
        if (!envelopeResponse.ok || !("ok" in envelopePayload) || !envelopePayload.ok) {
          const message =
            ("message" in envelopePayload ? envelopePayload.message : undefined) ??
            ("error" in envelopePayload ? envelopePayload.error : undefined) ??
            "Failed to load 72-hour risk envelope.";
          throw new Error(message);
        }
        setProjection30d(projectionPayload.data.projection30d);
        setEnvelope72h(envelopePayload.data.envelope72h);
        setImpact72h(envelopePayload.data.impact72h);
        setDecisionBudget72h(envelopePayload.data.decisionBudget);
        setCustomProjection(null);
        setCustomDeltasAt30d(null);
      } catch (projectionFetchError) {
        const message =
          projectionFetchError instanceof Error
            ? projectionFetchError.message
            : "Failed to load 30-day projection.";
        setProjectionError(message);
        setProjection30d(null);
        setEnvelope72h(null);
        setImpact72h(null);
        setDecisionBudget72h(null);
      } finally {
        setProjectionLoading(false);
      }
    };

    void loadProjection();
  }, [data?.featureAccess.forecast30d, data?.systemMetrics.risk, selectedDate, userId]);

  const applyCustomProjection = async () => {
    if (!data?.featureAccess.forecast30d) return;
    try {
      setCustomLoading(true);
      const response = await fetch("/api/projection/custom", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId,
          date: selectedDate,
          modifiers: {
            ...projectionModifiers,
            workoutForcedOff: data.guardrail.level === 2,
          },
        }),
      });
      const payload = (await response.json()) as ProjectionCustomResponse;
      if (!response.ok || !("ok" in payload) || !payload.ok) {
        const message =
          ("message" in payload ? payload.message : undefined) ??
          ("error" in payload ? payload.error : undefined) ??
          "Failed to compute custom projection.";
        throw new Error(message);
      }
      setCustomProjection(payload.data.custom);
      setCustomDeltasAt30d(payload.data.deltasAt30d);
    } catch (customProjectionError) {
      const message =
        customProjectionError instanceof Error
          ? customProjectionError.message
          : "Failed to compute custom projection.";
      setProjectionError(message);
      setCustomProjection(null);
      setCustomDeltasAt30d(null);
    } finally {
      setCustomLoading(false);
    }
  };

  const resetCustomProjection = () => {
    setProjectionModifiers({
      sleepMinutesDelta: 0,
      deepWorkPctDelta: 0,
      stressDelta: 0,
    });
    setCustomProjection(null);
    setCustomDeltasAt30d(null);
  };

  const statsWithTrend = useMemo(() => {
    if (!data) return [];
    const prev = data.series7d.length >= 2 ? data.series7d[data.series7d.length - 2] : null;
    const hasPreviousDay = Boolean(prev);
    const current = data.snapshot.stats;

    const core = [
      {
        id: "energy",
        key: "Energy",
        value: current.energy,
        delta: current.energy - (prev?.stats.energy ?? current.energy),
        hasPreviousDay,
      },
      {
        id: "focus",
        key: "Focus",
        value: current.focus,
        delta: current.focus - (prev?.stats.focus ?? current.focus),
        hasPreviousDay,
      },
    ];

    if (!data.featureAccess.allStats) {
      return core;
    }

    return [
      ...core,
      {
        id: "discipline",
        key: "Discipline",
        value: current.discipline ?? 0,
        delta: (current.discipline ?? 0) - (prev?.stats.discipline ?? current.discipline ?? 0),
        hasPreviousDay,
      },
      {
        id: "finance",
        key: "Finance",
        value: current.finance ?? 0,
        delta: (current.finance ?? 0) - (prev?.stats.finance ?? current.finance ?? 0),
        hasPreviousDay,
      },
      {
        id: "growth",
        key: "Growth",
        value: current.growth ?? 0,
        delta: (current.growth ?? 0) - (prev?.stats.growth ?? current.growth ?? 0),
        hasPreviousDay,
      },
    ];
  }, [data]);

  const topFactors = useMemo(() => {
    if (!data) return [];

    return data.topContributions
      .map((item) => {
        const impact = item.impact;
        const formatted = formatContributionValue(impact);
        return {
          key: `${item.factorType}-${item.statType}`,
          label: formatFactorLabel(item.factorType, item.statType),
          impact,
          valueLabel: formatted.label,
          colorClass: formatted.colorClass,
        };
      })
      .filter((item) => Math.abs(item.impact) > 0);
  }, [data]);

  const recommendedMode = useMemo<OperatingModePresentation | null>(() => {
    if (!data) return null;

    const risk = data.systemMetrics.risk;
    const recovery = data.systemMetrics.recovery;
    const load = data.systemMetrics.load;
    const currentLifeScore = data.snapshot.lifeScore;
    const previousLifeScore =
      data.series7d.length > 1 ? data.series7d[data.series7d.length - 2]?.lifeScore ?? currentLifeScore : currentLifeScore;
    const lifeScoreTrendDelta = currentLifeScore - previousLifeScore;
    const lifeScoreBaseline =
      data.series7d.length > 0
        ? data.series7d.reduce((sum, point) => sum + point.lifeScore, 0) / data.series7d.length
        : currentLifeScore;

    const guardrailOpen = data.guardrail.label === "OPEN" && data.guardrail.level === 0;
    const riskHigh = risk >= 65;
    const riskLow = risk < 50;
    const recoveryStrong = recovery >= 65;
    const loadLow = load <= 45;
    const lifeScoreStableOrRising = lifeScoreTrendDelta >= 0;
    const lifeScoreBelowBaseline = currentLifeScore < lifeScoreBaseline;

    if (riskHigh || !guardrailOpen) {
      return OPERATING_MODE_PRESET.CAUTION;
    }

    if (recoveryStrong && riskLow && loadLow) {
      return OPERATING_MODE_PRESET.CONSOLIDATE;
    }

    if (riskLow && recovery >= load && lifeScoreStableOrRising) {
      return OPERATING_MODE_PRESET.BUILD;
    }

    if (load > recovery || lifeScoreBelowBaseline) {
      return OPERATING_MODE_PRESET.STABILIZE;
    }

    return OPERATING_MODE_PRESET.CONSOLIDATE;
  }, [data]);

  const lifeScoreDeltaContext = useMemo(() => {
    if (!data) {
      return {
        ready: false as const,
        remainingCheckins: 7,
      };
    }

    const requiredCheckins = 7;
    const checkinsCount = data.series7d.length;
    if (checkinsCount < requiredCheckins) {
      return {
        ready: false as const,
        remainingCheckins: requiredCheckins - checkinsCount,
      };
    }

    const priorSeries = data.series7d.slice(0, -1);
    if (priorSeries.length === 0) {
      return {
        ready: false as const,
        remainingCheckins: 1,
      };
    }

    const baseline = priorSeries.reduce((sum, point) => sum + point.lifeScore, 0) / priorSeries.length;
    const delta = data.snapshot.lifeScore - baseline;
    const roundedDelta = Math.round(delta * 10) / 10;
    const absDelta = Math.abs(roundedDelta);
    const direction = roundedDelta > 0 ? "up" : roundedDelta < 0 ? "down" : "flat";

    return {
      ready: true as const,
      direction,
      label:
        direction === "up"
          ? `↑ +${absDelta.toFixed(1)} vs baseline`
          : direction === "down"
            ? `↓ -${absDelta.toFixed(1)} vs baseline`
            : `→ 0.0 vs baseline`,
    };
  }, [data]);

  const systemConfidence = useMemo(() => {
    if (!data) {
      return { pct: 0, level: "low" as const };
    }

    const modelConfidence = data.modelConfidence?.confidence;
    const fromModel =
      typeof modelConfidence === "number" && Number.isFinite(modelConfidence)
        ? Math.max(0, Math.min(100, Math.round(modelConfidence * 100)))
        : null;
    const fromDataPoints = data.series7d.length < 3 ? 30 : data.series7d.length < 7 ? 60 : 80;
    const pct = fromModel ?? fromDataPoints;
    const level = pct < 45 ? "low" : pct < 70 ? "med" : "high";

    return { pct, level };
  }, [data]);

  const reportText = useMemo(() => {
    const pathAndQuery =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

    return buildSystemReport({
      ts: new Date().toISOString(),
      pathAndQuery,
      appVersion,
      mode: isDemoReadOnly ? "Simulation" : "Live",
      guardrailState: data?.guardrail?.label ?? null,
      lifeScore: data?.snapshot?.lifeScore ?? null,
      load: data?.systemMetrics?.load ?? null,
      recovery: data?.systemMetrics?.recovery ?? null,
      risk: data?.systemMetrics?.risk ?? null,
      confidencePct: systemConfidence.pct,
      activeProtocol: activeProtocol
        ? {
            state: activeProtocol.guardrailState,
            horizonHours: activeProtocol.horizonHours,
            mode: activeProtocol.mode,
          }
        : null,
      integrity: data?.integrity
        ? {
            score: data.integrity.score,
            state: data.integrity.state,
          }
        : null,
      lastErrorId: protocolErrorId ?? null,
    });
  }, [activeProtocol, appVersion, data, isDemoReadOnly, pathname, protocolErrorId, searchParams, systemConfidence.pct]);

  const isCalibrationDominant = useMemo(() => {
    if (setupStateUnavailable) return true;
    if (!setupState) return false;
    return (
      !setupState.onboardingCompleted ||
      setupState.confidence < 0.6 ||
      setupState.calibrationCheckinsDone < setupState.calibrationCheckinsNeeded
    );
  }, [setupState, setupStateUnavailable]);

  const showOperatorBrief = useMemo(() => {
    if (!data) return false;
    const shouldShowByState =
      data.series7d.length < 2 || isCalibrationDominant || systemConfidence.pct < 60;
    if (!shouldShowByState) return false;
    if (data.series7d.length === 0) return true;
    return !operatorBriefDismissed;
  }, [data, isCalibrationDominant, operatorBriefDismissed, systemConfidence.pct]);
  const isZeroDataState = hasAnyCheckins === false;
  const calibrationCheckinCount = setupState?.calibrationCheckinsDone ?? data?.series7d.length ?? 0;
  const calibrationConfidence = setupState?.confidence ?? data?.modelConfidence?.confidence ?? null;
  const calibrationStage = getCalibrationStage(calibrationCheckinCount, calibrationConfidence);
  const isCalibratingStage = !isZeroDataState && calibrationStage.stage === "CALIBRATING";
  const requiredActionsModel = useMemo(
    () =>
      deriveRequiredActions({
        guardrailState: data?.guardrail.label ?? "OPEN",
        hasActiveProtocol: Boolean(activeProtocol),
        hasRecommendedProtocol: Boolean(recommendedProtocol),
        hasRecentCheckIn: Boolean(data?.checkinSnapshot),
        calibrationStage: calibrationStage.stage,
        readOnly: isDemoReadOnly,
      }),
    [
      activeProtocol,
      calibrationStage.stage,
      data?.checkinSnapshot,
      data?.guardrail.label,
      isDemoReadOnly,
      recommendedProtocol,
    ]
  );
  const authorityStatus = useMemo(
    () =>
      deriveSystemStatus({
        guardrailState: data?.guardrail.label ?? "OPEN",
        integrityState: data?.integrity.state ?? null,
        hasActiveProtocol: Boolean(activeProtocol),
        risk24h: data?.systemMetrics.risk ?? null,
        modelConfidence: systemConfidence.pct,
        calibrationStage: calibrationStage.stage,
      }),
    [
      activeProtocol,
      calibrationStage.stage,
      data?.guardrail.label,
      data?.integrity.state,
      data?.systemMetrics.risk,
      systemConfidence.pct,
    ]
  );

  const dismissOperatorBrief = () => {
    setOperatorBriefDismissed(true);
    try {
      window.localStorage.setItem(operatorBriefStorageKey, "1");
    } catch {
      // no-op: localStorage unavailable
    }
  };

  const recommendedModeActionLine = useMemo(() => {
    if (!data) return "Maintain stable load and monitor signals.";

    const guardrail = data.guardrail.label;
    const recovery = data.systemMetrics.recovery;
    const risk = data.systemMetrics.risk;

    if (guardrail === "LOCKDOWN") {
      return "System overload risk critical — enforce recovery-only protocol.";
    }

    if (guardrail === "CAUTION" && recovery > 65) {
      return "Recovery window active — consolidate baseline, avoid escalation.";
    }

    if (guardrail === "OPEN" && recovery > 70 && risk < 30) {
      return "Safe expansion window — controlled workload acceptable.";
    }

    if (systemConfidence.level === "low") {
      return "Model calibrating — avoid extreme changes.";
    }

    return "Maintain stable load and monitor signals.";
  }, [data, systemConfidence.level]);

  const stabilizationPreview = useMemo(() => {
    if (antiChaosProtocol?.brief) {
      return {
        main: antiChaosProtocol.brief.mainPriority,
        secondary: antiChaosProtocol.brief.secondary[0] ?? "Hold baseline workload profile.",
        recovery: antiChaosProtocol.brief.mandatoryRecovery,
      };
    }

    if (!data) {
      return {
        main: "Hold baseline workload profile.",
        secondary: "Avoid load escalation inputs.",
        recovery: "Protect recovery window.",
      };
    }

    if (data.guardrail.label === "LOCKDOWN") {
      return {
        main: "Freeze overload inputs.",
        secondary: "Minimize stressors and optional load.",
        recovery: "Enforce recovery-only window.",
      };
    }

    if (data.guardrail.label === "CAUTION") {
      return {
        main: "Hold current load level.",
        secondary: "Avoid escalation until risk stabilizes.",
        recovery: "Prioritize sleep and recovery capacity.",
      };
    }

    return {
      main: "Maintain controlled load progression.",
      secondary: "Keep stress within current budget.",
      recovery: "Protect nightly recovery consistency.",
    };
  }, [antiChaosProtocol, data]);

  const trendlineSignal = data && data.series7d.length >= 2 ? t("trendlineActive", locale) : t("trendlineLocked", locale);
  const antiChaosSignal = data?.featureAccess.antiChaos ? t("antiChaosActive", locale) : t("antiChaosLocked", locale);
  const activeProtocolForCheckin = useMemo(() => {
    if (!activeProtocol || !activeProtocol.appliedAt) return null;
    const expiry = new Date(activeProtocol.appliedAt).getTime() + activeProtocol.horizonHours * 60 * 60 * 1000;
    if (expiry <= Date.now()) return null;
    return {
      state: activeProtocol.protocol.state,
      horizonHours: activeProtocol.horizonHours,
      constraints: activeProtocol.protocol.constraints,
    };
  }, [activeProtocol]);
  const activeProtocolHeaderText = useMemo(() => {
    if (!activeProtocolForCheckin || !activeProtocol?.appliedAt) return null;
    const activeUntil = new Date(
      new Date(activeProtocol.appliedAt).getTime() + activeProtocol.horizonHours * 60 * 60 * 1000
    ).toLocaleString();
    return `Active protocol: ${activeProtocolForCheckin.state} (${activeProtocolForCheckin.horizonHours}h) • Active until ${activeUntil}`;
  }, [activeProtocol?.appliedAt, activeProtocol?.horizonHours, activeProtocolForCheckin]);
  const activeProtocolDeepWorkCap = useMemo(() => {
    if (!activeProtocolForCheckin) return null;
    const deepWorkConstraint = activeProtocolForCheckin.constraints.find((item) =>
      item.label.toLowerCase().includes("deep work cap")
    );
    if (!deepWorkConstraint) return null;
    const numericParts = deepWorkConstraint.value.match(/\d+/g);
    if (!numericParts || numericParts.length === 0) return null;
    return Math.max(...numericParts.map((raw) => Number(raw)));
  }, [activeProtocolForCheckin]);
  const constraintTraceItems = useMemo<ConstraintTraceItem[]>(() => {
    if (!activeProtocol) return [];

    const stressCurrent =
      typeof data?.checkinInputs?.stress === "number" ? data.checkinInputs.stress : data?.checkinSnapshot?.stress ?? null;
    const deepWorkCurrent =
      typeof data?.checkinInputs?.deepWorkMin === "number"
        ? data.checkinInputs.deepWorkMin
        : data?.checkinSnapshot?.deepWorkMin ?? null;
    const workoutCurrent =
      typeof data?.checkinInputs?.workout === "number"
        ? data.checkinInputs.workout
        : data?.checkinSnapshot?.workout ?? null;

    return activeProtocol.protocol.constraints.map((constraint, index) =>
      normalizeConstraintForTrace(
        constraint,
        {
          deepWorkMinutes: deepWorkCurrent,
          stress: stressCurrent,
          workout: workoutCurrent,
          horizonHours: activeProtocol.horizonHours,
        },
        index
      )
    );
  }, [
    activeProtocol,
    data?.checkinInputs?.deepWorkMin,
    data?.checkinInputs?.stress,
    data?.checkinInputs?.workout,
    data?.checkinSnapshot?.deepWorkMin,
    data?.checkinSnapshot?.stress,
    data?.checkinSnapshot?.workout,
  ]);
  const hasConstraintViolations = constraintTraceItems.some((item) => item.status === "VIOLATION");
  const integritySummary = useMemo(
    () =>
      deriveIntegritySummary({
        violations: data?.integrity.violations ?? [],
        events: systemEvents,
        now: new Date(),
      }),
    [data?.integrity.violations, systemEvents]
  );
  const complianceLabel = isZeroDataState || !activeProtocol
    ? "—"
    : `${Math.round(Math.max(0, Math.min(100, data?.integrity.score ?? 0)))}% • ${data?.integrity.state ?? "—"}`;
  const integrityStateLabel = isZeroDataState ? "—" : data?.integrity.state ?? "—";
  const integrityStateClass =
    integrityStateLabel === "STRAIN"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : integrityStateLabel === "DRIFT"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  const violationCountLabel =
    integritySummary.violations24h != null
      ? String(integritySummary.violations24h)
      : data?.integrity.violations.length
        ? String(data.integrity.violations.length)
        : "—";
  const lastProtocolAppliedAt = useMemo(() => {
    const latest = systemEvents
      .filter((event) => event.type === "PROTOCOL_APPLIED")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    return latest?.timestamp ?? null;
  }, [systemEvents]);
  const operationalDirectives = useMemo(
    () =>
      buildDirectives({
        guardrailState: data?.guardrail.label ?? "OPEN",
        hasActiveProtocol: Boolean(activeProtocol),
        protocolMode: activeProtocol?.mode ?? null,
        protocolHorizonHours: activeProtocol?.horizonHours ?? null,
        integrityState: data?.integrity?.state ?? null,
        calibrationStage: calibrationStage.stage,
      }),
    [activeProtocol, calibrationStage.stage, data?.guardrail.label, data?.integrity?.state]
  );
  const stateExplanation = useMemo(
    () =>
      buildStateExplanation({
        guardrailState: data?.guardrail.label ?? "UNKNOWN",
        lifeScore: data?.snapshot.lifeScore ?? null,
        load: data?.systemMetrics.load ?? null,
        recovery: data?.systemMetrics.recovery ?? null,
        risk: data?.systemMetrics.risk ?? null,
        confidence:
          typeof data?.modelConfidence?.confidence === "number" ? data.modelConfidence.confidence : null,
        calibrationCheckinsDone: calibrationCheckinCount,
        calibrationCheckinsNeeded: setupState?.calibrationCheckinsNeeded ?? 7,
        lastCheckin: data?.checkinSnapshot ?? null,
        activeProtocol: activeProtocolForCheckin
          ? {
              state: activeProtocolForCheckin.state,
              horizonHours: activeProtocolForCheckin.horizonHours,
              mode: activeProtocol?.mode ?? "STANDARD",
            }
          : null,
        integrity: data?.integrity
          ? {
              score: data.integrity.score,
              state: data.integrity.state,
            }
          : null,
        recentGuardrailTransition,
        recommendedButNotActive: Boolean(recommendedProtocol && !activeProtocol),
        activeConstraintViolations: hasConstraintViolations,
      }),
    [
      activeProtocolForCheckin,
      data?.checkinSnapshot,
      data?.guardrail.label,
      data?.integrity,
      data?.modelConfidence?.confidence,
      calibrationCheckinCount,
      setupState?.calibrationCheckinsNeeded,
      data?.snapshot.lifeScore,
      data?.systemMetrics.load,
      data?.systemMetrics.recovery,
      data?.systemMetrics.risk,
      recentGuardrailTransition,
      recommendedProtocol,
      activeProtocol,
      hasConstraintViolations,
    ]
  );

  const handleCopyDirectives = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(operationalDirectives.join("\n"));
      setDirectivesCopied(true);
      window.setTimeout(() => setDirectivesCopied(false), 1500);
    } catch {
      setProtocolError("Failed to copy directives.");
    }
  }, [operationalDirectives]);
  const protocolCompliance = useMemo(() => {
    if (!activeProtocol) {
      return {
        pressure: 0,
        label: "No active protocol",
      };
    }

    const stress = data?.checkinInputs.stress ?? 5;
    const deepWorkMin = data?.checkinInputs.deepWorkMin ?? 0;
    const workout = data?.checkinInputs.workout ?? 0;
    let hasHardViolation = false;
    let hasSoftViolation = false;

    for (const constraint of activeProtocol.protocol.constraints) {
      const label = constraint.label.toLowerCase();
      const value = constraint.value.toLowerCase();
      let violated = false;

      if (label.includes("deep work cap")) {
        const nums = constraint.value.match(/\d+/g);
        if (nums && nums.length > 0) {
          const cap = Math.max(...nums.map((raw) => Number(raw)));
          violated = deepWorkMin > cap;
        }
      } else if (label.includes("keep stress") || value.includes("<=")) {
        const match = constraint.value.match(/<=\s*(\d+)/);
        if (match) {
          violated = stress > Number(match[1]);
        }
      } else if (label.includes("no deep work blocks")) {
        violated = deepWorkMin > 0;
      } else if (label.includes("training") && (value.includes("light") || value.includes("no intense"))) {
        violated = workout > 0;
      }

      if (violated) {
        if (constraint.severity === "hard") {
          hasHardViolation = true;
        } else {
          hasSoftViolation = true;
        }
      }
    }

    if (hasHardViolation) {
      return { pressure: 100, label: "Hard constraint exceeded" };
    }
    if (hasSoftViolation) {
      return { pressure: 50, label: "Soft constraint exceeded" };
    }
    return { pressure: 0, label: "No constraint pressure" };
  }, [activeProtocol, data?.checkinInputs.deepWorkMin, data?.checkinInputs.stress, data?.checkinInputs.workout]);

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-20 rounded-xl bg-zinc-900" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-xl bg-zinc-900" />
            ))}
          </div>
          <div className="h-56 rounded-xl bg-zinc-900" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-500/40 bg-rose-950/20 p-5">
          <h1 className="text-lg font-semibold text-rose-200">{t("controlRoomUnavailable", locale)}</h1>
          <p className="mt-2 text-sm text-rose-200/80">{error}</p>
          <button
            type="button"
            onClick={() => openCheckInModal(selectedDate)}
            className="mt-4 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950"
          >
            {t("goToCheckin", locale)}
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <>
        <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-8 text-zinc-100 sm:px-6">
          <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href="/"
                  aria-label="Go to home page"
                  title="Home"
                  className="group inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-xs uppercase tracking-[0.22em] text-zinc-400 transition-all duration-200 ease-out hover:text-cyan-200 hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                >
                  <span
                    aria-hidden="true"
                    className="text-cyan-300/90 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
                  >
                    &larr;
                  </span>
                  <span className="font-medium text-zinc-300 transition-colors duration-200 group-hover:text-cyan-100">
                    LIFE OS
                  </span>
                  <span className="text-[10px] normal-case tracking-normal text-zinc-500 transition-colors duration-200 group-hover:text-cyan-200/90">
                    Home
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => openCheckInModal(checkinNotFoundDate ?? selectedDate)}
                  disabled={isDemoReadOnly}
                  title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                  className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                >
                  {hasAnyCheckins === false ? t("createFirstCheckin", locale) : t("newCheckin", locale)}
                </button>
                <button
                  type="button"
                  onClick={() => setExportModalOpen(true)}
                  className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
                >
                  Export System Log
                </button>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                >
                  Report issue
                </button>
                <Link
                  href="/app/settings"
                  className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => setResetModalOpen(true)}
                  disabled={isDemoReadOnly}
                  title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                  className="min-h-10 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400/60"
                >
                  Reset System
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteAccountModalOpen(true)}
                  disabled={isDemoReadOnly}
                  title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                  className="min-h-10 rounded-md border border-rose-700/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-500/70"
                >
                  Delete Account
                </button>
              </div>
              {isDemoReadOnly ? (
                <div className="mt-3 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  Simulation account - read-only. Sign in to operate your own system.
                </div>
              ) : null}
              {resetNotice ? <p className="mt-3 text-sm text-emerald-300/90">{resetNotice}</p> : null}
              <p className="mt-3 text-sm text-zinc-400">
                {hasAnyCheckins === false ? t("controlRoomNotInitializedSubtitle", locale) : t("noCheckinForDateSubtitle", locale)}
              </p>
            </header>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="h-24 rounded-xl border border-zinc-800 bg-zinc-950/70" />
                ))}
              </div>
              <div className="mt-4 h-40 rounded-xl border border-zinc-800 bg-zinc-950/60" />
            </section>
          </div>
        </main>
        <CheckInModal
          open={checkInModalOpen}
          dateISO={checkInModalDate ?? selectedDate}
          activeProtocol={activeProtocolForCheckin}
          onClose={closeCheckInModal}
          onSaved={handleCheckInSaved}
        />
        <ExportSystemLogModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
        <SystemResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} onDone={handleResetDone} />
        <DeleteAccountModal
          open={deleteAccountModalOpen}
          onClose={() => setDeleteAccountModalOpen(false)}
          onDone={handleAccountDeleted}
        />
      </>
    );
  }

  return (
    <>
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-8 text-zinc-100 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <SystemStatusBar
            status={authorityStatus.status}
            rationale={authorityStatus.rationale}
            guardrailState={data.guardrail.label}
            modelConfidencePct={systemConfidence.pct}
            calibrationStage={calibrationStage.stage}
            calibrationProgressText={calibrationStage.progressText}
            hasActiveProtocol={Boolean(activeProtocol)}
          />
          <div className="flex justify-end">
            <ViewModeToggle
              mode={viewMode}
              onToggle={() => setViewMode(viewMode === "simplified" ? "full" : "simplified")}
            />
          </div>
          <RequiredActionsPanel model={requiredActionsModel} onAction={handleRequiredAction} />
          <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            {checkinUpdateNotice ? (
              <div className="mb-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-cyan-100">{checkinUpdateNotice.title}</p>
                    <p className="mt-1 text-xs text-cyan-100/80">{checkinUpdateNotice.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckinUpdateNotice(null)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                  >
                    Dismiss
                  </button>
                </div>
                <button
                  type="button"
                  onClick={scrollToUpdatedState}
                  className="mt-2 text-[11px] text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
                >
                  View updated state
                </button>
              </div>
            ) : null}
            {guardrailTransitionNotice ? (
              <div className="mb-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-cyan-100">{guardrailTransitionNotice.title}</p>
                    <p className="mt-1 text-xs text-cyan-100/80">{guardrailTransitionNotice.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGuardrailTransitionNotice(null);
                      setRecentGuardrailTransition(false);
                    }}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            {isCalibratingStage && !calibrationStripDismissed ? (
              <div className="mb-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-cyan-100">Calibration in progress</p>
                    <p className="mt-1 text-xs text-cyan-100/80">
                      {calibrationStage.progressText}. Constraints are conservative until baseline stabilizes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalibrationStripDismissed(true)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            {isDemoReadOnly ? (
              <div className="mb-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                Simulation account - read-only. Sign in to operate your own system.
              </div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <Link
                  href="/"
                  aria-label="Go to home page"
                  title="Home"
                  className="group inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-xs uppercase tracking-[0.22em] text-zinc-400 transition-all duration-200 ease-out hover:text-cyan-200 hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                >
                  <span
                    aria-hidden="true"
                    className="text-cyan-300/90 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
                  >
                    &larr;
                  </span>
                  <span className="font-medium text-zinc-300 transition-colors duration-200 group-hover:text-cyan-100">
                    LIFE OS
                  </span>
                  <span className="text-[10px] normal-case tracking-normal text-zinc-500 transition-colors duration-200 group-hover:text-cyan-200/90">
                    Home
                  </span>
                </Link>
                {showDevDateNavigator && (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDateInUrl(addDaysISO(selectedDate, -1))}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:border-zinc-500"
                      >
                        {t("prev", locale)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateInUrl(getLocalISODate())}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:border-zinc-500"
                      >
                        {t("today", locale)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateInUrl(addDaysISO(selectedDate, 1))}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:border-zinc-500"
                      >
                        {t("next", locale)}
                      </button>
                      <span className="ml-2 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-zinc-300">
                        {selectedDate}
                      </span>
                      <div className="ml-2 inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5">
                        <button
                          type="button"
                          disabled={devPlanSaving}
                          onClick={() => void setDevPlan("free")}
                          className={`rounded px-2 py-1 text-xs transition ${
                            (devPlanOverride ?? data.plan.toLowerCase()) === "free"
                              ? "bg-zinc-700 text-zinc-100"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          {t("free", locale)}
                        </button>
                        <button
                          type="button"
                          disabled={devPlanSaving}
                          onClick={() => void setDevPlan("pro")}
                          className={`rounded px-2 py-1 text-xs transition ${
                            (devPlanOverride ?? data.plan.toLowerCase()) === "pro"
                              ? "bg-emerald-700 text-emerald-100"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          {t("pro", locale)}
                        </button>
                      </div>
                      <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                        Dev: plan override ({(devPlanOverride ?? data.plan.toLowerCase()).toUpperCase()})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={devSimSeed}
                        onChange={(event) => setDevSimSeed(event.target.value)}
                        placeholder={`seed (default: ${selectedDate})`}
                        className="h-8 w-56 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200 placeholder:text-zinc-500"
                      />
                      <label className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={devSimOverwrite}
                          onChange={(event) => setDevSimOverwrite(event.target.checked)}
                          className="h-3.5 w-3.5 accent-zinc-300"
                        />
                        {t("overwrite", locale)}
                      </label>
                      <button
                        type="button"
                        disabled={devSimLoading}
                        onClick={() => void runDevSimulation("simulate")}
                        className="rounded-md border border-cyan-700/70 bg-cyan-500/10 px-2.5 py-1 text-cyan-200 hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("sim30d", locale)}
                      </button>
                      <button
                        type="button"
                        disabled={devSimLoading}
                        onClick={() => void runDevSimulation("clear")}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("clear30d", locale)}
                      </button>
                      {devSimLoading ? <span className="text-zinc-500">{t("processing", locale)}</span> : null}
                      {devSimNotice ? <span className="text-emerald-300">{devSimNotice}</span> : null}
                      {devSimError ? <span className="text-rose-300">{devSimError}</span> : null}
                    </div>
                  </div>
                )}
                <h1 id="state-overview" className="mt-2 text-5xl font-semibold leading-none text-zinc-100">
                  {isZeroDataState ? "—" : data.snapshot.lifeScore.toFixed(1)}
                </h1>
                {isCalibrationDominant ? (
                  <div className="mt-3">
                    <CalibrationPanel
                      unavailable={setupStateUnavailable}
                      onboardingCompleted={setupState?.onboardingCompleted ?? false}
                      calibrationCheckinsDone={setupState?.calibrationCheckinsDone ?? 0}
                      calibrationCheckinsNeeded={setupState?.calibrationCheckinsNeeded ?? 7}
                      confidence={setupState?.confidence ?? 0}
                      todayCheckInExists={data.todayCheckInExists}
                      onRunOnboarding={() => router.push("/onboarding")}
                      onOpenCheckin={() => openCheckInModal(todayDayKey)}
                      onReloadSetup={() => void loadSetupState()}
                      tzOffsetMinutes={tzOffsetMinutes}
                    />
                  </div>
                ) : null}
                <p
                  className={`mt-2 text-sm ${
                    isZeroDataState
                      ? "text-zinc-400"
                      : lifeScoreDeltaContext.ready
                        ? lifeScoreDeltaContext.direction === "up"
                          ? "text-emerald-300"
                          : lifeScoreDeltaContext.direction === "down"
                            ? "text-rose-300"
                            : "text-zinc-400"
                        : "text-zinc-400"
                  }`}
                >
                  {isZeroDataState
                    ? "No signal yet."
                    : lifeScoreDeltaContext.ready
                      ? lifeScoreDeltaContext.label
                      : `Baseline calibrating (need ${lifeScoreDeltaContext.remainingCheckins} more check-ins)`}
                </p>
                <p className="mt-2 text-sm text-zinc-400">{t("lifeScore", locale)}</p>
                {isZeroDataState ? <p className="mt-1 text-[11px] text-zinc-500">Baseline calibration pending.</p> : null}
                {isCalibratingStage ? (
                  <span className="mt-2 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200">
                    Confidence limited
                  </span>
                ) : null}

                {showOperatorBrief ? (
                  <section className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">{t("operatorBriefTitle", locale)}</p>
                      <button
                        type="button"
                        onClick={dismissOperatorBrief}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300"
                      >
                        Dismiss
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                      <li>- {t("operatorBriefBulletLifeScore", locale)}</li>
                      <li>- {t("operatorBriefBulletGuardrail", locale)}</li>
                      <li>- {t("operatorBriefBulletProtocol", locale)}</li>
                    </ul>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Start with daily check-ins. Baseline stabilizes after ~7 data points.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCheckInModal(todayDayKey)}
                        disabled={isDemoReadOnly}
                        title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          data.series7d.length === 0
                            ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18)] hover:border-cyan-200"
                            : "border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300"
                        }`}
                      >
                        {t("ctaStartCheckin", locale)}
                      </button>
                      <Link
                        href="/demo"
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
                      >
                        {t("ctaViewGuidedDemo", locale)}
                      </Link>
                    </div>
                    {data.series7d.length === 0 ? (
                      <p className="mt-2 text-[11px] text-zinc-500">First check-in initializes baseline.</p>
                    ) : null}
                  </section>
                ) : null}

                {!isSimplifiedView ? (
                  <>
                    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-zinc-500">{t("systemDiagnosis", locale)}</p>
                          <h2 className="mt-1 text-sm font-semibold text-zinc-100">
                            {isZeroDataState ? "UNINITIALIZED" : data.diagnosis.title}
                          </h2>
                          <p className="mt-1 text-xs text-zinc-400">
                            {isZeroDataState ? "Awaiting baseline signals." : data.diagnosis.summary}
                          </p>
                          {!isZeroDataState ? (
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {t("homeostaticAdaptation", locale)}: {data.adaptiveBaseline.riskOffset >= 0 ? "+" : ""}
                              {data.adaptiveBaseline.riskOffset.toFixed(1)} risk bias /{" "}
                              {data.adaptiveBaseline.recoveryOffset >= 0 ? "+" : ""}
                              {data.adaptiveBaseline.recoveryOffset.toFixed(1)} recovery bias
                            </p>
                          ) : null}
                        </div>
                        <div ref={whyPopoverRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setWhyPopoverOpen((open) => !open)}
                          aria-expanded={whyPopoverOpen}
                          aria-controls={whyPopoverId}
                          aria-describedby={whyPopoverOpen ? whyPopoverId : undefined}
                          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                        >
                          {t("why", locale)}
                        </button>
                      {whyPopoverOpen ? (
                            <div
                              id={whyPopoverId}
                              role="tooltip"
                              className="absolute right-0 top-9 z-20 w-64 rounded-md border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
                            >
                              Diagnosis is derived from measurable signals. Guardrail state selects constraints. No AI
                              inference.
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {!isZeroDataState ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {data.diagnosis.bullets.slice(0, 3).map((bullet) => (
                            <span
                              key={`${bullet.label}-${bullet.value}`}
                              className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                            >
                              {bullet.label}: {bullet.value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>
                    {recommendedMode && !isZeroDataState ? (
                      <section className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">Recommended Mode:</p>
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${recommendedMode.accentClass}`}
                          >
                            {recommendedMode.mode}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Signal State</p>
                          <p className="text-[11px] text-zinc-600">
                            {data.guardrail.label} • Risk {data.systemMetrics.risk.toFixed(1)} • Recovery{" "}
                            {data.systemMetrics.recovery.toFixed(1)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Action</p>
                          <p className="text-xs text-zinc-300">{recommendedModeActionLine}</p>
                        </div>
                        <p className="mt-2 text-[11px] text-zinc-600">
                          Rationale: {data.guardrail.label} • Risk {data.systemMetrics.risk.toFixed(1)} • Recovery{" "}
                          {data.systemMetrics.recovery.toFixed(1)} • Load {data.systemMetrics.load.toFixed(1)}
                        </p>
                      </section>
                    ) : null}
                    <div className="mt-3">
                      <PatternMonitor patterns={data.patterns} locale={locale} onDetails={() => setBreakdownOpen(true)} />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <StatusBadge status={data.status} locale={locale} />
                  <PlanBadge plan={data.plan} />
                  {data.featureAccess.antiChaos ? (
                    <button
                      type="button"
                      onClick={() => void applyStabilizeProtocol()}
                      disabled={stabilizeLoading || stabilizeActive || isDemoReadOnly}
                      title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                      className="min-h-10 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {stabilizeLoading ? "Applying..." : stabilizeActive ? "Stabilize active" : t("stabilizeSystem", locale)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => showUpgradePrompt("Anti-Chaos tighten")}
                      title="Extension layer: forward simulation & scenarios"
                      className="inline-flex min-h-10 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:border-amber-400"
                    >
                      Operator capability
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openCheckInModal(todayDayKey)}
                    disabled={isDemoReadOnly}
                    title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  >
                    {data.todayCheckInExists ? t("editToday", locale) : t("newCheckin", locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(true)}
                    className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
                  >
                    Export System Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setStateExplanationOpen(true)}
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  >
                    {t("explainThisState", locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  >
                    Report issue
                  </button>
                  <Link
                    href="/app/settings"
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  >
                    Settings
                  </Link>
                  {data?.isAdmin ? (
                    <Link
                      href="/app/admin/health"
                      className="min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400/60"
                    >
                      Health Console
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setGlossaryOpen(true)}
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  >
                    Glossary
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(true)}
                    disabled={isDemoReadOnly}
                    title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                    className="min-h-10 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400/60"
                  >
                    Reset System
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteAccountModalOpen(true)}
                    disabled={isDemoReadOnly}
                    title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                    className="min-h-10 rounded-md border border-rose-700/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-500/70"
                  >
                    Delete Account
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  {userEmail ?? "unknown"} | data points {data.series7d.length} |{" "}
                  {isProPlan ? "Operator License Active" : "Observer Mode"}
                </p>
                {setupState && setupState.calibrationCheckinsDone < setupState.calibrationCheckinsNeeded ? (
                  <p className="text-[11px] text-zinc-500">
                    Baseline calibration: {setupState.calibrationCheckinsDone}/{setupState.calibrationCheckinsNeeded} •{" "}
                    {setupState.confidencePct}% confidence. Projections are conservative until baseline stabilizes.
                  </p>
                ) : null}
                {canSeeAdminDebug ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDebugInfo((current) => !current)}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500"
                    >
                      {showDebugInfo ? "Hide debug info" : "Show debug info"}
                    </button>
                  </div>
                ) : null}
                {canSeeAdminDebug && showDebugInfo ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-[11px] text-zinc-400">
                    <p>guardrail: {data.guardrail.label}</p>
                    <p>confidence: {systemConfidence.pct}%</p>
                    <p>last check-in dayKey: {data.checkinSnapshot?.date ?? "n/a"}</p>
                    <p>active protocol id: {activeProtocol?.id ?? "none"}</p>
                  </div>
                ) : null}
                {!checkinUpdateNotice && resetNotice ? <p className="text-[11px] text-emerald-300/90">{resetNotice}</p> : null}
                {!checkinUpdateNotice && !resetNotice && stabilizeNotice ? (
                  <p className="text-[11px] text-emerald-300/90">{stabilizeNotice}</p>
                ) : null}
                {stabilizeActiveUntilText ? <p className="text-[11px] text-amber-200/85">{stabilizeActiveUntilText}</p> : null}
                {activeProtocolHeaderText ? <p className="text-[11px] text-cyan-200/80">{activeProtocolHeaderText}</p> : null}
                <div title="Based on data coverage and stability." className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">System Confidence</p>
                  <p className="text-2xl font-semibold leading-none text-zinc-100">{systemConfidence.pct}%</p>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
                  <div
                    className={`h-full ${
                      systemConfidence.level === "low"
                        ? "bg-rose-400/70"
                        : systemConfidence.level === "med"
                          ? "bg-amber-400/70"
                          : "bg-cyan-400/70"
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, systemConfidence.pct))}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {systemConfidence.level === "low"
                    ? "Low"
                    : systemConfidence.level === "med"
                      ? "Med"
                      : "High"}
                </p>
                <p className="text-[11px] text-zinc-600">
                  {data.series7d.length < 3
                    ? "Early calibration stage"
                    : data.series7d.length < 7
                      ? "Partial stability"
                      : "Stable baseline"}
                </p>
                {!data.featureAccess.antiChaos ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Stabilization (24h)</p>
                    <div className="mt-2 grid grid-cols-[84px_1fr] gap-x-2 gap-y-1 text-[11px]">
                      <p className="uppercase tracking-wide text-zinc-500">Main</p>
                      <p className="truncate text-zinc-300">{stabilizationPreview.main}</p>
                      <p className="uppercase tracking-wide text-zinc-500">Secondary</p>
                      <p className="truncate text-zinc-300">{stabilizationPreview.secondary}</p>
                      <p className="uppercase tracking-wide text-zinc-500">Recovery</p>
                      <p className="truncate text-zinc-300">{stabilizationPreview.recovery}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <section
            className={`grid gap-4 sm:grid-cols-2 ${data.featureAccess.allStats ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}
          >
            {statsWithTrend.map((stat) => (
              <StatCard
                key={stat.id}
                label={
                  stat.key === "Energy"
                    ? t("energy", locale)
                    : stat.key === "Focus"
                      ? t("focus", locale)
                      : stat.key === "Discipline"
                        ? t("discipline", locale)
                        : stat.key === "Finance"
                          ? t("finance", locale)
                          : stat.key === "Growth"
                            ? t("growth", locale)
                            : stat.key
                }
                value={stat.value}
                delta={stat.delta}
                hasPreviousDay={stat.hasPreviousDay}
              />
            ))}
            {!data.featureAccess.allStats ? (
              <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{t("systemSignals", locale)}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="flex items-center justify-between">
                    <span>{t("dataQuality", locale)}</span>
                    <span className="text-zinc-100">
                      {data.telemetry.quality}
                      <span className="ml-2 text-xs text-zinc-500">
                        ({data.telemetry.filledFields}/{data.telemetry.totalFields}, estimated={String(data.telemetry.estimated)})
                      </span>
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{t("trendline", locale)}</span>
                    <span className="text-zinc-100">{trendlineSignal}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{t("antiChaos", locale)}</span>
                    <span className="text-zinc-100">{antiChaosSignal}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{t("calibration", locale)}</span>
                    <span className="text-zinc-100">
                      {data.calibration.active ? t("active", locale) : t("inactive", locale)}
                      <span className="ml-2 text-xs text-zinc-500">
                        ({data.calibration.confidence.toFixed(2)})
                      </span>
                    </span>
                  </p>
                </div>
              </article>
            ) : null}
          </section>

          {!isSimplifiedView ? (
            <>
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <h2 className="text-sm font-medium text-zinc-200">{t("topFactors", locale)}</h2>
                {topFactors.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {topFactors.map((factor) => (
                      <li
                        key={factor.key}
                        className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        <span className="text-zinc-300">{factor.label}</span>
                        <span className={factor.colorClass}>{factor.valueLabel}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
                    {t("noSignificantDrivers", locale)}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <h2 className="text-sm font-medium text-zinc-200">{t("systemMetrics", locale)}</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <SystemMetricBar
                    label={t("load", locale)}
                    value={data.systemMetrics.load}
                    hint={t("workloadHint", locale)}
                    tone="cyan"
                    tooltip="Current workload pressure"
                    uninitialized={isZeroDataState}
                  />
                  <SystemMetricBar
                    label={t("recovery", locale)}
                    value={data.systemMetrics.recovery}
                    hint={t("recoveryHint", locale)}
                    tone="green"
                    tooltip="Restoration capacity index"
                    uninitialized={isZeroDataState}
                  />
                  <SystemMetricBar
                    label={t("risk", locale)}
                    value={data.systemMetrics.risk}
                    hint={t("riskHint", locale)}
                    tone="rose"
                    tooltip="Overload probability in next 24h"
                    uninitialized={isZeroDataState}
                  />
                </div>
              </section>
            </>
          ) : null}

          <section id="system-integrity" className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-zinc-200">System Integrity</h2>
                <button
                  type="button"
                  aria-label="Integrity info"
                  title="A violation occurs when an input exceeds protocol constraints (e.g., load cap, recovery minimum)."
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  i
                </button>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${integrityStateClass}`}>
                {integrityStateLabel}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Integrity measures compliance with the Active Protocol constraints.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Violations (24h)</p>
                <p className="mt-1 text-xs font-medium text-zinc-200">{violationCountLabel}</p>
              </article>
              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Last violation</p>
                <p className="mt-1 text-xs font-medium text-zinc-200">
                  {integritySummary.lastViolationAt ? integritySummary.lastViolationAt.toLocaleString() : "—"}
                </p>
              </article>
              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Compliance</p>
                <p className="mt-1 text-xs font-medium text-zinc-200">{complianceLabel}</p>
              </article>
            </div>
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <p className="uppercase tracking-wide text-zinc-500">Mode compliance indicator</p>
                <button
                  type="button"
                  onClick={() => {
                    setEventLogFilter("integrity");
                    scrollToId("system-event-log");
                  }}
                  className="text-zinc-400 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-200"
                >
                  View in Event Log
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                <div
                  className={`h-full ${
                    data.integrity.state === "STRAIN"
                      ? "bg-rose-400/80"
                      : data.integrity.state === "DRIFT"
                        ? "bg-amber-400/80"
                        : "bg-cyan-400/70"
                  }`}
                  style={{ width: `${isZeroDataState || !activeProtocol ? 0 : Math.max(0, Math.min(100, data.integrity.score))}%` }}
                />
              </div>
              {isZeroDataState ? (
                <>
                  <p className="mt-2 text-[11px] text-zinc-500">No compliance signal.</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Protocol required.</p>
                </>
              ) : !activeProtocol ? (
                <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="text-xs text-zinc-400">Compliance requires active protocol.</p>
                  <button
                    type="button"
                    onClick={() => handleRequiredAction("go-protocol-apply")}
                    disabled={isDemoReadOnly}
                    className="mt-2 min-h-9 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply protocol to activate
                  </button>
                  {data.guardrail.label === "LOCKDOWN" ? (
                    <p className="mt-1 text-[11px] text-amber-200">Guardrail requires enforced constraints.</p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Recent violations</p>
                  {integritySummary.recent.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {integritySummary.recent.slice(0, 5).map((violation, index) => (
                        <li key={`${violation.title}-${index}`} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-zinc-200">{violation.title}</p>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                                violation.status === "VIOLATION"
                                  ? "border border-rose-500/40 bg-rose-500/10 text-rose-200"
                                  : "border border-amber-500/40 bg-amber-500/10 text-amber-200"
                              }`}
                            >
                              {violation.status}
                            </span>
                          </div>
                          <p className="mt-1 text-zinc-500">
                            {violation.timestamp ? violation.timestamp.toLocaleString() : "—"}
                          </p>
                          {violation.detail ? <p className="mt-0.5 text-zinc-400">Constraint: {violation.detail}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">No violation breakdown available.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          <ConstraintTracePanel
            hasActiveProtocol={Boolean(activeProtocol)}
            hasConstraints={constraintTraceItems.length > 0}
            items={constraintTraceItems}
            guardrailLabel={data.guardrail.label}
            lastEnforcedAt={lastProtocolAppliedAt}
            readOnly={isDemoReadOnly}
            onApplyProtocol={() => handleRequiredAction("go-protocol-apply")}
            onViewLastEvent={() => scrollToId("system-event-log")}
          />

          <section id="operational-directives" className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">Operational Directives — Next 24h</h2>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Derived from Active Protocol and current Guardrail.
                </p>
                {activeProtocol ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Protocol: {activeProtocol.guardrailState} ({activeProtocol.horizonHours}h), {activeProtocol.mode}.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyDirectives()}
                className="min-h-9 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                {directivesCopied ? "Copied" : "Copy directives"}
              </button>
            </div>
            {!activeProtocol ? (
              <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-xs text-zinc-400">Inactive — no active protocol.</p>
                <button
                  type="button"
                  onClick={() => handleRequiredAction("go-protocol-apply")}
                  disabled={isDemoReadOnly}
                  className="mt-2 min-h-9 rounded border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply protocol to activate
                </button>
                {data.guardrail.label === "LOCKDOWN" ? (
                  <p className="mt-1 text-[11px] text-amber-200">Guardrail requires enforced constraints.</p>
                ) : null}
              </div>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {operationalDirectives.map((directive, index) => (
                  <li
                    key={`${directive}-${index}`}
                    className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300"
                  >
                    {index + 1}. {directive}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            id="operational-protocol"
            className={`rounded-xl border bg-zinc-900/70 p-4 ${
              activeProtocol?.mode === "STABILIZE" ? "border-amber-500/40" : "border-zinc-800"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-zinc-200">
                  {activeProtocol?.mode === "STABILIZE"
                    ? "Operational Protocol — STABILIZE"
                    : "Operational Protocol"}
                </h2>
                {activeProtocol?.mode === "STABILIZE" ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    Tightened constraints
                  </span>
                ) : null}
              </div>
              <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
                {[24, 48, 72].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      if (h > 24 && !isProPlan) {
                        showUpgradePrompt(`${h}h protocol horizon`);
                        return;
                      }
                      setProtocolHorizon(h as 24 | 48 | 72);
                    }}
                    title={h > 24 && !isProPlan ? "Extension layer: forward simulation & scenarios" : undefined}
                    className={`rounded px-2 py-1 ${
                      protocolHorizon === h ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {h}h {h > 24 && !isProPlan ? "Operator capability" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                id="generate-protocol-btn"
                type="button"
                onClick={() => {
                  if (isDemoReadOnly || isZeroDataState) return;
                  if (protocolHorizon > 24 && !isProPlan) {
                    showUpgradePrompt(`${protocolHorizon}h protocol horizon`);
                    return;
                  }
                  void generateOperationalProtocol();
                }}
                disabled={protocolLoading || isDemoReadOnly || isZeroDataState}
                title={
                  isDemoReadOnly
                    ? "Simulation account is read-only."
                    : isZeroDataState
                      ? "Baseline required before protocol generation."
                      : protocolHorizon > 24 && !isProPlan
                        ? "Extension layer: forward simulation & scenarios"
                        : undefined
                }
                className={`rounded-md border bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  requiresProtocolGenerate ? enforcementToneClass : "border-cyan-400/40"
                }`}
              >
                {protocolLoading ? "Generating..." : isCalibratingStage ? "Conservative protocol" : "Generate Protocol"}
              </button>
              {requiresProtocolGenerate ? (
                <span className={`inline-flex items-center rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${enforcementToneClass} text-zinc-200`}>
                  REQUIRED
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setProtocolLogOpen((open) => !open)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500"
              >
                View log
              </button>
            </div>
            {protocolNotice ? <p className="mt-2 text-[11px] text-emerald-300/90">{protocolNotice}</p> : null}
            {isCalibratingStage ? (
              <p className="mt-2 text-[11px] text-zinc-500">Conservative protocol mode during calibration.</p>
            ) : null}
            {!isProPlan ? (
              <p className="mt-2 text-[11px] text-zinc-500">
                48h/72h horizons are{" "}
                <span className="rounded border border-amber-500/40 px-1 text-amber-200">Operator capability</span>.{" "}
                <Link href="/pricing" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">
                  Pay for Operator License
                </Link>
              </p>
            ) : null}

            {protocolError ? (
              protocolErrorId ? (
                <ErrorIdNotice message={protocolError} errorId={protocolErrorId} className="mt-3" />
              ) : (
                <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                  {protocolError}
                </p>
              )
            ) : null}

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Active Protocol</p>
                {activeProtocol ? (
                  <>
                    <p className="mt-2 text-xs text-zinc-300">
                      {activeProtocol.protocol.state} • {activeProtocol.horizonHours}h • {activeProtocol.mode}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Constraints: {activeProtocol.protocol.constraints.length}
                    </p>
                    {activeProtocol.appliedAt ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Active until:{" "}
                        {new Date(
                          new Date(activeProtocol.appliedAt).getTime() + activeProtocol.horizonHours * 60 * 60 * 1000
                        ).toLocaleString()}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">No active protocol.</p>
                )}
              </article>
              <article
                className={`rounded-md border bg-zinc-950/70 p-3 ${
                  !activeProtocol ? enforcementToneClass : "border-zinc-800"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Recommended Protocol</p>
                {recommendedProtocol ? (
                  <>
                    <p className="mt-2 text-xs text-zinc-300">
                      {recommendedProtocol.protocol.state} • {recommendedProtocol.horizonHours}h • {recommendedProtocol.mode}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Constraints: {recommendedProtocol.protocol.constraints.length}
                    </p>
                    {recommendedDiffersFromActive ? (
                      <button
                        id="apply-protocol-btn"
                        type="button"
                        onClick={() => void applyOperationalProtocol()}
                        disabled={protocolApplying || isDemoReadOnly}
                        title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                        className={`mt-2 rounded-md border bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                          requiresProtocolApply ? enforcementToneClass : "border-emerald-500/40"
                        }`}
                      >
                        {protocolApplying ? "Applying..." : "Apply protocol"}
                      </button>
                    ) : null}
                    {requiresProtocolApply ? (
                      <span className={`mt-2 inline-flex items-center rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${enforcementToneClass} text-zinc-200`}>
                        REQUIRED
                      </span>
                    ) : recommendedMatchesActive ? (
                      <p className="mt-2 text-[11px] text-zinc-500">Active protocol matches current recommendation.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">No recommended protocol.</p>
                )}
              </article>
            </div>
            {recommendedProtocol ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Compliance indicator</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                    <div
                      className={`h-full ${
                        protocolCompliance.pressure >= 100
                          ? "bg-rose-400/80"
                          : protocolCompliance.pressure >= 50
                            ? "bg-amber-400/80"
                            : "bg-cyan-400/70"
                      }`}
                      style={{ width: `${protocolCompliance.pressure}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {protocolCompliance.pressure}% • {protocolCompliance.label}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Constraints</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                      {recommendedProtocol.protocol.constraints.map((item) => (
                        <li key={`${item.label}-${item.value}`}>
                          {item.label}: {item.value} ({item.severity})
                        </li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Allowed actions</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                      {recommendedProtocol.protocol.allowed.map((item) => (
                        <li key={item.label}>
                          {item.label}
                          {item.note ? ` — ${item.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Minimum recovery</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                      {recommendedProtocol.protocol.minRecovery.map((item) => (
                        <li key={`${item.label}-${item.value}`}>
                          {item.label}: {item.value}
                        </li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Re-evaluation</p>
                    <p className="mt-2 text-xs text-zinc-300">
                      After {recommendedProtocol.protocol.reEvaluation.afterHours}h
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                      {recommendedProtocol.protocol.reEvaluation.triggers.map((trigger) => (
                        <li key={trigger}>{trigger}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              </div>
            ) : isZeroDataState ? (
              <PanelState
                kind="empty"
                title="No active protocol."
                subtitle="Protocol generation available after baseline."
              />
            ) : (
              <PanelState
                kind="empty"
                title="No protocol history."
                subtitle="Generate protocol to initialize constraints."
              />
            )}

            {protocolLogOpen ? (
              <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Recent protocol runs</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                  {protocolRuns.length > 0 ? (
                    protocolRuns.map((row) => (
                      <li key={row.id} className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => setProtocolLogExpandedId((current) => (current === row.id ? null : row.id))}
                          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                        >
                          <span>
                            {new Date(row.createdAt).toLocaleString()} • {row.guardrailState} • {row.horizonHours}h •{" "}
                            {row.mode === "STABILIZE" ? "STABILIZE" : "STANDARD"}
                          </span>
                          <span className="text-zinc-500">
                            {(() => {
                              if (!row.appliedAt) return "not applied";
                              if (row.outcome) return "evaluated";
                              const expiresAt = new Date(row.appliedAt).getTime() + row.horizonHours * 60 * 60 * 1000;
                              return Date.now() < expiresAt ? "Active" : "Pending evaluation";
                            })()}
                          </span>
                        </button>
                        {protocolLogExpandedId === row.id ? (
                          <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2 text-[11px] text-zinc-400">
                            <p className="text-zinc-300">{row.protocol.title}</p>
                            <p>
                              Re-eval: after {row.protocol.reEvaluation.afterHours}h • Triggers:{" "}
                              {row.protocol.reEvaluation.triggers.join(", ")}
                            </p>
                            <p>
                              Constraints: {row.protocol.constraints.map((item) => `${item.label}=${item.value}`).join("; ")}
                            </p>
                            <p>
                              Applied at: {row.appliedAt ? new Date(row.appliedAt).toLocaleString() : "not applied"}
                            </p>
                            {row.outcome ? (
                              <div className="rounded border border-zinc-800 bg-zinc-950/80 px-2 py-1.5 text-zinc-300">
                                <p>Outcome:</p>
                                <p>Risk Delta: {(row.outcome.riskDelta ?? 0) >= 0 ? "+" : ""}{(row.outcome.riskDelta ?? 0).toFixed(1)}</p>
                                <p>
                                  Recovery Delta: {(row.outcome.recoveryDelta ?? 0) >= 0 ? "+" : ""}
                                  {(row.outcome.recoveryDelta ?? 0).toFixed(1)}
                                </p>
                                <p>Load Delta: {(row.outcome.loadDelta ?? 0) >= 0 ? "+" : ""}{(row.outcome.loadDelta ?? 0).toFixed(1)}</p>
                                {row.outcome.guardrailAtApply || row.outcome.guardrailNow ? (
                                  <p>
                                    Guardrail: {row.outcome.guardrailAtApply ?? "UNKNOWN"} → {row.outcome.guardrailNow ?? "UNKNOWN"}
                                  </p>
                                ) : null}
                                {row.mode === "STABILIZE" ? <p>Stabilization impact</p> : null}
                                {row.integrityAtEnd &&
                                typeof row.integrityAtEnd.finalScore === "number" &&
                                typeof row.integrityAtEnd.finalState === "string" ? (
                                  <p>
                                    Integrity: {Math.round(Math.max(0, Math.min(100, row.integrityAtEnd.finalScore)))}% (
                                    {row.integrityAtEnd.finalState})
                                  </p>
                                ) : null}
                              </div>
                            ) : row.appliedAt ? (
                              <p className="text-zinc-500">
                                {Date.now() <
                                new Date(row.appliedAt).getTime() + row.horizonHours * 60 * 60 * 1000
                                  ? "Active"
                                  : "Pending evaluation"}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))
                  ) : (
                    <li>
                      <PanelState kind="empty" title="No protocol history." />
                    </li>
                  )}
                </ul>
              </div>
            ) : null}
          </section>

          {!isSimplifiedView ? (
            <>
              <ModelTransparencyPanel
                snapshot={data.checkinSnapshot}
                risk={data.systemMetrics.risk}
                activeProtocolDeepWorkCap={activeProtocolDeepWorkCap}
                calibrationProgressText={isCalibratingStage ? calibrationStage.progressText.replace("Baseline calibration: ", "") : null}
              />

              <section
                className={`grid gap-4 ${data.featureAccess.forecast30d ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}
              >
                <SparklineChart title={t("lifeScore7d", locale)} points={data.series7d} />
                {data.featureAccess.forecast30d ? (
                  isZeroDataState ? (
                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <PanelState kind="insufficient" title="Forward simulation requires baseline." />
                    </section>
                  ) : projectionLoading ? (
                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <div className="h-6 w-40 animate-pulse rounded bg-zinc-800" />
                      <div className="mt-3 h-52 animate-pulse rounded bg-zinc-900" />
                    </section>
                  ) : projectionError ? (
                    <section className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4">
                      <PanelState kind="error" title="Data unavailable." subtitle={projectionError} />
                    </section>
                  ) : projection30d ? (
                    <div className="relative">
                      <ProjectionScenarioChart
                        locale={locale}
                        userId={data.userId}
                        isAdmin={data.isAdmin}
                        readOnly={isDemoReadOnly || isCalibratingStage}
                        projection={projection30d}
                        custom={customProjection}
                        deltasAt30d={customDeltasAt30d}
                        customLoading={customLoading}
                        modifiers={projectionModifiers}
                        onModifiersChange={setProjectionModifiers}
                        onApplyCustom={() => void applyCustomProjection()}
                        onResetCustom={resetCustomProjection}
                        selectedDateISO={selectedDate}
                        isPro={data.plan === "PRO"}
                        onAntiChaosProtocolChange={setAntiChaosProtocol}
                        patternContext={{
                          systemMode: data.patterns.systemMode,
                          topPattern: data.patterns.topPatterns[0]?.type ?? null,
                        }}
                        calibrationConfidence={data.calibration.confidence}
                        modelConfidence={data.modelConfidence}
                        guardrail={data.guardrail}
                        envelope72h={envelope72h}
                        impact72h={impact72h}
                        decisionBudget72h={decisionBudget72h}
                      />
                      {isCalibratingStage ? (
                        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center rounded-xl border border-cyan-500/20 bg-zinc-950/55 p-4 text-center">
                          <div>
                            <p className="text-xs font-medium text-cyan-100">Projection limited during calibration.</p>
                            <p className="mt-1 text-[11px] text-zinc-300">Requires stabilized baseline.</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <PanelState kind="insufficient" title="Baseline calibrating — limited confidence." />
                    </section>
                  )
                ) : (
                  <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium text-amber-100">{t("forecastPro", locale)}</p>
                    <p className="mt-1 text-xs text-amber-100/70">
                      {t("unlockProjection", locale)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["30-day projection", "Compare A/B", "Save scenario", "Anti-Chaos 48h/72h"].map((feature) => (
                        <button
                          key={feature}
                          type="button"
                          onClick={() => showUpgradePrompt(feature)}
                          title="Extension layer: forward simulation & scenarios"
                          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500"
                        >
                          {feature} Operator capability
                        </button>
                      ))}
                    </div>
                    <Link
                      href="/pricing"
                      className="mt-3 inline-flex rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:border-amber-400"
                    >
                      Pay for Operator License
                    </Link>
                  </section>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">System Snapshots</p>
                    <p className="mt-1 text-xs text-zinc-400">Read-only public state link without personal data.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateSnapshot()}
                    disabled={isDemoReadOnly}
                    title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400"
                  >
                    Generate Snapshot Link
                  </button>
                </div>
                {snapshotNotice ? <p className="mt-2 text-[11px] text-emerald-300/90">{snapshotNotice}</p> : null}
                {snapshotsError ? <p className="mt-2 text-[11px] text-rose-300/90">{snapshotsError}</p> : null}
                {snapshotsLoading ? (
                  <p className="mt-2 text-[11px] text-zinc-500">Loading...</p>
                ) : snapshots.length === 0 ? (
                  <p className="mt-2 text-[11px] text-zinc-500">No snapshots yet.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <ul className="min-w-[620px] space-y-1.5 text-xs text-zinc-300">
                      {snapshots.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"
                        >
                          <div className="text-zinc-400">
                            <p>{new Date(row.createdAt).toLocaleString()}</p>
                            <p className="text-[10px] text-zinc-500">Expires: {new Date(row.expiresAt).toLocaleString()}</p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              row.revokedAt
                                ? "border-zinc-700 text-zinc-400"
                                : new Date(row.expiresAt).getTime() <= Date.now()
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            }`}
                          >
                            {row.revokedAt ? "Revoked" : new Date(row.expiresAt).getTime() <= Date.now() ? "Expired" : "Active"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleCopySnapshotLink(row.token, row.id)}
                              className="min-h-9 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-500"
                              disabled={Boolean(row.revokedAt) || new Date(row.expiresAt).getTime() <= Date.now()}
                            >
                              {snapshotCopiedId === row.id ? "Copied" : "Copy link"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRevokeSnapshot(row.id)}
                              className="min-h-9 rounded border border-rose-700/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-200 hover:border-rose-500/70 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={Boolean(row.revokedAt) || isDemoReadOnly}
                              title={isDemoReadOnly ? "Simulation account is read-only." : undefined}
                            >
                              Revoke
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </>
          ) : null}

          <SystemEventLogPanel
            events={systemEvents}
            loading={systemEventsLoading}
            error={systemEventsError}
            zeroDataState={isZeroDataState}
            filter={eventLogFilter}
            onFilterChange={setEventLogFilter}
          />

          {!isSimplifiedView && !data.featureAccess.allStats ? (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-100">{t("unlockAdvanced", locale)}</p>
              <p className="mt-1 text-xs text-amber-100/70">
                {t("deeperTrend", locale)}
              </p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:border-amber-400"
              >
                {t("upgrade", locale)}
              </Link>
            </section>
          ) : null}
        </div>
      </main>
      <CheckInModal
        open={checkInModalOpen}
        dateISO={checkInModalDate ?? selectedDate}
        activeProtocol={activeProtocolForCheckin}
        onClose={closeCheckInModal}
        onSaved={handleCheckInSaved}
      />
      <ExportSystemLogModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <StateExplanationModal
        open={stateExplanationOpen}
        onClose={() => setStateExplanationOpen(false)}
        explanation={stateExplanation}
        locale={locale}
      />
      <SystemResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} onDone={handleResetDone} />
      <DeleteAccountModal
        open={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        onDone={handleAccountDeleted}
      />
      <AntiChaosModal
        open={antiChaosOpen}
        onClose={() => setAntiChaosOpen(false)}
        protocol={antiChaosProtocol}
        isPro={data.featureAccess.antiChaos}
      />
      <DiagnosisBreakdownModal
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        executiveSummary={data.executiveSummary}
        patterns={data.patterns}
        calibration={data.calibration}
        breakdown={data.breakdown}
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
      <SystemReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportText={reportText}
        supportEmail={supportEmail}
      />
      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </>
  );
}

