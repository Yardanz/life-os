"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ControlRoomDashboardProps } from "@/components/control-room/ControlRoomDashboard";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { DeleteAccountModal } from "@/components/control-room/DeleteAccountModal";
import { ExportSystemLogModal } from "@/components/control-room/ExportSystemLogModal";
import { SystemResetModal } from "@/components/control-room/SystemResetModal";
import { GlossaryModal } from "@/components/ui/GlossaryModal";
import { SystemReportModal } from "@/components/ui/SystemReportModal";
import { buildStateExplanation } from "@/lib/control-room/stateExplanation";
import { deriveSystemStatus } from "@/lib/control-room/systemStatus";
import { getCalibrationStage } from "@/lib/calibrationStage";
import { buildSystemReport } from "@/lib/systemReport";
import { getLocalISODate, parseISODateParam } from "@/lib/date/localDate";
import { DEFAULT_TZ_OFFSET_MINUTES, getDayKeyAtOffset } from "@/lib/date/dayKey";
import { AdvancedControls } from "@/components/control-room/v2/AdvancedControls";
import { NextActionCard } from "@/components/control-room/v2/NextActionCard";
import { SystemDetailsModal } from "@/components/control-room/v2/SystemDetailsModal";
import { SystemStatusCard } from "@/components/control-room/v2/SystemStatusCard";
import { TrajectoryCard } from "@/components/control-room/v2/TrajectoryCard";
import { SystemEvolutionStrip } from "@/components/control-room/v2/SystemEvolutionStrip";
import { CheckinProgressSummary } from "@/components/control-room/v2/CheckinProgressSummary";
import { NextCheckinTimer } from "@/components/control-room/v2/NextCheckinTimer";
import { UnlockNotice } from "@/components/control-room/v2/UnlockNotice";
import { LockedSectionCard } from "@/components/control-room/v2/LockedSectionCard";
import type { ControlRoomV2ApiResponse, ControlRoomV2Data, ProtocolRunRecord } from "@/components/control-room/v2/types";
import {
  getNextCheckinAvailability,
  getNextCheckinAvailabilityFromDailyRule,
  getSystemEvolutionStage,
} from "@/components/control-room/v2/systemEvolution";

