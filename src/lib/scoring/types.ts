import type { MetricKey } from "./config";

/** One measurement considered by the engine for a given scoring day. */
export interface MetricSnapshot {
  metric: MetricKey;
  value: number;
  unit: string;
  timestamp: string; // ISO-8601 UTC
  signalQuality: number; // 0..1
  isValid: boolean;
  source: string;
  maskWearMinutes?: number;
}

/** Athlete-specific rolling baseline percentiles for one metric. */
export interface BaselinePercentile {
  metric: MetricKey;
  p10: number;
  p50: number;
  p90: number;
  n: number;
  windowDays: number;
}

export interface DeviceCalibrationInfo {
  deviceId: string;
  deviceLabel: string;
  calibratedAt: string;
  status: string; // OK | Expired | Pending
}

export interface ScoringInput {
  athleteId: string;
  position: string; // PositionType string
  scoringDate: string; // ISO date of the day being scored (start of day UTC)
  weights: Record<string, number>; // component → weight
  observations: MetricSnapshot[]; // all observations for the scoring day
  baselines: BaselinePercentile[];
  consent: "GRANTED" | "RESTRICTED" | "REVOKED";
  calibration: DeviceCalibrationInfo | null;
  now: string; // evaluation timestamp (ISO)
  /** Previous day's contribution per component (index points) for driver deltas. */
  priorContributions?: Record<string, number> | null;
}

export interface CheckOutcome {
  check: string;
  status: "PASSED" | "FAILED" | "WARNING" | "NOT_APPLICABLE";
  severity: "CRITICAL" | "HIGH" | "MODERATE" | null;
  reason: string;
}

export interface ComponentOutcome {
  component: string;
  score: number | null;
  weight: number;
  contribution: number | null;
  status: "VALID" | "LIMITED" | "MISSING";
  reason: string | null;
  metricDetails: {
    metric: string;
    value: number | null;
    unit: string;
    baseline: { p10: number; p50: number; p90: number; n: number } | null;
    direction: string;
  }[];
}

export interface DriverOutcome {
  type: "POSITIVE" | "NEGATIVE";
  text: string;
  strength: number; // contribution delta in index points
}

export interface ScoringResult {
  score: number | null;
  band: "READY" | "MONITOR" | "COMPROMISED" | "WITHHELD";
  confidence: number | null;
  validity: "VALID" | "LIMITED" | "WITHHELD" | "RETEST" | "INSUFFICIENT_BASELINE";
  withheldCode: string | null;
  explanation: string;
  checks: CheckOutcome[];
  components: ComponentOutcome[];
  drivers: DriverOutcome[];
  warnings: string[];
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
