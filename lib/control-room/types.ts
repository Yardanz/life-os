export type DiagnosisFlag =
  | "OVERLOAD"
  | "RECOVERY_DEBT"
  | "STRAIN_ACCUMULATING"
  | "FATIGUE_DOMINANT"
  | "ADAPTIVE_SHRINK"
  | "CIRCADIAN_DRIFT"
  | "STRESS_RESIDUE"
  | "TRAINING_ADAPTATION"
  | "SATURATION"
  | "HOMEOSTATIC_IMBALANCE"
  | "NEGATIVE_MOMENTUM"
  | "SYMPATHETIC_DOMINANCE"
  | "PARASYMPATHETIC_RECOVERY"
  | "HORMETIC_ADAPTATION"
  | "OVERSTRESS"
  | "BURNOUT_SPIRAL"
  | "RESILIENCE_HIGH"
  | "LOW_RESERVE"
  | "STRESS_INTERFERENCE"
  | "STABLE"
  | "STABILIZATION_WINDOW";

export type ControlRoomDiagnosis = {
  title: string;
  summary: string;
  bullets: Array<{ label: string; value: string }>;
  flags: DiagnosisFlag[];
};

export type ControlRoomBreakdownLine = {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
};

export type ControlRoomBreakdown = {
  energy: ControlRoomBreakdownLine[];
  focus: ControlRoomBreakdownLine[];
  discipline: ControlRoomBreakdownLine[];
  fatigue: ControlRoomBreakdownLine[];
  strain: ControlRoomBreakdownLine[];
  risk: ControlRoomBreakdownLine[];
};

export type ControlRoomExecutiveSummary = {
  primaryDriver: string;
  secondaryDriver: string | null;
  stabilityState: string;
  trajectory: string;
  explanation: string;
};

export type PatternType =
  | "cyclical_stress_load"
  | "sleep_irregularity"
  | "burnout_acceleration"
  | "autonomic_drift"
  | "circadian_drift";

export type PatternSystemMode = "stable" | "cycle" | "drift" | "overload";

export type ControlRoomPatternSignal = {
  type: PatternType;
  severity: 0 | 1 | 2 | 3;
  confidence: number;
  windowDays: number;
  detectedAtISO: string;
  headline: string;
  evidence: Array<{ key: string; value: string; unit?: string }>;
  drivers: string[];
  suggestedLever: string;
};

export type ControlRoomPatterns = {
  systemMode: PatternSystemMode;
  systemModeConfidence: number;
  windowDays: number;
  detectedAtISO: string;
  patterns: ControlRoomPatternSignal[];
  topPatterns: ControlRoomPatternSignal[];
};

export type ControlRoomCalibration = {
  active: boolean;
  confidence: number;
  sensitivities: Record<
    "sleepEnergy" | "stressFocus" | "workoutStrain" | "circadianRisk" | "debtBurnout",
    "Low" | "Moderate" | "High"
  >;
};
