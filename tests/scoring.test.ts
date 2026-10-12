import { describe, it, expect } from "vitest";
import {
  computeScore,
  normalizeAgainstBaseline,
  percentile,
  buildBaselines,
} from "@/lib/scoring/engine";
import {
  ComponentWeightsSchema,
  POSITION_WEIGHTS,
  COMPONENT_KEYS,
  weightsForPosition,
  PrototypeThresholdsSchema,
} from "@/lib/scoring/config";
import type { ScoringInput, MetricSnapshot } from "@/lib/scoring/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function obs(
  metric: MetricSnapshot["metric"],
  value: number,
  extra: Partial<MetricSnapshot> = {},
): MetricSnapshot {
  return {
    metric,
    value,
    unit: "",
    timestamp: "2025-10-10T10:00:00Z",
    signalQuality: 0.95,
    isValid: true,
    source: "TEST",
    ...extra,
  };
}

function baseInput(over: Partial<ScoringInput> = {}): ScoringInput {
  const weights = POSITION_WEIGHTS.DEFAULT;
  return {
    athleteId: "a1",
    position: "SKILL",
    scoringDate: "2025-10-10T00:00:00Z",
    weights: weights as unknown as Record<string, number>,
    observations: [
      obs("RESP_RATE", 16),
      obs("VENT_EFF", 0.86),
      obs("SPO2", 97),
      obs("VO2_PROXY", 52),
      obs("HRV_MS", 74),
      obs("RHR", 57),
      obs("SLEEP_H", 7.6),
      obs("LOAD_AU", 560),
      obs("ACWR", 1.1),
      obs("JUMP_CM", 56),
      obs("ACCEL_N", 55),
      obs("HEAT_C", 22),
      obs("AQI", 35),
      obs("ALT_M", 200),
      obs("TZ_SHIFT_H", 0),
    ],
    baselines: [
      { metric: "RESP_RATE", p10: 13, p50: 16, p90: 19, n: 20, windowDays: 28 },
      { metric: "VENT_EFF", p10: 0.8, p50: 0.86, p90: 0.92, n: 20, windowDays: 28 },
      { metric: "SPO2", p10: 95, p50: 97, p90: 99, n: 20, windowDays: 28 },
      { metric: "VO2_PROXY", p10: 47, p50: 52, p90: 57, n: 20, windowDays: 28 },
      { metric: "HRV_MS", p10: 61, p50: 74, p90: 87, n: 20, windowDays: 28 },
      { metric: "RHR", p10: 53, p50: 57, p90: 61, n: 20, windowDays: 28 },
      { metric: "SLEEP_H", p10: 6.4, p50: 7.6, p90: 8.8, n: 20, windowDays: 28 },
      { metric: "LOAD_AU", p10: 300, p50: 560, p90: 820, n: 20, windowDays: 28 },
      { metric: "JUMP_CM", p10: 51, p50: 56, p90: 61, n: 20, windowDays: 28 },
      { metric: "ACCEL_N", p10: 40, p50: 55, p90: 70, n: 20, windowDays: 28 },
    ],
    consent: "GRANTED",
    calibration: { deviceId: "d1", deviceLabel: "Test Mask", calibratedAt: "2025-10-10T08:00:00Z", status: "OK" },
    now: "2025-10-11T00:00:00Z",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

describe("weight configuration", () => {
  it("accepts the default weight set", () => {
    expect(() => ComponentWeightsSchema.parse(POSITION_WEIGHTS.DEFAULT)).not.toThrow();
  });

  it("rejects weights that do not sum to 1.00", () => {
    const bad = { ...POSITION_WEIGHTS.DEFAULT, RESPIRATORY_EFFICIENCY: 0.5 };
    expect(() => ComponentWeightsSchema.parse(bad)).toThrow(/sum to 1.00/);
  });

  it("every position weight set sums to exactly 1.00", () => {
    for (const [name, w] of Object.entries(POSITION_WEIGHTS)) {
      const sum = COMPONENT_KEYS.reduce((a, k) => a + w[k], 0);
      expect(Math.abs(sum - 1), name).toBeLessThanOrEqual(0.001);
      expect(() => ComponentWeightsSchema.parse(w), name).not.toThrow();
    }
  });

  it("weightsForPosition falls back to DEFAULT for unknown positions", () => {
    expect(weightsForPosition("UNKNOWN")).toEqual(POSITION_WEIGHTS.DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

describe("normalization", () => {
  const b = { metric: "HRV_MS" as const, p10: 61, p50: 74, p90: 87, n: 20, windowDays: 28 };

  it("maps p10 → 0 and p90 → 1 (higher better)", () => {
    expect(normalizeAgainstBaseline("HRV_MS", 61, b)).toBe(0);
    expect(normalizeAgainstBaseline("HRV_MS", 87, b)).toBe(1);
  });

  it("inverts lower-better metrics", () => {
    const rhr = { metric: "RHR" as const, p10: 53, p50: 57, p90: 61, n: 20, windowDays: 28 };
    expect(normalizeAgainstBaseline("RHR", 61, rhr)).toBe(0);
    expect(normalizeAgainstBaseline("RHR", 53, rhr)).toBe(1);
  });

  it("deviation metrics score closeness to own p50", () => {
    const resp = { metric: "RESP_RATE" as const, p10: 13, p50: 16, p90: 19, n: 20, windowDays: 28 };
    expect(normalizeAgainstBaseline("RESP_RATE", 16, resp)).toBe(1);
    // At p90 the value sits half a span from p50 → 0.5 (documented semantic).
    expect(normalizeAgainstBaseline("RESP_RATE", 19, resp)).toBe(0.5);
    expect(normalizeAgainstBaseline("RESP_RATE", 13, resp)).toBe(0.5);
  });

  it("clamps out-of-range values, never extrapolates", () => {
    expect(normalizeAgainstBaseline("HRV_MS", 200, b)).toBe(1);
    expect(normalizeAgainstBaseline("HRV_MS", 5, b)).toBe(0);
  });

  it("returns null without a baseline (missing-data honesty)", () => {
    expect(normalizeAgainstBaseline("HRV_MS", 74, undefined)).toBeNull();
  });

  it("percentile is a linear interpolator", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.9)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// The worked example (spec §11 / reference explorer)
// ---------------------------------------------------------------------------

describe("worked example", () => {
  it("scores .84/.91/.78/.80/.82/.50/.94 with default weights → contributions 16.8/9.1/15.6/16.0/12.3/2.5/9.4 → index 81.7", () => {
    // Directly verify the weighted-composite arithmetic.
    const scores = [0.84, 0.91, 0.78, 0.8, 0.82, 0.5, 0.94];
    const w = POSITION_WEIGHTS.DEFAULT;
    const contributions = COMPONENT_KEYS.map((k, i) => w[k] * scores[i] * 100);
    expect(contributions.map((c) => Math.round(c * 10) / 10)).toEqual([16.8, 9.1, 15.6, 16.0, 12.3, 2.5, 9.4]);
    const index = contributions.reduce((a, c) => a + c, 0);
    expect(Math.round(index * 10) / 10).toBe(81.7);
  });
});

// ---------------------------------------------------------------------------
// Validity gates
// ---------------------------------------------------------------------------

describe("validity gates (fail closed)", () => {
  it("releases a VALID composite when all gates pass", () => {
    const r = computeScore(baseInput());
    expect(r.score).not.toBeNull();
    expect(r.validity).toBe("VALID");
    expect(r.band).toBe("READY");
  });

  it("withholds on stale calibration (>48h) with CALIBRATION_FRESHNESS", () => {
    const r = computeScore(
      baseInput({ calibration: { deviceId: "d1", deviceLabel: "Mask", calibratedAt: "2025-10-07T00:00:00Z", status: "OK" } }),
    );
    expect(r.score).toBeNull();
    expect(r.band).toBe("WITHHELD");
    expect(r.withheldCode).toBe("CALIBRATION_FRESHNESS");
    expect(r.checks.find((c) => c.check === "CALIBRATION_FRESHNESS")?.status).toBe("FAILED");
  });

  it("ages calibration to WARNING (not failed) between 24h and 48h", () => {
    const r = computeScore(
      baseInput({ calibration: { deviceId: "d1", deviceLabel: "Mask", calibratedAt: "2025-10-09T10:00:00Z", status: "OK" } }),
    );
    expect(r.score).not.toBeNull();
    const cal = r.checks.find((c) => c.check === "CALIBRATION_FRESHNESS");
    expect(cal?.status).toBe("WARNING");
  });

  it("withholds on RESTRICTED consent with CONSENT_STATE", () => {
    const r = computeScore(baseInput({ consent: "RESTRICTED" }));
    expect(r.score).toBeNull();
    expect(r.withheldCode).toBe("CONSENT_STATE");
  });

  it("withholds on REVOKED consent", () => {
    const r = computeScore(baseInput({ consent: "REVOKED" }));
    expect(r.score).toBeNull();
  });

  it("withholds on low sample integrity (signal quality below threshold)", () => {
    const input = baseInput();
    input.observations = input.observations.map((o) => ({ ...o, signalQuality: 0.5 }));
    const r = computeScore(input);
    expect(r.score).toBeNull();
    expect(r.withheldCode).toBe("SAMPLE_INTEGRITY");
  });

  it("withholds on insufficient baseline (n below minimum)", () => {
    const input = baseInput();
    input.baselines = input.baselines.map((b) => ({ ...b, n: 3 }));
    const r = computeScore(input);
    expect(r.score).toBeNull();
    expect(r.validity).toBe("INSUFFICIENT_BASELINE");
    expect(r.checks.find((c) => c.check === "BASELINE_SUFFICIENCY")?.reason).toContain("INSUFFICIENT_BASELINE");
  });

  it("withholds on stale capture (>36h)", () => {
    const input = baseInput();
    input.observations = input.observations.map((o) => ({ ...o, timestamp: "2025-10-08T10:00:00Z" }));
    const r = computeScore(input);
    expect(r.score).toBeNull();
    expect(r.withheldCode).toBe("TIMESTAMP_FRESHNESS");
  });

  it("MULTI_FAIL when two gates fail → RETEST and both failures listed", () => {
    const input = baseInput({
      consent: "RESTRICTED",
      calibration: { deviceId: "d1", deviceLabel: "Mask", calibratedAt: "2025-10-01T00:00:00Z", status: "Expired" },
    });
    const r = computeScore(input);
    expect(r.score).toBeNull();
    expect(r.withheldCode).toBe("MULTI_FAIL");
    expect(r.validity).toBe("RETEST");
    const failed = r.checks.filter((c) => c.status === "FAILED");
    expect(failed.length).toBeGreaterThanOrEqual(2);
  });

  it("never emits zero for missing data", () => {
    const input = baseInput();
    input.observations = input.observations.filter((o) => o.metric !== "SPO2" && o.metric !== "VO2_PROXY");
    const r = computeScore(input);
    expect(r.score).toBeNull();
    expect(r.withheldCode).toBe("OBSERVATION_COMPLETENESS");
  });

  it("LOAD_SPIKE does not withhold: warns, degrades confidence", () => {
    const input = baseInput();
    const acwr = input.observations.find((o) => o.metric === "ACWR");
    if (acwr) acwr.value = 1.72;
    const r = computeScore(input);
    expect(r.score).not.toBeNull();
    expect(r.validity).toBe("VALID");
    expect(r.warnings.some((w) => w.includes("LOAD_SPIKE"))).toBe(true);
    const base = computeScore(baseInput());
    expect(r.confidence ?? 100).toBeLessThan(base.confidence ?? 0);
  });
});

// ---------------------------------------------------------------------------
// Bands and confidence
// ---------------------------------------------------------------------------

describe("bands", () => {
  it("READY ≥ 70, MONITOR 40–69.9, COMPROMISED < 40", () => {
    expect(PrototypeThresholdsSchema.parse({}).bandReadyMin).toBe(70);
    expect(PrototypeThresholdsSchema.parse({}).bandMonitorMin).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Reproducibility
// ---------------------------------------------------------------------------

describe("reproducibility", () => {
  it("identical inputs produce identical outputs (pure function)", () => {
    const input = baseInput();
    const a = computeScore(input);
    const b = computeScore({ ...input, observations: input.observations.map((o) => ({ ...o })) });
    expect(a.score).toBe(b.score);
    expect(a.band).toBe(b.band);
    expect(a.confidence).toBe(b.confidence);
    expect(a.components.map((c) => c.score)).toEqual(b.components.map((c) => c.score));
  });

  it("explicit renormalization is visible and marked LIMITED", () => {
    const input = baseInput();
    // Environment observations entirely absent (optional component).
    input.observations = input.observations.filter(
      (o) => o.metric !== "HEAT_C" && o.metric !== "AQI" && o.metric !== "ALT_M" && o.metric !== "TZ_SHIFT_H",
    );
    const r = computeScore(input);
    expect(r.score).not.toBeNull();
    expect(r.validity).toBe("LIMITED");
    expect(r.explanation).toContain("renormalized over 6/7");
  });

  it("components and weights are persisted for provenance", () => {
    const r = computeScore(baseInput());
    const sumWeights = r.components.reduce((a, c) => a + c.weight, 0);
    expect(Math.abs(sumWeights - 1)).toBeLessThanOrEqual(0.001);
    for (const c of r.components) {
      expect(c.metricDetails.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildBaselines
// ---------------------------------------------------------------------------

describe("buildBaselines", () => {
  it("computes p10/p50/p90 from valid history within window", () => {
    const history: MetricSnapshot[] = [];
    for (let i = 0; i < 30; i++) {
      history.push(obs("HRV_MS", 50 + i, { timestamp: new Date(Date.UTC(2025, 8, 1 + i, 10)).toISOString() }));
    }
    const baselines = buildBaselines(history, ["HRV_MS"], 28, 8, new Date(Date.UTC(2025, 9, 1)));
    expect(baselines[0].n).toBe(28);
    expect(baselines[0].p50).toBeGreaterThan(50);
    expect(baselines[0].p90).toBeGreaterThan(baselines[0].p10);
  });

  it("flags insufficient n honestly", () => {
    const nowIso = new Date().toISOString();
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const history = [obs("HRV_MS", 70, { timestamp: hourAgo }), obs("HRV_MS", 72, { timestamp: nowIso })];
    const baselines = buildBaselines(history, ["HRV_MS"], 28, 8, new Date());
    expect(baselines[0].n).toBe(2);
  });
});
