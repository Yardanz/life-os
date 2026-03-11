"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ControlRoomDashboardProps } from "@/components/control-room/ControlRoomDashboard";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import type { CheckinSaveResult } from "@/components/checkin/DailyCheckinForm";
import { ProjectionScenarioChart } from "@/components/control-room/ProjectionScenarioChart";
import { DeleteAccountModal } from "@/components/control-room/DeleteAccountModal";
import { ExportSystemLogModal } from "@/components/control-room/ExportSystemLogModal";
import { SystemResetModal } from "@/components/control-room/SystemResetModal";
import { GlossaryModal } from "@/components/ui/GlossaryModal";
import { SystemReportModal } from "@/components/ui/SystemReportModal";
import { buildStateExplanation } from "@/lib/control-room/stateExplanation";
import { deriveSystemStatus } from "@/lib/control-room/systemStatus";
import { getCalibrationStage } from "@/lib/calibrationStage";
import { buildSystemReport } from "@/lib/systemReport";
import { addDaysISO, getLocalISODate, parseISODateParam } from "@/lib/date/localDate";
import { DEFAULT_TZ_OFFSET_MINUTES, getDayKeyAtOffset } from "@/lib/date/dayKey";
import { AdvancedControls } from "@/components/control-room/v2/AdvancedControls";
import { NextActionCard } from "@/components/control-room/v2/NextActionCard";
import { SystemDetailsModal } from "@/components/control-room/v2/SystemDetailsModal";
import { SystemStatusCard } from "@/components/control-room/v2/SystemStatusCard";
import { TrajectoryCard } from "@/components/control-room/v2/TrajectoryCard";
import { SystemEvolutionStrip } from "@/components/control-room/v2/SystemEvolutionStrip";
import { UnlockNotice } from "@/components/control-room/v2/UnlockNotice";
import { LockedSectionCard } from "@/components/control-room/v2/LockedSectionCard";
import { PartialDiagnosticsSection } from "@/components/control-room/v2/PartialDiagnosticsSection";
import { FullDiagnosticsSection } from "@/components/control-room/v2/FullDiagnosticsSection";
import { SystemEvolutionModal, type EvolutionDay, type EvolutionModalMode, type EvolutionTrack } from "@/components/control-room/v2/SystemEvolutionModal";
import { OnboardingTutorialModal } from "@/components/control-room/v2/OnboardingTutorialModal";
import type { ControlRoomV2ApiResponse, ControlRoomV2Data, ProtocolRunRecord } from "@/components/control-room/v2/types";
import {
  getDiagnosticLevel,
  getNextCheckinAvailability,
  getNextCheckinAvailabilityFromDailyRule,
  getSystemEvolutionStage,
} from "@/components/control-room/v2/systemEvolution";

type SetupStatePayload = {
  onboardingCompleted: boolean;
  welcomeModalSeen: boolean;
  totalCheckins: number;
  onboardingProgressCheckins: number;
  calibrationCheckinsDone: number;
  calibrationCheckinsNeeded: number;
  confidence: number;
  confidencePct: number;
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

type ProjectionApiResponse =
  | { ok: true; data: { projection30d: Projection30d | null } }
  | { ok: false; error?: string; message?: string };

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
const CHECKIN_STORAGE_PREFIX = "lifeos.checkin";
const CONTROL_ROOM_INIT_MIN_MS = 420;

function clearCheckinLocalCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToDelete: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(`${CHECKIN_STORAGE_PREFIX}.`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // no-op
  }
}

type EmptyOperationalSectionCardProps = {
  title: string;
  onRecordFirstCheckin: () => void;
};

function EmptyOperationalSectionCard({ title, onRecordFirstCheckin }: EmptyOperationalSectionCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
        <p className="text-sm font-medium text-zinc-100">No operational data yet.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Record your first daily check-in
          <br />
          to initialize system telemetry.
        </p>
      </div>
      <button
        type="button"
        onClick={onRecordFirstCheckin}
        className="mt-3 min-h-10 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400"
      >
        Record first check-in
      </button>
    </section>
  );
}

