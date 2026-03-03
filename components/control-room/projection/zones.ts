import type { MetricKey } from "@/components/control-room/projection/types";

export type ZoneBand = {
  label: string;
  from: number;
  to: number;
  color: string;
  opacity: number;
};

export const METRIC_ZONES: Record<MetricKey, ZoneBand[]> = {
  lifeScore: [
    { label: "Degraded", from: 0, to: 33, color: "#7f1d1d", opacity: 0.06 },
    { label: "Operational", from: 34, to: 66, color: "#1e3a2f", opacity: 0.08 },
    { label: "Optimal", from: 67, to: 100, color: "#0c4a6e", opacity: 0.08 },
  ],
  risk: [
    { label: "Stable", from: 0, to: 20, color: "#1e3a2f", opacity: 0.08 },
    { label: "Elevated", from: 21, to: 50, color: "#78350f", opacity: 0.07 },
    { label: "Critical", from: 51, to: 100, color: "#7f1d1d", opacity: 0.06 },
  ],
  burnout: [
    { label: "Degraded", from: 0, to: 33, color: "#7f1d1d", opacity: 0.06 },
    { label: "Operational", from: 34, to: 66, color: "#1e3a2f", opacity: 0.08 },
    { label: "Optimal", from: 67, to: 100, color: "#0c4a6e", opacity: 0.08 },
  ],
};

export const Y_TICKS = [0, 20, 40, 60, 80, 100];
export const X_TICKS = [0, 7, 14, 21, 29];