type SetupStatePayload = {
  onboardingCompleted: boolean;
  calibrationCheckinsDone: number;
  calibrationCheckinsNeeded: number;
  confidence: number;
  confidencePct: number;
};

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

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInModalDate, setCheckInModalDate] = useState<string | null>(null);
  const [stateDetailsOpen, setStateDetailsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);
  const preSubmitCheckinCountRef = useRef<number>(0);
  const pendingMilestoneCheckRef = useRef<number | null>(null);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/control-room?userId=${userId}&date=${selectedDate}&tzOffsetMinutes=${tzOffsetMinutes}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ControlRoomV2ApiResponse;
        if (!response.ok || !("ok" in payload) || !payload.ok) {
          if ("code" in payload && payload.code === "CHECKIN_NOT_FOUND") {
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
  }, [selectedDate, tzOffsetMinutes, userId, reloadKey]);

  useEffect(() => {
    void loadSetupState();
  }, [loadSetupState, reloadKey]);

  const openCheckInModal = (dateISO: string) => {
    preSubmitCheckinCountRef.current = checkinCount;
    setCheckInModalDate(dateISO);
    setCheckInModalOpen(true);
  };

  const closeCheckInModal = () => {
    setCheckInModalOpen(false);
    setCheckInModalDate(null);
  };

  const handleCheckInSaved = () => {
    pendingMilestoneCheckRef.current = preSubmitCheckinCountRef.current;
    const targetDate = checkInModalDate ?? selectedDate;
    setCheckInModalOpen(false);
    setCheckInModalDate(null);
    setReloadKey((value) => value + 1);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", targetDate);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    router.refresh();
  };

  const handleResetDone = () => {
    setResetModalOpen(false);
    setReloadKey((value) => value + 1);
  };

  const handleAccountDeleted = async () => {
    setDeleteAccountModalOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const isDemoReadOnly = demoMode || Boolean(data?.demoMode);
  const confidencePctRaw = (setupState?.confidence ?? data?.modelConfidence.confidence ?? 0) * 100;
  const confidencePct = Math.max(0, Math.min(100, Math.round(confidencePctRaw)));
  const checkinCount = setupState?.calibrationCheckinsDone ?? data?.series7d.length ?? 0;
  const evolution = useMemo(() => getSystemEvolutionStage(checkinCount), [checkinCount]);

  const trajectoryUnlocked = evolution.unlocked.trajectory;
  const explainUnlocked = evolution.unlocked.advancedControls;
  const advancedUnlocked = evolution.unlocked.advancedControls;
  const operatorInsightsUnlocked = evolution.unlocked.fullDiagnostics;

  useEffect(() => {
    const before = pendingMilestoneCheckRef.current;
    if (before == null) return;
    if (checkinCount > before) {
      if (before < 7 && checkinCount >= 7) {
        setUnlockNotice("System fully stabilized: Full diagnostics available");
      } else if (before < 5 && checkinCount >= 5) {
        setUnlockNotice("New capability unlocked: Advanced controls");
      } else if (before < 3 && checkinCount >= 3) {
        setUnlockNotice("New capability unlocked: Trajectory");
      }
    }
    pendingMilestoneCheckRef.current = null;
  }, [checkinCount]);

  useEffect(() => {
    if (!unlockNotice) return;
    const timeoutId = window.setTimeout(() => setUnlockNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [unlockNotice]);

  const calibrationStage = getCalibrationStage(checkinCount, setupState?.confidence ?? data?.modelConfidence.confidence ?? null);

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
        calibrationCheckinsDone: checkinCount,
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
    [activeProtocol, checkinCount, data, setupState?.calibrationCheckinsNeeded]
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

  const shortExplanation = stateExplanation.lines[0] ?? "Collect today's check-in to refresh guidance.";

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

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
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
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
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
        <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-5">
            <SystemEvolutionStrip currentDay={evolution.currentDay} completedCheckins={evolution.completedCheckins} />
            <CheckinProgressSummary completedCheckins={evolution.completedCheckins} nextUnlockDay={evolution.nextUnlockDay} />
            <NextCheckinTimer availableNow={true} msRemaining={null} />
            <SystemStatusCard
              lifeScore={0}
              state="OPEN"
              confidencePct={Math.max(0, Math.min(100, Math.round((setupState?.confidence ?? 0) * 100)))}
              shortExplanation="No check-in recorded yet. State will become personalized after your first check-in."
              onExplain={() => setStateDetailsOpen(true)}
              explainUnlocked={false}
              lockedHint="Unlocks at Day 5"
            />
            <NextActionCard
              primaryLabel="Record today's check-in"
              onPrimaryAction={() => openCheckInModal(todayDayKey)}
              onViewLastCheckin={null}
            />
            <LockedSectionCard title="Trajectory" unlockDay={3} />
            <LockedSectionCard title="Advanced Controls" unlockDay={5} />
          </div>
        </main>
        <CheckInModal
          open={checkInModalOpen}
          dateISO={checkInModalDate ?? selectedDate}
          baselineLifeScore={null}
          activeProtocol={null}
          onClose={closeCheckInModal}
          onSaved={handleCheckInSaved}
        />
      </>
    );
  }

  return (
    <>
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-8 text-zinc-100 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <UnlockNotice message={unlockNotice} onClose={() => setUnlockNotice(null)} />
          <SystemEvolutionStrip currentDay={evolution.currentDay} completedCheckins={evolution.completedCheckins} />
          <CheckinProgressSummary completedCheckins={evolution.completedCheckins} nextUnlockDay={evolution.nextUnlockDay} />
          <NextCheckinTimer
            availableNow={nextCheckinAvailability.availableNow}
            msRemaining={nextCheckinAvailability.msRemaining}
          />

          <SystemStatusCard
            lifeScore={data.snapshot.lifeScore}
            state={data.guardrail.label}
            confidencePct={confidencePct}
            shortExplanation={shortExplanation}
            onExplain={() => setStateDetailsOpen(true)}
            explainUnlocked={explainUnlocked}
            lockedHint="Unlocks at Day 5"
          />

          <NextActionCard
            primaryLabel={data.todayCheckInExists ? "Update today's check-in" : "Record today's check-in"}
            onPrimaryAction={() => openCheckInModal(todayDayKey)}
            onViewLastCheckin={latestCheckinDate ? () => openCheckInModal(latestCheckinDate) : null}
          />

          {trajectoryUnlocked ? (
            <TrajectoryCard points={data.series7d} risk={data.systemMetrics.risk} recovery={data.systemMetrics.recovery} />
          ) : (
            <LockedSectionCard title="Trajectory" unlockDay={3} />
          )}

          {advancedUnlocked ? (
            <AdvancedControls
              readOnly={isDemoReadOnly}
              onExport={() => setExportModalOpen(true)}
              onExplain={() => setStateDetailsOpen(true)}
              onReportIssue={() => setReportModalOpen(true)}
              onGlossary={() => setGlossaryOpen(true)}
              onReset={() => setResetModalOpen(true)}
              onDelete={() => setDeleteAccountModalOpen(true)}
            />
          ) : (
            <LockedSectionCard title="Advanced Controls" unlockDay={5} />
          )}
        </div>
      </main>

      <CheckInModal
        open={checkInModalOpen}
        dateISO={checkInModalDate ?? selectedDate}
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
