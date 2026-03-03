export type AuthorityLevel = "HIGH" | "MED" | "LOW";

export type DeriveAuthorityInput = {
  calibrationStage: "CALIBRATING" | "STABILIZED" | string;
  modelConfidence: number | null;
};

export type DeriveAuthorityResult = {
  authority: AuthorityLevel;
  note?: string;
};

function normalizeConfidence(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  return Math.max(0, Math.min(1, value / 100));
}

export function deriveAuthority(input: DeriveAuthorityInput): DeriveAuthorityResult {
  const confidence = normalizeConfidence(input.modelConfidence) ?? 0;

  if (input.calibrationStage !== "STABILIZED") {
    return { authority: "LOW", note: "Authority limited — baseline not stabilized." };
  }
  if (confidence < 0.7) {
    return { authority: "LOW", note: "Authority limited — baseline not stabilized." };
  }
  if (confidence < 0.85) {
    return { authority: "MED", note: "Authority moderate — interpret with caution." };
  }
  return { authority: "HIGH" };
}
