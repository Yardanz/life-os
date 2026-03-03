type TraceConstraint = {
  label: string;
  value: string;
  severity?: "hard" | "soft" | string;
};

type TraceContext = {
  deepWorkMinutes: number | null;
  stress: number | null;
  workout: number | null;
  horizonHours?: number | null;
};

export type ConstraintTraceType = "MAX" | "MIN";
export type ConstraintTraceStatus = "OK" | "NEAR" | "VIOLATION" | "LIMIT";

export type ConstraintTraceItem = {
  key: string;
  label: string;
  type: ConstraintTraceType;
  limitValue: number | null;
  unit: string;
  currentValue: number | null;
  margin: number | null;
  status: ConstraintTraceStatus;
  windowLabel: string | null;
};

function parseFirstNumber(value: string): number | null {
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMaxNumber(value: string): number | null {
  const matches = value.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

export function deriveConstraintStatus(
  type: ConstraintTraceType,
  currentValue: number | null,
  limitValue: number | null
): ConstraintTraceStatus {
  if (currentValue == null || limitValue == null || !Number.isFinite(currentValue) || !Number.isFinite(limitValue)) {
    return "LIMIT";
  }
  if (type === "MIN") {
    if (currentValue < limitValue) return "VIOLATION";
    return currentValue < limitValue * 1.2 ? "NEAR" : "OK";
  }
  if (currentValue >= limitValue) return "VIOLATION";
  if (currentValue > limitValue * 0.8) return "NEAR";
  return "OK";
}

export function normalizeConstraintForTrace(
  constraint: TraceConstraint,
  context: TraceContext,
  index: number
): ConstraintTraceItem {
  const labelLower = constraint.label.toLowerCase();
  const valueLower = constraint.value.toLowerCase();

  let type: ConstraintTraceType = "MAX";
  let limitValue: number | null = null;
  let currentValue: number | null = null;
  let unit = "";

  if (labelLower.includes("deep work cap")) {
    type = "MAX";
    limitValue = parseMaxNumber(constraint.value);
    currentValue = context.deepWorkMinutes;
    unit = "min";
  } else if (labelLower.includes("stress")) {
    type = "MAX";
    limitValue = parseFirstNumber(constraint.value);
    currentValue = context.stress;
  } else if (labelLower.includes("training") && valueLower.includes("light")) {
    type = "MAX";
    limitValue = 1;
    currentValue = context.workout;
    unit = "intensity";
  } else if (valueLower.includes(">=") || labelLower.includes("minimum")) {
    type = "MIN";
    limitValue = parseFirstNumber(constraint.value);
  } else if (valueLower.includes("<=")) {
    type = "MAX";
    limitValue = parseFirstNumber(constraint.value);
  }

  const status = deriveConstraintStatus(type, currentValue, limitValue);
  const margin =
    currentValue != null && limitValue != null
      ? type === "MAX"
        ? limitValue - currentValue
        : currentValue - limitValue
      : null;

  return {
    key: `${constraint.label}-${index}`,
    label: constraint.label,
    type,
    limitValue,
    unit,
    currentValue,
    margin,
    status,
    windowLabel:
      typeof context.horizonHours === "number" && Number.isFinite(context.horizonHours)
        ? `${Math.round(context.horizonHours)}h`
        : null,
  };
}

export function formatTraceValue(value: number | null, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const normalized = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(1));
  return unit ? `${normalized} ${unit}` : String(normalized);
}