export function ControlRoomV2({
  userId = "demo-user",
  demoMode = false,
  appVersion = "dev",
  supportEmail = null,
  initialSelectedDate,
  latestCheckinDate = null,
  initialActiveProtocol = null,
}: ControlRoomDashboardProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const selectedDate = parseISODateParam(searchParams.get("date")) ?? initialSelectedDate ?? getLocalISODate();
  const [tzOffsetMinutes, setTzOffsetMinutes] = useState<number>(DEFAULT_TZ_OFFSET_MINUTES);
  const todayDayKey = useMemo(() => getDayKeyAtOffset(new Date(), tzOffsetMinutes), [tzOffsetMinutes]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ControlRoomV2Data | null>(null);
  const [setupState, setSetupState] = useState<SetupStatePayload | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [timerNow, setTimerNow] = useState(new Date());
  const [initUiMinElapsed, setInitUiMinElapsed] = useState(false);
  const hasFinishedInitialLoadRef = useRef(false);

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInModalDate, setCheckInModalDate] = useState<string | null>(null);
  const [checkInModalUseYesterday, setCheckInModalUseYesterday] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeModalSaving, setWelcomeModalSaving] = useState(false);
  const [welcomeModalError, setWelcomeModalError] = useState<string | null>(null);
  const [welcomeModalAcknowledged, setWelcomeModalAcknowledged] = useState(false);
  const [stateDetailsOpen, setStateDetailsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);
  const [fallbackFromDate, setFallbackFromDate] = useState<string | null>(null);
  const [evolutionModalOpen, setEvolutionModalOpen] = useState(false);
  const [evolutionModalTrack, setEvolutionModalTrack] = useState<EvolutionTrack | null>(null);
  const [evolutionModalDay, setEvolutionModalDay] = useState<EvolutionDay | null>(null);
  const [evolutionModalUnlocked, setEvolutionModalUnlocked] = useState(false);
  const [evolutionModalMode, setEvolutionModalMode] = useState<EvolutionModalMode>("manual");
  const [evolutionModalIncludeOperatorSection, setEvolutionModalIncludeOperatorSection] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<{
    date: string;
    lifeScore: number;
    recovery: number;
    load: number;
    risk: number;
  } | null>(null);
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
  const preSubmitCheckinCountRef = useRef<number>(0);
  const pendingMilestoneCheckRef = useRef<number | null>(null);
  const autoOpenedMilestonesRef = useRef<Set<EvolutionDay>>(new Set());
  const welcomeSeenPersistingRef = useRef(false);

  useEffect(() => {
    const detectedOffset = -new Date().getTimezoneOffset();
    if (Number.isFinite(detectedOffset)) {
      setTzOffsetMinutes(Math.trunc(detectedOffset));
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTimerNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInitUiMinElapsed(true);
    }, CONTROL_ROOM_INIT_MIN_MS);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const activeProtocol = useMemo(() => {
    if (!initialActiveProtocol?.appliedAt) return null;
    const expiresAt = new Date(initialActiveProtocol.appliedAt).getTime() + initialActiveProtocol.horizonHours * 60 * 60 * 1000;
    if (Date.now() >= expiresAt) return null;
    return initialActiveProtocol as ProtocolRunRecord;
  }, [initialActiveProtocol]);

  const loadSetupState = useCallback(async () => {
    try {
      const response = await fetch("/api/setup/state", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { ok?: boolean; data?: SetupStatePayload };
      if (payload.ok && payload.data) {
        setSetupState(payload.data);
      }
    } catch {
      setSetupState(null);
    }
  }, []);

  const markWelcomeSeen = useCallback(
    async (options?: { suppressError?: boolean }): Promise<boolean> => {
      if (setupState?.welcomeModalSeen || welcomeSeenPersistingRef.current) {
        return true;
      }
      try {
        welcomeSeenPersistingRef.current = true;
        const response = await fetch("/api/setup/complete-welcome", { method: "POST" });
        const payload = (await response.json()) as { ok?: boolean; error?: string; data?: SetupStatePayload };
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? "Failed to complete welcome flow.");
        }
        setSetupState(payload.data);
        setWelcomeModalError(null);
        return true;
      } catch (welcomeError) {
        if (!options?.suppressError) {
          setWelcomeModalError(
            welcomeError instanceof Error ? welcomeError.message : "Failed to complete welcome flow."
          );
        }
        return false;
      } finally {
        welcomeSeenPersistingRef.current = false;
      }
    },
    [setupState?.welcomeModalSeen]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setFallbackFromDate(null);
      try {
        const response = await fetch(`/api/control-room?userId=${userId}&date=${selectedDate}&tzOffsetMinutes=${tzOffsetMinutes}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ControlRoomV2ApiResponse;
        if (!response.ok || !("ok" in payload) || !payload.ok) {
          if ("code" in payload && payload.code === "CHECKIN_NOT_FOUND") {
            if (latestCheckinDate) {
              const fallbackResponse = await fetch(
                `/api/control-room?userId=${userId}&date=${latestCheckinDate}&tzOffsetMinutes=${tzOffsetMinutes}`,
                { cache: "no-store" }
              );
              const fallbackPayload = (await fallbackResponse.json()) as ControlRoomV2ApiResponse;
              if (fallbackResponse.ok && "ok" in fallbackPayload && fallbackPayload.ok) {
                setData(fallbackPayload.data);
                setFallbackFromDate(selectedDate);
                return;
              }
            }
            setData(null);
            return;
          }
          throw new Error(("message" in payload && payload.message) || ("error" in payload && payload.error) || "Failed to load control room.");
        }
        setData(payload.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load control room.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [selectedDate, tzOffsetMinutes, userId, reloadKey, latestCheckinDate]);

  useEffect(() => {
    void loadSetupState();
  }, [loadSetupState, reloadKey]);

  useEffect(() => {
    if (!setupState) return;
    if (!setupState.welcomeModalSeen && !welcomeModalAcknowledged) {
      setWelcomeModalError(null);
      setWelcomeModalOpen(true);
      setWelcomeModalAcknowledged(true);
      void markWelcomeSeen({ suppressError: true });
      return;
    }
    if (setupState.welcomeModalSeen && !welcomeModalAcknowledged) {
      setWelcomeModalOpen(false);
    }
  }, [markWelcomeSeen, setupState, welcomeModalAcknowledged]);

  useEffect(() => {
    let cancelled = false;

    const loadPreviousMetrics = async () => {
      if (!data?.date) {
        setPreviousMetrics(null);
        return;
      }

      for (let offset = 1; offset <= 14; offset += 1) {
        const prevDate = addDaysISO(data.date, -offset);
        try {
          const response = await fetch(`/api/control-room?userId=${userId}&date=${prevDate}&tzOffsetMinutes=${tzOffsetMinutes}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as ControlRoomV2ApiResponse;
          if (cancelled) return;

          if (response.ok && "ok" in payload && payload.ok) {
            setPreviousMetrics({
              date: payload.data.date,
              lifeScore: payload.data.snapshot.lifeScore,
              recovery: payload.data.systemMetrics.recovery,
              load: payload.data.systemMetrics.load,
              risk: payload.data.systemMetrics.risk,
            });
            return;
          }

          if ("code" in payload && payload.code === "CHECKIN_NOT_FOUND") {
            continue;
          }
          break;
        } catch {
          break;
        }
      }

      if (!cancelled) {
        setPreviousMetrics(null);
      }
    };

    void loadPreviousMetrics();
    return () => {
      cancelled = true;
    };
  }, [data?.date, tzOffsetMinutes, userId]);

  const openEvolutionModal = useCallback(
    (
      track: EvolutionTrack,
      day: EvolutionDay,
      unlocked: boolean,
      options?: {
        mode?: EvolutionModalMode;
        includeOperatorSection?: boolean;
      }
    ) => {
      setEvolutionModalTrack(track);
      setEvolutionModalDay(day);
      setEvolutionModalUnlocked(unlocked);
      setEvolutionModalMode(options?.mode ?? "manual");
      setEvolutionModalIncludeOperatorSection(options?.includeOperatorSection ?? false);
      setEvolutionModalOpen(true);
    },
    []
  );

  const handleStageClick = useCallback(
    (track: EvolutionTrack, day: EvolutionDay, unlocked: boolean) => {
      openEvolutionModal(track, day, unlocked, { mode: "manual", includeOperatorSection: false });
    },
    [openEvolutionModal]
  );

  const openCheckInModal = (dateISO: string, useYesterday = false) => {
    preSubmitCheckinCountRef.current = totalCheckins;
    setCheckInModalUseYesterday(useYesterday);
    setCheckInModalDate(dateISO);
    setCheckInModalOpen(true);
  };

  const closeCheckInModal = () => {
    setCheckInModalOpen(false);
    setCheckInModalDate(null);
    setCheckInModalUseYesterday(false);
  };

  const setDateInUrl = useCallback(
    (dateISO: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("date", dateISO);
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const isDemoReadOnly = demoMode || Boolean(data?.demoMode);

  const completeWelcomeFlow = useCallback(
    async (afterComplete?: () => void) => {
      if (welcomeModalSaving) return;
      try {
        setWelcomeModalSaving(true);
        setWelcomeModalError(null);
        const ok = await markWelcomeSeen();
        if (!ok) {
          return;
        }
        setWelcomeModalAcknowledged(true);
        setWelcomeModalOpen(false);
        afterComplete?.();
      } catch (welcomeError) {
        setWelcomeModalError(welcomeError instanceof Error ? welcomeError.message : "Failed to complete welcome flow.");
      } finally {
        setWelcomeModalSaving(false);
      }
    },
    [markWelcomeSeen, welcomeModalSaving]
  );

  const handleWelcomeContinue = () => {
    if (setupState?.welcomeModalSeen) {
      setWelcomeModalError(null);
      setWelcomeModalOpen(false);
      return;
    }
    void completeWelcomeFlow();
  };

  const handleWelcomeBeginCheckin = () => {
    if (setupState?.welcomeModalSeen) {
      setWelcomeModalError(null);
      setWelcomeModalOpen(false);
      openCheckInModal(todayDayKey);
      return;
    }
    void completeWelcomeFlow(() => openCheckInModal(todayDayKey));
  };

  const handleWelcomeClose = useCallback(() => {
    setWelcomeModalError(null);
    setWelcomeModalOpen(false);
    setWelcomeModalAcknowledged(true);
    if (!setupState?.welcomeModalSeen) {
      void markWelcomeSeen({ suppressError: true });
    }
  }, [markWelcomeSeen, setupState?.welcomeModalSeen]);

  const handleOpenTutorial = () => {
    setWelcomeModalError(null);
    setWelcomeModalOpen(true);
  };

  const handleCheckInSaved = (result: CheckinSaveResult) => {
    const unlockedDay = result.newlyUnlockedMilestone;
    if (unlockedDay) {
      if (!autoOpenedMilestonesRef.current.has(unlockedDay)) {
        autoOpenedMilestonesRef.current.add(unlockedDay);
        if (unlockedDay === 7) {
          setUnlockNotice("System fully stabilized: Full diagnostics available (depth depends on plan entitlement)");
        } else if (unlockedDay === 5) {
          setUnlockNotice("New capability unlocked: Partial diagnostics");
        } else {
          setUnlockNotice("New capability unlocked: Trajectory");
        }
        openEvolutionModal("base", unlockedDay, true, {
          mode: "auto",
          includeOperatorSection: operatorPlanEnabled,
        });
      }
      pendingMilestoneCheckRef.current = null;
    } else {
      pendingMilestoneCheckRef.current = preSubmitCheckinCountRef.current;
    }

    setSetupState((prev) =>
      prev
        ? {
            ...prev,
            totalCheckins: result.totalCompletedCheckins,
            calibrationCheckinsDone: result.totalCompletedCheckins,
            onboardingProgressCheckins: result.onboardingProgressCheckins,
          }
        : prev
    );
    const targetDate = checkInModalDate ?? selectedDate;
    setResetModalOpen(false);
    setCheckInModalOpen(false);
    setCheckInModalDate(null);
    setCheckInModalUseYesterday(false);
    setReloadKey((value) => value + 1);
    if (targetDate !== selectedDate) {
      setDateInUrl(targetDate);
    }
  };

  const handleResetDone = () => {
    setResetModalOpen(false);
    clearCheckinLocalCache();
    setWelcomeModalAcknowledged(false);
    setWelcomeModalOpen(false);
    setWelcomeModalError(null);
    setReloadKey((value) => value + 1);
  };

  const handleAccountDeleted = async () => {
    setDeleteAccountModalOpen(false);
    await signOut({ callbackUrl: "/" });
  };
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const effectivePlan = useMemo<"FREE" | "PRO">(() => data?.plan ?? "FREE", [data?.plan]);
  const operatorPlanEnabled = effectivePlan === "PRO";
  const confidencePctRaw = (setupState?.confidence ?? data?.modelConfidence.confidence ?? 0) * 100;
  const confidencePct = Math.max(0, Math.min(100, Math.round(confidencePctRaw)));
  // Hard invariant: real completed check-ins are unbounded and must never be capped for logic.
  const totalCheckins =
    setupState?.totalCheckins ??
    data?.totalCheckins ??
    setupState?.calibrationCheckinsDone ??
    data?.series7d.length ??
    0;
  // Onboarding progress is a separate bounded value used only for Day 1/3/5/7 milestone UX.
  const onboardingProgressCheckins = setupState?.onboardingProgressCheckins ?? Math.max(0, Math.min(7, totalCheckins));
  const evolution = useMemo(() => getSystemEvolutionStage(onboardingProgressCheckins), [onboardingProgressCheckins]);
  const diagnosticLevel = useMemo(() => getDiagnosticLevel(onboardingProgressCheckins), [onboardingProgressCheckins]);

  const trajectoryUnlocked = evolution.unlocked.trajectory;
  const explainUnlocked = onboardingProgressCheckins >= 5;
  const partialDiagnosticsUnlocked = diagnosticLevel >= 1;
  const operatorInsightsUnlocked = diagnosticLevel === 2;
  const lifeScoreDirection = useMemo<"up" | "flat" | "down">(() => {
    const points = data?.series7d ?? [];
    if (points.length < 2) return "flat";
    const first = points[0]?.lifeScore ?? 0;
    const last = points[points.length - 1]?.lifeScore ?? 0;
    if (last - first > 1) return "up";
    if (last - first < -1) return "down";
    return "flat";
  }, [data?.series7d]);
  const lifeScoreTrendDelta = useMemo(() => {
    const points = data?.series7d ?? [];
    if (points.length < 2) return 0;
    const first = points[0]?.lifeScore ?? 0;
    const last = points[points.length - 1]?.lifeScore ?? first;
    return last - first;
  }, [data?.series7d]);
  const showAdvancedTrajectory = operatorPlanEnabled && onboardingProgressCheckins >= 3 && (data?.featureAccess?.forecast30d ?? true);

  useEffect(() => {
    if (!showAdvancedTrajectory || !data) {
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
          fetch(`/api/projection?userId=${userId}&date=${selectedDate}&currentRisk=${data.systemMetrics.risk.toFixed(1)}`, {
            cache: "no-store",
          }),
          fetch(`/api/projection/envelope?userId=${userId}&date=${selectedDate}&currentRisk=${data.systemMetrics.risk.toFixed(1)}`, {
            cache: "no-store",
          }),
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
          projectionFetchError instanceof Error ? projectionFetchError.message : "Failed to load 30-day projection.";
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
  }, [data, data?.systemMetrics.risk, selectedDate, showAdvancedTrajectory, userId]);

  const applyCustomProjection = useCallback(async () => {
    if (!showAdvancedTrajectory || !data) return;
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
            workoutForcedOff: data.guardrail.label === "LOCKDOWN",
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
        customProjectionError instanceof Error ? customProjectionError.message : "Failed to compute custom projection.";
      setProjectionError(message);
      setCustomProjection(null);
      setCustomDeltasAt30d(null);
    } finally {
      setCustomLoading(false);
    }
  }, [data, projectionModifiers, selectedDate, showAdvancedTrajectory, userId]);

  const resetCustomProjection = useCallback(() => {
    setProjectionModifiers({
      sleepMinutesDelta: 0,
      deepWorkPctDelta: 0,
      stressDelta: 0,
    });
    setCustomProjection(null);
    setCustomDeltasAt30d(null);
  }, []);

  useEffect(() => {
    const before = pendingMilestoneCheckRef.current;
    if (before == null) return;
    if (totalCheckins > before) {
      let reachedDay: EvolutionDay | null = null;
      if (before < 7 && totalCheckins >= 7) {
        reachedDay = 7;
        setUnlockNotice("System fully stabilized: Full diagnostics available (depth depends on plan entitlement)");
      } else if (before < 5 && totalCheckins >= 5) {
        reachedDay = 5;
        setUnlockNotice("New capability unlocked: Partial diagnostics");
      } else if (before < 3 && totalCheckins >= 3) {
        reachedDay = 3;
        setUnlockNotice("New capability unlocked: Trajectory");
      }

      if (reachedDay && !autoOpenedMilestonesRef.current.has(reachedDay)) {
        autoOpenedMilestonesRef.current.add(reachedDay);
        openEvolutionModal("base", reachedDay, true, {
          mode: "auto",
          includeOperatorSection: operatorPlanEnabled,
        });
      }
    }
    pendingMilestoneCheckRef.current = null;
  }, [openEvolutionModal, operatorPlanEnabled, totalCheckins]);

  useEffect(() => {
    if (!unlockNotice) return;
    const timeoutId = window.setTimeout(() => setUnlockNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [unlockNotice]);

  const calibrationStage = getCalibrationStage(
    onboardingProgressCheckins,
    setupState?.confidence ?? data?.modelConfidence.confidence ?? null
  );

  const authorityStatus = useMemo(
    () =>
      deriveSystemStatus({
        guardrailState: data?.guardrail.label ?? "OPEN",
        integrityState: data?.integrity.state ?? null,
        hasActiveProtocol: Boolean(activeProtocol),
        risk24h: data?.systemMetrics.risk ?? null,
        modelConfidence: confidencePct,
        calibrationStage: calibrationStage.stage,
      }),
    [activeProtocol, calibrationStage.stage, confidencePct, data?.guardrail.label, data?.integrity.state, data?.systemMetrics.risk]
  );

  const stateExplanation = useMemo(
    () =>
      buildStateExplanation({
        guardrailState: data?.guardrail.label ?? "OPEN",
        lifeScore: data?.snapshot.lifeScore ?? null,
        load: data?.systemMetrics.load ?? null,
        recovery: data?.systemMetrics.recovery ?? null,
        risk: data?.systemMetrics.risk ?? null,
        confidence: data?.modelConfidence.confidence ?? null,
        calibrationCheckinsDone: onboardingProgressCheckins,
        calibrationCheckinsNeeded: setupState?.calibrationCheckinsNeeded ?? 7,
        lastCheckin: data?.checkinSnapshot ?? null,
        activeProtocol: activeProtocol
          ? {
              state: activeProtocol.guardrailState,
              horizonHours: activeProtocol.horizonHours,
              mode: activeProtocol.mode ?? "STANDARD",
            }
          : null,
        integrity: data?.integrity ? { score: data.integrity.score, state: data.integrity.state } : null,
      }),
    [activeProtocol, data, onboardingProgressCheckins, setupState?.calibrationCheckinsNeeded]
  );

  const lastCheckinAt = useMemo(() => {
    const raw = latestCheckinDate ?? data?.checkinSnapshot?.date ?? null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }, [data?.checkinSnapshot?.date, latestCheckinDate]);
  const nextCheckinAvailability = useMemo(() => {
    if (typeof data?.todayCheckInExists === "boolean") {
      return getNextCheckinAvailabilityFromDailyRule(data.todayCheckInExists, timerNow, tzOffsetMinutes);
    }
    return getNextCheckinAvailability(lastCheckinAt, timerNow);
  }, [data?.todayCheckInExists, lastCheckinAt, timerNow, tzOffsetMinutes]);

  const interpretationLines =
    stateExplanation.lines.length > 0
      ? stateExplanation.lines.slice(0, 3)
      : ["Record daily check-in to refresh guidance."];
  const confidenceHint =
    calibrationStage.stage === "STABILIZED"
      ? "Model confidence high"
      : confidencePct >= 60
        ? "Model baseline stabilizing"
        : "Calibration in progress";
  const operationalDate = todayDayKey;
  const hasCheckinForOperationalDate = Boolean(data?.todayCheckInExists);
  const checkinMode: "create" | "edit" = hasCheckinForOperationalDate ? "edit" : "create";
  const actionDate = operationalDate;
  const showEvolutionBlock = totalCheckins <= 7;
  const remainingWindowLabel =
    nextCheckinAvailability.msRemaining == null
      ? null
      : `${String(Math.floor(Math.ceil(nextCheckinAvailability.msRemaining / 60_000) / 60)).padStart(2, "0")}:${String(
          Math.ceil(nextCheckinAvailability.msRemaining / 60_000) % 60
        ).padStart(2, "0")}`;
  const nextWindowStatus = nextCheckinAvailability.availableNow
    ? "Check-in available now"
    : remainingWindowLabel
      ? `Next window in ${remainingWindowLabel}`
      : "Next window pending";
  const primaryActionLabel = checkinMode === "edit" ? "Update daily check-in" : "Record daily check-in";
  const nextActionTitle = checkinMode === "edit" ? "Update daily check-in" : "Record daily check-in";
  const nextActionDescription = "New check-ins update the current operational day.";
  const actionModeLabel = checkinMode === "edit" ? "UPDATE" : "RECORD";
  const nextActionStatusItems = [`Operational date: ${operationalDate}`, `Action mode: ${actionModeLabel}`, nextWindowStatus];
  const openAntiChaosControls = () => {
    if (typeof document === "undefined") return;
    const target = document.getElementById("advanced-trajectory-controls");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
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
      confidencePct,
      activeProtocol: activeProtocol
        ? {
            state: activeProtocol.guardrailState,
            horizonHours: activeProtocol.horizonHours,
            mode: activeProtocol.mode ?? "STANDARD",
          }
        : null,
      integrity: data?.integrity ? { score: data.integrity.score, state: data.integrity.state } : null,
      lastErrorId: null,
    });
  }, [activeProtocol, appVersion, confidencePct, data, isDemoReadOnly, pathname, searchParams]);

  const controlRoomLabel = (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">CONTROL ROOM</p>
      <p className="mt-0.5 text-xs text-zinc-500">Operational interface</p>
    </section>
  );

  if (!loading) {
    hasFinishedInitialLoadRef.current = true;
  }
  const showInitializationScreen = !hasFinishedInitialLoadRef.current || !initUiMinElapsed;

  if (showInitializationScreen) {
    return (
      <main id="main-content" className="control-room-main min-h-screen overflow-x-hidden bg-transparent px-3 py-7 text-zinc-100 sm:px-6 sm:py-10">
        <section className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">CONTROL ROOM</p>
          <div className="mt-3 h-px overflow-hidden rounded bg-zinc-800/90">
            <div className={`h-full bg-cyan-400/65 transition-all duration-150 ${loading ? "w-1/2 animate-pulse" : "w-full"}`} />
          </div>
          <div aria-live="polite" className="mt-3 space-y-2.5 text-sm">
            <p className="flex items-center gap-2 text-zinc-100">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-300/80 animate-pulse" />
              Initializing LIFE OS...
            </p>
            <p className="flex items-center gap-2 text-zinc-300">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full border border-zinc-600 ${loading ? "bg-zinc-500/70 animate-pulse" : "bg-emerald-300/85 border-emerald-400/40"}`}
              />
              Loading operational data...
            </p>
            <p className={`flex items-center gap-2 transition-opacity duration-150 ${loading ? "opacity-35 text-zinc-500" : "opacity-100 text-emerald-200"}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-zinc-600" : "bg-emerald-300/90"}`} />
              Control Room ready.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main id="main-content" className="control-room-main min-h-screen overflow-x-hidden bg-transparent px-3 py-7 text-zinc-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-zinc-900" />
          <div className="h-44 rounded-2xl bg-zinc-900" />
          <div className="h-44 rounded-2xl bg-zinc-900" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main-content" className="control-room-main min-h-screen overflow-x-hidden bg-transparent px-3 py-7 text-zinc-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-500/40 bg-rose-950/20 p-5">
          <h1 className="text-lg font-semibold text-rose-200">Control Room unavailable</h1>
          <p className="mt-2 text-sm text-rose-200/80">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <>
        <main id="main-content" className="control-room-main min-h-screen overflow-x-hidden bg-transparent px-3 py-7 text-zinc-100 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
            {controlRoomLabel}
            <SystemStatusCard
              lifeScore={0}
              direction="flat"
              lifeScoreTrendDelta={0}
              state="OPEN"
              confidencePct={Math.max(0, Math.min(100, Math.round((setupState?.confidence ?? 0) * 100)))}
              interpretationLines={["No check-in recorded yet.", "State will become personalized after your first check-in."]}
              riskValue={null}
              recoveryValue={null}
              loadValue={null}
              confidenceHint="Calibration in progress"
              onGoHome={() => router.push("/")}
              onExplain={() => setStateDetailsOpen(true)}
              explainUnlocked={false}
              lockedHint="Unlocks at Day 5"
            />
            <NextActionCard
              title={nextActionTitle}
              description={nextActionDescription}
              statusItems={nextActionStatusItems}
              primaryLabel={primaryActionLabel}
              onPrimaryAction={() => openCheckInModal(actionDate)}
              onViewLastCheckin={null}
            />
            <EmptyOperationalSectionCard
              title="Trajectory telemetry"
              onRecordFirstCheckin={() => openCheckInModal(actionDate)}
            />
            <EmptyOperationalSectionCard
              title="System telemetry"
              onRecordFirstCheckin={() => openCheckInModal(actionDate)}
            />
            <AdvancedControls
              readOnly={isDemoReadOnly}
              onExport={() => setExportModalOpen(true)}
              onExplain={() => setStateDetailsOpen(true)}
              onReportIssue={() => setReportModalOpen(true)}
              onGlossary={() => setGlossaryOpen(true)}
              onLogout={handleLogout}
              onReset={() => setResetModalOpen(true)}
              onDelete={() => setDeleteAccountModalOpen(true)}
            />
            {showEvolutionBlock ? (
              <SystemEvolutionStrip
                currentDay={evolution.currentDay}
                onboardingProgressCheckins={evolution.onboardingProgressCheckins}
                nextUnlockDay={evolution.nextUnlockDay}
                operatorPlanEnabled={operatorPlanEnabled}
                collapsible
                onOpenTutorial={handleOpenTutorial}
                onStageClick={handleStageClick}
              />
            ) : null}
          </div>
        </main>
        <CheckInModal
          open={checkInModalOpen}
          dateISO={checkInModalDate ?? selectedDate}
          startWithYesterday={checkInModalUseYesterday}
          baselineLifeScore={null}
          activeProtocol={null}
          onClose={closeCheckInModal}
          onSaved={handleCheckInSaved}
        />
        <SystemEvolutionModal
          open={evolutionModalOpen}
          track={evolutionModalTrack}
          day={evolutionModalDay}
          unlocked={evolutionModalUnlocked}
          plan={effectivePlan}
          mode={evolutionModalMode}
          includeOperatorSection={evolutionModalIncludeOperatorSection}
          onClose={() => {
            setEvolutionModalOpen(false);
            setEvolutionModalTrack(null);
            setEvolutionModalDay(null);
            setEvolutionModalUnlocked(false);
            setEvolutionModalMode("manual");
            setEvolutionModalIncludeOperatorSection(false);
          }}
        />
        <OnboardingTutorialModal
          open={welcomeModalOpen}
          saving={welcomeModalSaving}
          error={welcomeModalError}
          onClose={handleWelcomeClose}
          onFinish={handleWelcomeContinue}
          onBeginCheckin={handleWelcomeBeginCheckin}
        />
      </>
    );
  }

  return (
    <>
      <main id="main-content" className="control-room-main min-h-screen overflow-x-hidden bg-transparent px-3 py-6 text-zinc-100 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
          {controlRoomLabel}
          {fallbackFromDate && data?.date ? (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              No check-in for selected date {fallbackFromDate}. Showing latest available data from {data.date}.
            </section>
          ) : null}
          <UnlockNotice message={unlockNotice} onClose={() => setUnlockNotice(null)} />

          <SystemStatusCard
            lifeScore={data.snapshot.lifeScore}
            direction={lifeScoreDirection}
            lifeScoreTrendDelta={lifeScoreTrendDelta}
            state={data.guardrail.label}
            confidencePct={confidencePct}
            interpretationLines={interpretationLines}
            riskValue={data.systemMetrics.risk}
            recoveryValue={data.systemMetrics.recovery}
            loadValue={data.systemMetrics.load}
            confidenceHint={confidenceHint}
            onGoHome={() => router.push("/")}
            onExplain={() => setStateDetailsOpen(true)}
            explainUnlocked={explainUnlocked}
            lockedHint="Unlocks at Day 5"
          />

          <NextActionCard
            title={nextActionTitle}
            description={nextActionDescription}
            statusItems={nextActionStatusItems}
            primaryLabel={primaryActionLabel}
            onPrimaryAction={() => openCheckInModal(actionDate)}
            onViewLastCheckin={latestCheckinDate ? () => openCheckInModal(latestCheckinDate) : null}
          />

          {trajectoryUnlocked ? (
            <section className="space-y-3 sm:space-y-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">SYSTEM TELEMETRY</p>
              <TrajectoryCard points={data.series7d} risk={data.systemMetrics.risk} recovery={data.systemMetrics.recovery} />
              {showAdvancedTrajectory ? (
                projectionLoading ? (
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <div className="h-6 w-40 animate-pulse rounded bg-zinc-800" />
                    <div className="mt-3 h-52 animate-pulse rounded bg-zinc-900" />
                  </section>
                ) : projectionError ? (
                  <section className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 text-sm text-rose-200">{projectionError}</section>
                ) : projection30d ? (
                  <div id="advanced-trajectory-controls">
                    <ProjectionScenarioChart
                      locale="en"
                      userId={data.userId}
                      readOnly={isDemoReadOnly}
                      projection={projection30d}
                      custom={customProjection}
                      deltasAt30d={customDeltasAt30d}
                      customLoading={customLoading}
                      modifiers={projectionModifiers}
                      onModifiersChange={setProjectionModifiers}
                      onApplyCustom={() => void applyCustomProjection()}
                      onResetCustom={resetCustomProjection}
                      selectedDateISO={selectedDate}
                      isPro={operatorPlanEnabled}
                      patternContext={{
                        systemMode: data.patterns?.systemMode ?? "UNDEFINED",
                        topPattern: data.patterns?.topPatterns?.[0]?.type ?? null,
                      }}
                      calibrationConfidence={data.calibration.confidence}
                      modelConfidence={{
                        confidence: data.modelConfidence.confidence,
                        notes: data.modelConfidence.notes ?? [],
                      }}
                      guardrail={{
                        level: data.guardrail.label === "LOCKDOWN" ? 2 : data.guardrail.label === "CAUTION" ? 1 : 0,
                        label: data.guardrail.label,
                        reasons: data.guardrail.reasons ?? [],
                        avgRisk14d: data.systemMetrics.risk,
                      }}
                      envelope72h={envelope72h}
                      impact72h={impact72h}
                      decisionBudget72h={decisionBudget72h}
                      matchTrajectoryStyle
                    />
                  </div>
                ) : null
              ) : null}
            </section>
          ) : (
            <LockedSectionCard title="Trajectory" unlockDay={3} />
          )}

          {diagnosticLevel === 2 ? (
            <FullDiagnosticsSection
              data={data}
              effectivePlan={effectivePlan}
              antiChaosActionEnabled={showAdvancedTrajectory}
              onOpenAntiChaosAction={openAntiChaosControls}
              previousMetrics={previousMetrics}
            />
          ) : partialDiagnosticsUnlocked ? (
            <PartialDiagnosticsSection
              plan={effectivePlan}
              antiChaosEnabled={operatorPlanEnabled && (data.featureAccess?.antiChaos ?? true)}
              antiChaosActionEnabled={showAdvancedTrajectory}
              onOpenAntiChaosAction={openAntiChaosControls}
              recovery={data.systemMetrics.recovery}
              load={data.systemMetrics.load}
              risk={data.systemMetrics.risk}
              driftState={data.integrity.state}
              driftScore={data.integrity.score}
              calibrationActive={data.calibration.active}
              calibrationConfidence={data.calibration.confidence}
            />
          ) : (
            <LockedSectionCard title="Partial diagnostics" unlockDay={5} />
          )}

          <AdvancedControls
            readOnly={isDemoReadOnly}
            onExport={() => setExportModalOpen(true)}
            onExplain={() => setStateDetailsOpen(true)}
            onReportIssue={() => setReportModalOpen(true)}
            onGlossary={() => setGlossaryOpen(true)}
            onLogout={handleLogout}
            onReset={() => setResetModalOpen(true)}
            onDelete={() => setDeleteAccountModalOpen(true)}
          />
          {showEvolutionBlock ? (
            <SystemEvolutionStrip
              currentDay={evolution.currentDay}
              onboardingProgressCheckins={evolution.onboardingProgressCheckins}
              nextUnlockDay={evolution.nextUnlockDay}
              operatorPlanEnabled={operatorPlanEnabled}
              collapsible
              onOpenTutorial={handleOpenTutorial}
              onStageClick={handleStageClick}
            />
          ) : null}
        </div>
      </main>

      <CheckInModal
        open={checkInModalOpen}
        dateISO={checkInModalDate ?? selectedDate}
        startWithYesterday={checkInModalUseYesterday}
        baselineLifeScore={data.snapshot.lifeScore}
        activeProtocol={
          activeProtocol
            ? {
                state: activeProtocol.protocol.state,
                horizonHours: activeProtocol.horizonHours,
                constraints: activeProtocol.protocol.constraints,
              }
            : null
        }
        onClose={closeCheckInModal}
        onSaved={handleCheckInSaved}
      />
      <SystemEvolutionModal
        open={evolutionModalOpen}
        track={evolutionModalTrack}
        day={evolutionModalDay}
        unlocked={evolutionModalUnlocked}
        plan={effectivePlan}
        mode={evolutionModalMode}
        includeOperatorSection={evolutionModalIncludeOperatorSection}
        onClose={() => {
          setEvolutionModalOpen(false);
          setEvolutionModalTrack(null);
          setEvolutionModalDay(null);
          setEvolutionModalUnlocked(false);
          setEvolutionModalMode("manual");
          setEvolutionModalIncludeOperatorSection(false);
        }}
      />
      <OnboardingTutorialModal
        open={welcomeModalOpen}
        saving={welcomeModalSaving}
        error={welcomeModalError}
        onClose={handleWelcomeClose}
        onFinish={handleWelcomeContinue}
        onBeginCheckin={handleWelcomeBeginCheckin}
      />
      <SystemDetailsModal
        open={stateDetailsOpen}
        onClose={() => setStateDetailsOpen(false)}
        data={data}
        activeProtocol={activeProtocol}
        authorityStatus={authorityStatus}
        explanation={stateExplanation}
        operatorInsightsUnlocked={operatorInsightsUnlocked}
      />
      <ExportSystemLogModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <SystemReportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} reportText={reportText} supportEmail={supportEmail} />
      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <SystemResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} onDone={handleResetDone} />
      <DeleteAccountModal open={deleteAccountModalOpen} onClose={() => setDeleteAccountModalOpen(false)} onDone={handleAccountDeleted} />
    </>
  );
}
