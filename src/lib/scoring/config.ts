import { z } from "zod";

/**
 * SMX Performance Index — prototype configuration.
 *
 * Every threshold and weight below is a PROTOTYPE setting: a transparent,
 * documented engineering parameter chosen for demonstration. None of these
 * values constitute a clinically validated or physiologically proven rule.
 * See docs/scoring.md and the ModelConfigurationVersion audit trail.
 */

export const COMPONENT_KEYS = [
  "RESPIRATORY_EFFICIENCY",
  "OXYGEN_FUNCTION",
  "RECOVERY_AUTONOMIC",
  "WORKLOAD_RESPONSE",
  "MOVEMENT_EXPLOSIVE",
  "ENVIRONMENT_TRAVEL",
  "BASELINE_DEVIATION",
] as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  RESPIRATORY_EFFICIENCY: "Respiratory Efficiency",
  OXYGEN_FUNCTION: "Oxygen Function",
  RECOVERY_AUTONOMIC: "Recovery & Autonomic State",
  WORKLOAD_RESPONSE: "Workload Response",
  MOVEMENT_EXPLOSIVE: "Movement / Explosive Capacity",
  ENVIRONMENT_TRAVEL: "Environment & Travel",
  BASELINE_DEVIATION: "Individual Baseline Deviation",
};

/** Frozen metric catalog: key, unit, direction, and valid range. */
export const METRIC_CATALOG = {
  RESP_RATE: { unit: "brpm", direction: "DEViation" as const, min: 4, max: 60 },
  VENT_EFF: { unit: "ratio", direction: "HIGHER_BETTER" as const, min: 0, max: 1 },
  SPO2: { unit: "%", direction: "HIGHER_BETTER" as const, min: 70, max: 100 },
  VO2_PROXY: { unit: "ml/kg/min", direction: "HIGHER_BETTER" as const, min: 10, max: 90 },
  HRV_MS: { unit: "ms", direction: "HIGHER_BETTER" as const, min: 5, max: 250 },
  RHR: { unit: "bpm", direction: "LOWER_BETTER" as const, min: 30, max: 120 },
  SLEEP_H: { unit: "h", direction: "DEViation" as const, min: 0, max: 14 },
  // Workload response: today's load vs the athlete's own typical load
  // (deviation from own p50 — not raw magnitude).
  LOAD_AU: { unit: "au", direction: "DEViation" as const, min: 0, max: 5000 },
  ACWR: { unit: "ratio", direction: "CONTEXT" as const, min: 0, max: 5 },
  JUMP_CM: { unit: "cm", direction: "HIGHER_BETTER" as const, min: 10, max: 90 },
  ACCEL_N: { unit: "count", direction: "DEViation" as const, min: 0, max: 500 },
  HEAT_C: { unit: "°C", direction: "PENALTY" as const, min: -20, max: 55 },
  AQI: { unit: "index", direction: "PENALTY" as const, min: 0, max: 300 },
  ALT_M: { unit: "m", direction: "PENALTY" as const, min: -400, max: 4000 },
  TZ_SHIFT_H: { unit: "h", direction: "PENALTY" as const, min: 0, max: 12 },
} as const;

export type MetricKey = keyof typeof METRIC_CATALOG;

export const ComponentWeightsSchema = z
  .object({
    RESPIRATORY_EFFICIENCY: z.number().min(0).max(1),
    OXYGEN_FUNCTION: z.number().min(0).max(1),
    RECOVERY_AUTONOMIC: z.number().min(0).max(1),
    WORKLOAD_RESPONSE: z.number().min(0).max(1),
    MOVEMENT_EXPLOSIVE: z.number().min(0).max(1),
    ENVIRONMENT_TRAVEL: z.number().min(0).max(1),
    BASELINE_DEVIATION: z.number().min(0).max(1),
  })
  .refine(
    (w) => {
      const sum = COMPONENT_KEYS.reduce((acc, k) => acc + w[k], 0);
      return Math.abs(sum - 1) <= 0.001;
    },
    { message: "Component weights must sum to 1.00 (±0.001)" },
  );

