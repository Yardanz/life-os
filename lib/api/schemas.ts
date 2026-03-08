import { z } from "zod";

export const controlRoomQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  tzOffsetMinutes: z.coerce.number().int().min(-720).max(840).optional(),
});

export const patternsQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  windowDays: z.coerce.number().int().min(7).max(60).optional(),
});

export const confidenceQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
});

export const checkinPayloadSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  tzOffsetMinutes: z.coerce.number().int().min(-720).max(840).optional(),
  mood: z.number().int().min(1).max(10).optional(),
  stress: z.coerce.number().finite(),
  energyLevel: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(4000).optional(),
  sleepHours: z.coerce.number().finite(),
  sleepQuality: z.coerce.number().finite(),
  bedtimeMinutes: z.coerce.number().finite().optional(),
  wakeTimeMinutes: z.coerce.number().finite().optional(),
  workout: z.union([z.literal(0), z.literal(1), z.boolean()]),
  deepWorkMin: z.coerce.number().finite(),
  learningMin: z.coerce.number().finite(),
  moneyDelta: z.coerce.number().finite(),
  configVersion: z.number().int().positive().optional(),
});

export const antiChaosPayloadSchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
});

export const antiChaosProtocolPayloadSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  horizonHours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
});

export const projectionCustomPayloadSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  modifiers: z.object({
    sleepMinutesDelta: z.number().min(-60).max(120),
    deepWorkPctDelta: z.number().min(-0.5).max(0.3),
    stressDelta: z.number().min(-3).max(3),
    workoutForcedOff: z.boolean().optional(),
  }),
});

export const scenarioSavePayloadSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  name: z.string().min(1).max(120).optional(),
  horizonDays: z.number().int().min(1).max(365).optional().default(30),
  tags: z.string().min(1).max(64).optional(),
  baseDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "baseDateISO must be YYYY-MM-DD"),
  source: z.enum(["projection", "intervention", "anti_chaos"]),
  inputModifiers: z.record(z.string(), z.unknown()),
  projectionResult: z.object({
    lifeScore30: z.number(),
    risk30: z.number(),
    burnout30: z.number(),
    volatility: z.number(),
  }),
  patternContext: z.object({
    systemMode: z.string(),
    topPattern: z.string().nullable(),
  }),
  calibrationConfidence: z.number().min(0).max(1),
});

export const scenariosQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const devSimulate30dPayloadSchema = z.object({
  userId: z.string().min(1, "userId is required").default("demo-user"),
  endDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDateISO must be YYYY-MM-DD"),
  days: z.number().int().min(1).max(90).default(30),
  seed: z.union([z.string(), z.number()]).optional(),
  overwrite: z.boolean().default(false),
  mode: z.enum(["simulate", "clear"]).default("simulate"),
  scenario: z.enum(["random", "burnout_spiral", "recovery_rebound"]).default("random"),
});

export const devSimulationExportPayloadSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  startDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDateISO must be YYYY-MM-DD"),
  endDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDateISO must be YYYY-MM-DD"),
  days: z.number().int().min(1).max(90).default(30),
  mode: z
    .enum(["debug-random-simulation", "debug-burnout-spiral-simulation", "debug-recovery-rebound-simulation"])
    .default("debug-random-simulation"),
});

export type ControlRoomQuery = z.infer<typeof controlRoomQuerySchema>;
export type PatternsQuery = z.infer<typeof patternsQuerySchema>;
export type ConfidenceQuery = z.infer<typeof confidenceQuerySchema>;
export type CheckinPayload = z.infer<typeof checkinPayloadSchema>;
export type AntiChaosPayload = z.infer<typeof antiChaosPayloadSchema>;
export type AntiChaosProtocolPayload = z.infer<typeof antiChaosProtocolPayloadSchema>;
export type ProjectionCustomPayload = z.infer<typeof projectionCustomPayloadSchema>;
export type ScenarioSavePayload = z.infer<typeof scenarioSavePayloadSchema>;
export type ScenariosQuery = z.infer<typeof scenariosQuerySchema>;
export type DevSimulate30dPayload = z.infer<typeof devSimulate30dPayloadSchema>;
export type DevSimulationExportPayload = z.infer<typeof devSimulationExportPayloadSchema>;
