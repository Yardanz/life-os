import type {
  ControlRoomBreakdown,
  ControlRoomCalibration,
  ControlRoomDiagnosis,
  ControlRoomExecutiveSummary,
  ControlRoomPatterns,
} from "@/lib/control-room/types";

export type ProtocolRunRecord = {
  id: string;
  createdAt: string;
  horizonHours: number;
  mode?: "STANDARD" | "STABILIZE" | string;
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  confidence: number;
  inputs: unknown;
  protocol: {
    state: "OPEN" | "CAUTION" | "LOCKDOWN";
    constraints: Array<{ label: string; value: string; severity: "hard" | "soft" }>;
  };
  appliedAt: string | null;
};

export type ControlRoomV2Data = {
  userId: string;
  totalCheckins?: number;
  demoMode?: boolean;
  plan: "FREE" | "PRO";
  featureAccess?: {
    antiChaos: boolean;
    forecast30d: boolean;
    allStats: boolean;
    history: boolean;
  };
  todayCheckInExists: boolean;
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
  modelConfidence: {
    confidence: number;
    notes?: string[];
    components?: {
      coverageScore: number;
      completenessScore: number;
      stabilityScore: number;
      convergenceScore: number;
      patternScore: number;
      sensitivityScore: number;
    };
  };
  guardrail: {
    label: "OPEN" | "CAUTION" | "LOCKDOWN";
    reasons: string[];
  };
  integrity: {
    score: number;
    state: "STABLE" | "DRIFT" | "STRAIN";
    violations: string[];
    hasActiveProtocol: boolean;
  };
  calibration: {
    active: boolean;
    confidence: number;
  } & ControlRoomCalibration;
  diagnosis?: ControlRoomDiagnosis;
  executiveSummary?: ControlRoomExecutiveSummary;
  patterns?: ControlRoomPatterns;
  breakdown?: ControlRoomBreakdown;
  adaptiveBaseline?: {
    riskOffset: number;
    recoveryOffset: number;
  };
  snapshot: {
    lifeScore: number;
  };
  date: string;
  series7d: Array<{
    date: string;
    lifeScore: number;
  }>;
  series30d?: Array<{
    date: string;
    lifeScore: number;
  }>;
};

export type ControlRoomV2ApiResponse =
  | { ok: true; data: ControlRoomV2Data }
  | {
      ok: false;
      error?: string;
      code?: string;
      message?: string;
      date?: string;
      hasAnyCheckins?: boolean;
    };