export type ComponentWeights = z.infer<typeof ComponentWeightsSchema>;

/**
 * Position-specific weight configurations (PROTOTYPE).
 * All sets sum to exactly 1.00; validated by ComponentWeightsSchema.
 */
export const POSITION_WEIGHTS: Record<string, ComponentWeights> = {
  DEFAULT: {
    RESPIRATORY_EFFICIENCY: 0.2,
    OXYGEN_FUNCTION: 0.1,
    RECOVERY_AUTONOMIC: 0.2,
    WORKLOAD_RESPONSE: 0.2,
    MOVEMENT_EXPLOSIVE: 0.15,
    ENVIRONMENT_TRAVEL: 0.05,
    BASELINE_DEVIATION: 0.1,
  },
  SMX_QB: {
    RESPIRATORY_EFFICIENCY: 0.18,
    OXYGEN_FUNCTION: 0.12,
    RECOVERY_AUTONOMIC: 0.18,
    WORKLOAD_RESPONSE: 0.18,
    MOVEMENT_EXPLOSIVE: 0.14,
    ENVIRONMENT_TRAVEL: 0.08,
    BASELINE_DEVIATION: 0.12,
  },
  SMX_SKILL: {
    RESPIRATORY_EFFICIENCY: 0.18,
    OXYGEN_FUNCTION: 0.1,
    RECOVERY_AUTONOMIC: 0.18,
    WORKLOAD_RESPONSE: 0.2,
    MOVEMENT_EXPLOSIVE: 0.22,
    ENVIRONMENT_TRAVEL: 0.05,
    BASELINE_DEVIATION: 0.07,
  },
  SMX_TRENCH: {
    RESPIRATORY_EFFICIENCY: 0.15,
    OXYGEN_FUNCTION: 0.1,
    RECOVERY_AUTONOMIC: 0.18,
    WORKLOAD_RESPONSE: 0.24,
    MOVEMENT_EXPLOSIVE: 0.2,
    ENVIRONMENT_TRAVEL: 0.06,
    BASELINE_DEVIATION: 0.07,
  },
  SMX_LB_TE: {
    RESPIRATORY_EFFICIENCY: 0.18,
    OXYGEN_FUNCTION: 0.1,
    RECOVERY_AUTONOMIC: 0.2,
    WORKLOAD_RESPONSE: 0.18,
    MOVEMENT_EXPLOSIVE: 0.2,
    ENVIRONMENT_TRAVEL: 0.06,
    BASELINE_DEVIATION: 0.08,
  },
  SMX_ST: {
    RESPIRATORY_EFFICIENCY: 0.18,
    OXYGEN_FUNCTION: 0.1,
    RECOVERY_AUTONOMIC: 0.2,
    WORKLOAD_RESPONSE: 0.16,
    MOVEMENT_EXPLOSIVE: 0.18,
    ENVIRONMENT_TRAVEL: 0.1,
    BASELINE_DEVIATION: 0.08,
  },
};

export function weightsForPosition(position: string): ComponentWeights {
  switch (position) {
    case "QB":
      return POSITION_WEIGHTS.SMX_QB;
    case "SKILL":
      return POSITION_WEIGHTS.SMX_SKILL;
    case "TRENCH":
      return POSITION_WEIGHTS.SMX_TRENCH;
    case "LB_TE":
      return POSITION_WEIGHTS.SMX_LB_TE;
    case "ST":
      return POSITION_WEIGHTS.SMX_ST;
    default:
      return POSITION_WEIGHTS.DEFAULT;
  }
}

