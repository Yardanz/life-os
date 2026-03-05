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
  demoMode?: boolean;
  plan: "FREE" | "PRO";
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
  };
  snapshot: {
    lifeScore: number;
  };
  series7d: Array<{
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
