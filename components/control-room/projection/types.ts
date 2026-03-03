"use client";

export type ScenarioKey = "baseline" | "stabilize" | "overload" | "custom" | "protocol" | "compareB";
export type CoreScenarioKey = "baseline" | "stabilize" | "overload";
export type MetricKey = "lifeScore" | "risk" | "burnout";

export type UnifiedProjectionPoint = {
  dayIndex: number;
  dateISO: string;
  lifeScore: number;
  risk: number;
  burnout: number;
};

export type UnifiedProjectionSeries = {
  scenario: ScenarioKey;
  points: UnifiedProjectionPoint[];
};

export type ProjectionChartRow = {
  dayIndex: number;
  dateISO: string;
  baseline?: number;
  stabilize?: number;
  overload?: number;
  custom?: number;
  protocol?: number;
  compareB?: number;
};

export type EndLabel = {
  key: ScenarioKey;
  text: string;
  value: number;
  dayIndex: number;
  dy: number;
};