/** Prototype thresholds — configurable, documented, not clinical claims. */
export const PrototypeThresholdsSchema = z.object({
  // Baseline sufficiency: minimum valid observations in the 28-day window.
  baselineWindowDays: z.number().int().min(7).max(90).default(28),
  baselineMinObservations: z.number().int().min(1).max(60).default(8),
  // Calibration freshness: device calibration must be newer than this.
  calibrationStaleHours: z.number().min(1).max(336).default(24),
  calibrationCriticalHours: z.number().min(1).max(336).default(48),
  // Sample integrity for respiratory sessions.
  minValidSampleRatio: z.number().min(0.1).max(1).default(0.8),
  minSignalQuality: z.number().min(0).max(1).default(0.7),
  minMaskWearMinutes: z.number().min(0).max(240).default(20),
  // Timestamp freshness: most recent observation must be inside this window.
  observationFreshnessHours: z.number().min(1).max(168).default(36),
  // Bands (configurable cutoffs).
  bandReadyMin: z.number().min(0).max(100).default(70),
  bandMonitorMin: z.number().min(0).max(100).default(40),
  // LOAD_SPIKE: acute:chronic workload ratio above this is a Moderate exception.
  acwrSpikeThreshold: z.number().min(1).max(3).default(1.5),
  // Explicit renormalization of missing non-mandatory components is allowed
  // and produces a LIMITED result with an explanation code.
  allowExplicitRenormalization: z.boolean().default(true),
  // Confidence model maturity divisor: n observations needed for maturity=1.
  baselineMaturityN: z.number().int().min(1).max(60).default(14),
});

export type PrototypeThresholds = z.infer<typeof PrototypeThresholdsSchema>;

export const DEFAULT_THRESHOLDS: PrototypeThresholds =
  PrototypeThresholdsSchema.parse({});

/** Metrics required to attempt each component. */
export const COMPONENT_METRICS: Record<ComponentKey, MetricKey[]> = {
  RESPIRATORY_EFFICIENCY: ["RESP_RATE", "VENT_EFF"],
  OXYGEN_FUNCTION: ["SPO2", "VO2_PROXY"],
  RECOVERY_AUTONOMIC: ["HRV_MS", "RHR", "SLEEP_H"],
  WORKLOAD_RESPONSE: ["LOAD_AU", "ACWR"],
  MOVEMENT_EXPLOSIVE: ["JUMP_CM", "ACCEL_N"],
  ENVIRONMENT_TRAVEL: ["HEAT_C", "AQI", "ALT_M", "TZ_SHIFT_H"],
  BASELINE_DEVIATION: ["RESP_RATE", "HRV_MS", "RHR", "SLEEP_H"],
};

/** Components whose absence always withholds the composite. */
export const MANDATORY_COMPONENTS: ComponentKey[] = [
  "RESPIRATORY_EFFICIENCY",
  "OXYGEN_FUNCTION",
  "RECOVERY_AUTONOMIC",
  "WORKLOAD_RESPONSE",
];

/** Environment penalty prototype curves (monotonic, bounded). */
export const ENV_PENALTY = {
  heat: { start: 25, full: 40, maxPenalty: 0.45 },
  aqi: { start: 50, full: 150, maxPenalty: 0.3 },
  altitude: { start: 1500, full: 3000, maxPenalty: 0.2 },
  timeZone: { start: 3, full: 9, maxPenalty: 0.25 },
} as const;

/** Digital Athlete Twin sensitivity curves (PROTOTYPE, unit-tested monotonic). */
export const TWIN_SENSITIVITY = {
  tzShiftHours: { domain: [-12, 12], effect: [0, -8] }, // index points
  heatIndexC: { domain: [0, 55], effect: [0, -12] },
  aqi: { domain: [0, 300], effect: [0, -6] },
  altitudeM: { domain: [0, 4000], effect: [0, -9] },
  sleepHours: { domain: [0, 12], effect: [-10, 0] }, // less sleep → negative
  practiceLoadPct: { domain: [50, 200], effect: [0, -14] },
} as const;

export const VALIDITY_STATES = [
  "VALID",
  "LIMITED",
  "WITHHELD",
  "RETEST",
  "INSUFFICIENT_BASELINE",
] as const;

export const BANDS = ["READY", "MONITOR", "COMPROMISED", "WITHHELD"] as const;
export type Band = (typeof BANDS)[number];
