export type CalibrationStage = "CALIBRATING" | "STABILIZED";

export type CalibrationStageInfo = {
  stage: CalibrationStage;
  progressText: string;
  noteText: string;
};

export function getCalibrationStage(checkinCount: number, confidence?: number | null): CalibrationStageInfo {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(checkinCount) ? checkinCount : 0));
  const needed = 7;
  const pct =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : Math.max(0, Math.min(1, safeCount / needed));

  if (safeCount >= needed) {
    return {
      stage: "STABILIZED",
      progressText: `Baseline calibration: ${safeCount}/${needed}`,
      noteText: `Baseline stabilized (${Math.round(pct * 100)}% confidence).`,
    };
  }

  return {
    stage: "CALIBRATING",
    progressText: `Baseline calibration: ${safeCount}/${needed}`,
    noteText: "Constraints are conservative until baseline stabilizes.",
  };
}

