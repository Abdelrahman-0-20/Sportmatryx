import {
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  COMPONENT_METRICS,
  MANDATORY_COMPONENTS,
  ENV_PENALTY,
  METRIC_CATALOG,
  PrototypeThresholdsSchema,
  type ComponentKey,
  type MetricKey,
  type PrototypeThresholds,
} from "./config";
import type {
  CheckOutcome,
  ComponentOutcome,
  DriverOutcome,
  MetricSnapshot,
  ScoringInput,
  ScoringResult,
  BaselinePercentile,
} from "./types";
import { clamp01, round1 } from "./types";

export const DEFAULT_THRESHOLDS_OVERRIDE = undefined;

/**
 * ============================================================================
 * SMX PERFORMANCE INDEX ENGINE (PROTOTYPE)
 * ============================================================================
 * Pure functions. Deterministic for identical inputs. No DB, no I/O.
 *
 * Pipeline (fail closed):
 *   1. Validity gates — any mandatory failure withholds the composite.
 *   2. Component scores — athlete-own-baseline normalization to 0..1.
 *   3. Weighted composite — explicit renormalization only when LIMITED.
 *   4. Band + confidence + drivers + explanation.
 */

// ---------------------------------------------------------------------------
// Percentile helpers
// ---------------------------------------------------------------------------

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Build rolling-baseline percentiles for the requested metrics from
 * historical valid observations. Returns metrics lacking the minimum n
 * as baseline- insufficient (the gate reports them explicitly).
 */
export function buildBaselines(
  history: MetricSnapshot[],
  metrics: MetricKey[],
  windowDays: number,
  minN: number,
  now: Date,
): BaselinePercentile[] {
  const cutoff = now.getTime() - windowDays * 24 * 3600 * 1000;
  const out: BaselinePercentile[] = [];
  for (const metric of metrics) {
    const values = history
      .filter(
        (o) =>
          o.metric === metric &&
          o.isValid &&
          new Date(o.timestamp).getTime() >= cutoff,
      )
      .map((o) => o.value)
      .sort((a, b) => a - b);
    if (values.length < 2) {
      out.push({ metric, p10: NaN, p50: NaN, p90: NaN, n: values.length, windowDays });
      continue;
    }
    out.push({
      metric,
      p10: percentile(values, 0.1),
      p50: percentile(values, 0.5),
      p90: percentile(values, 0.9),
      n: values.length,
      windowDays,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalization (athlete-own-baseline, unit-aware, direction-aware)
// ---------------------------------------------------------------------------

/**
 * Map a raw value onto 0..1 using the athlete's own p10/p90.
 *  - HIGHER_BETTER: s = clamp((x − p10) / (p90 − p10))
 *  - LOWER_BETTER:  inverted
 *  - DEViation:     closeness to the athlete's own p50 (closer → higher)
 *  - PENALTY/CONTEXT: handled by dedicated functions; never normalized here.
 */
export function normalizeAgainstBaseline(
  metric: MetricKey,
  value: number,
  baseline: BaselinePercentile | undefined,
): number | null {
  const direction = METRIC_CATALOG[metric].direction;
  if (direction === "PENALTY" || direction === "CONTEXT") return null;
  if (!baseline || Number.isNaN(baseline.p10)) return null;
  const spread = Math.max(baseline.p90 - baseline.p10, 1e-6);
  switch (direction) {
    case "HIGHER_BETTER":
      return clamp01((value - baseline.p10) / spread);
    case "LOWER_BETTER":
      return clamp01((baseline.p90 - value) / spread);
    case "DEViation": {
      const dev = Math.abs(value - baseline.p50) / spread;
      return clamp01(1 - dev);
    }
    default:
      return null;
  }
}

/** Linear penalty curve: 1 until start, 0 past full (bounded, monotonic). */
function penaltyCurve(value: number, start: number, full: number, maxPenalty: number): number {
  if (value <= start) return 0;
  if (value >= full) return maxPenalty;
  return ((value - start) / (full - start)) * maxPenalty;
}

function environmentScore(day: MetricSnapshot[]): number | null {
  const pick = (m: MetricKey): number | null => {
    const obs = day.find((o) => o.metric === m && o.isValid);
    return obs ? obs.value : null;
  };
  const heat = pick("HEAT_C");
  const aqi = pick("AQI");
  const alt = pick("ALT_M");
  const tz = pick("TZ_SHIFT_H");
  if (heat === null && aqi === null && alt === null && tz === null) return null;
  let penalty = 0;
  if (heat !== null)
    penalty += penaltyCurve(heat, ENV_PENALTY.heat.start, ENV_PENALTY.heat.full, ENV_PENALTY.heat.maxPenalty);
  if (aqi !== null)
    penalty += penaltyCurve(aqi, ENV_PENALTY.aqi.start, ENV_PENALTY.aqi.full, ENV_PENALTY.aqi.maxPenalty);
  if (alt !== null)
    penalty += penaltyCurve(alt, ENV_PENALTY.altitude.start, ENV_PENALTY.altitude.full, ENV_PENALTY.altitude.maxPenalty);
  if (tz !== null)
    penalty += penaltyCurve(tz, ENV_PENALTY.timeZone.start, ENV_PENALTY.timeZone.full, ENV_PENALTY.timeZone.maxPenalty);
  return clamp01(1 - penalty);
}

// ---------------------------------------------------------------------------
// Validity gates (run BEFORE scoring; fail closed)
// ---------------------------------------------------------------------------

function runGates(
  input: ScoringInput,
  th: PrototypeThresholds,
): { checks: CheckOutcome[]; hardFail: boolean; loadSpike: boolean } {
  const checks: CheckOutcome[] = [];

  // 1. Consent state.
  if (input.consent === "GRANTED") {
    checks.push({ check: "CONSENT_STATE", status: "PASSED", severity: null, reason: "Consent granted." });
  } else {
    checks.push({
      check: "CONSENT_STATE",
      status: "FAILED",
      severity: "HIGH",
      reason: `CONSENT_RESTRICTED — data access is ${input.consent.toLowerCase()}.`,
    });
  }

  // 2. Calibration freshness (required only when a device is referenced).
  if (!input.calibration) {
    checks.push({
      check: "CALIBRATION_FRESHNESS",
      status: "NOT_APPLICABLE",
      severity: null,
      reason: "No device referenced for this capture.",
    });
  } else {
    const ageH = (new Date(input.now).getTime() - new Date(input.calibration.calibratedAt).getTime()) / 3600000;
    const expired = input.calibration.status !== "OK";
    if (expired || ageH > th.calibrationCriticalHours) {
      checks.push({
        check: "CALIBRATION_FRESHNESS",
        status: "FAILED",
        severity: "HIGH",
        reason: `CALIBRATION_STALE — calibration ${expired ? "status " + input.calibration.status.toLowerCase() : `${Math.round(ageH)}h old`} on ${input.calibration.deviceLabel}.`,
      });
    } else if (ageH > th.calibrationStaleHours) {
      checks.push({
        check: "CALIBRATION_FRESHNESS",
        status: "WARNING",
        severity: "MODERATE",
        reason: `Calibration ${Math.round(ageH)}h old (aging; retest threshold ${th.calibrationStaleHours}h).`,
      });
    } else {
      checks.push({
        check: "CALIBRATION_FRESHNESS",
        status: "PASSED",
        severity: null,
        reason: `Calibration fresh (${Math.round(ageH)}h).`,
      });
    }
  }

  // 3. Sample integrity (respiratory capture quality).
  const wear = input.observations.find((o) => o.metric === "RESP_RATE")?.maskWearMinutes;
  const validRatio =
    input.observations.length > 0
      ? input.observations.filter((o) => o.isValid).length / input.observations.length
      : 0;
  const worstSignal = input.observations.length
    ? Math.min(...input.observations.map((o) => o.signalQuality))
    : 0;
  if (input.observations.length === 0) {
    checks.push({ check: "SAMPLE_INTEGRITY", status: "FAILED", severity: "HIGH", reason: "No observations for this capture." });
  } else if (validRatio < th.minValidSampleRatio || worstSignal < th.minSignalQuality || (wear !== undefined && wear < th.minMaskWearMinutes)) {
    const parts: string[] = [];
    if (validRatio < th.minValidSampleRatio) parts.push(`valid ratio ${(validRatio * 100).toFixed(0)}% < ${(th.minValidSampleRatio * 100).toFixed(0)}%`);
    if (worstSignal < th.minSignalQuality) parts.push(`signal quality ${worstSignal.toFixed(2)} < ${th.minSignalQuality}`);
    if (wear !== undefined && wear < th.minMaskWearMinutes) parts.push(`mask wear ${wear}min < ${th.minMaskWearMinutes}min`);
    checks.push({
      check: "SAMPLE_INTEGRITY",
      status: "FAILED",
      severity: "HIGH",
      reason: `SAMPLE_INTEGRITY_LOW — ${parts.join("; ")}.`,
    });
  } else {
    checks.push({
      check: "SAMPLE_INTEGRITY",
      status: "PASSED",
      severity: null,
      reason: `Sample integrity OK (ratio ${(validRatio * 100).toFixed(0)}%, signal ≥ ${worstSignal.toFixed(2)}).`,
    });
  }

  // 4. Baseline sufficiency — mandatory components need usable baselines.
  const mandatory: ComponentKey[] = ["RESPIRATORY_EFFICIENCY", "OXYGEN_FUNCTION", "RECOVERY_AUTONOMIC", "WORKLOAD_RESPONSE"];
  const missingB: string[] = [];
  const insuffB2: string[] = [];
  for (const c of mandatory) {
    for (const m of COMPONENT_METRICS[c]) {
      const direction = METRIC_CATALOG[m].direction;
      if (direction === "PENALTY" || direction === "CONTEXT") continue;
      const b = input.baselines.find((x) => x.metric === m);
      if (!b) { missingB.push(m); continue; }
      if (b.n < th.baselineMinObservations) insuffB2.push(`${m} (n=${b.n} < ${th.baselineMinObservations})`);
    }
  }
  if (missingB.length > 0) {
    checks.push({
      check: "BASELINE_SUFFICIENCY",
      status: "FAILED",
      severity: "HIGH",
      reason: `INSUFFICIENT_BASELINE — no baseline established for: ${missingB.join(", ")}.`,
    });
  } else if (insuffB2.length > 0) {
    checks.push({
      check: "BASELINE_SUFFICIENCY",
      status: "FAILED",
      severity: "HIGH",
      reason: `INSUFFICIENT_BASELINE — observations below minimum: ${insuffB2.join(", ")}.`,
    });
  } else {
    checks.push({
      check: "BASELINE_SUFFICIENCY",
      status: "PASSED",
      severity: null,
      reason: `Baselines sufficient (n ≥ ${th.baselineMinObservations} in ${th.baselineWindowDays}d window).`,
    });
  }

  // 5. Timestamp freshness.
  const latest = input.observations.reduce<number>(
    (acc, o) => Math.max(acc, new Date(o.timestamp).getTime()),
    0,
  );
  if (latest === 0) {
    checks.push({ check: "TIMESTAMP_FRESHNESS", status: "FAILED", severity: "HIGH", reason: "No observations to evaluate." });
  } else {
    const ageH = (new Date(input.now).getTime() - latest) / 3600000;
    if (ageH > th.observationFreshnessHours) {
      checks.push({
        check: "TIMESTAMP_FRESHNESS",
        status: "FAILED",
        severity: "HIGH",
        reason: `Stale capture — most recent observation ${Math.round(ageH)}h old (> ${th.observationFreshnessHours}h).`,
      });
    } else {
      checks.push({ check: "TIMESTAMP_FRESHNESS", status: "PASSED", severity: null, reason: `Capture fresh (${Math.round(ageH)}h).` });
    }
  }

  // 6. LOAD_SPIKE — does not withhold; produces a Moderate exception and
  //    degrades confidence (per specification).
  const acwr = input.observations.find((o) => o.metric === "ACWR" && o.isValid);
  let loadSpike = false;
  if (acwr && acwr.value > th.acwrSpikeThreshold) {
    loadSpike = true;
    checks.push({
      check: "LOAD_SPIKE",
      status: "WARNING",
      severity: "MODERATE",
      reason: `LOAD_SPIKE — acute:chronic workload ${acwr.value.toFixed(2)} > ${th.acwrSpikeThreshold}. Confidence degraded; human review suggested.`,
    });
  }

  const failed = checks.filter((c) => c.status === "FAILED");
  return { checks, hardFail: failed.length > 0, loadSpike };
}

// ---------------------------------------------------------------------------
// Component scoring
// ---------------------------------------------------------------------------

function scoreComponent(
  component: ComponentKey,
  day: MetricSnapshot[],
  baselines: BaselinePercentile[],
  th: PrototypeThresholds,
  warnings: string[],
): { score: number | null; details: ComponentOutcome["metricDetails"]; missing: MetricKey[] } {
  const metrics = COMPONENT_METRICS[component];
  const details: ComponentOutcome["metricDetails"] = [];
  const missing: MetricKey[] = [];
  const parts: number[] = [];
  for (const m of metrics) {
    const direction = METRIC_CATALOG[m].direction;
    const obs = day.find((o) => o.metric === m && o.isValid);
    const b = baselines.find((x) => x.metric === m);
    const baselineOut =
      b && !Number.isNaN(b.p10) ? { p10: b.p10, p50: b.p50, p90: b.p90, n: b.n } : null;
    if (direction === "PENALTY") {
      details.push({ metric: m, value: obs ? obs.value : null, unit: METRIC_CATALOG[m].unit, baseline: baselineOut, direction });
      continue;
    }
    if (!obs) {
      details.push({ metric: m, value: null, unit: METRIC_CATALOG[m].unit, baseline: baselineOut, direction });
      if (direction !== "CONTEXT") missing.push(m);
      continue;
    }
    if (direction === "CONTEXT") {
      details.push({ metric: m, value: obs.value, unit: METRIC_CATALOG[m].unit, baseline: baselineOut, direction });
      continue;
    }
    const s = normalizeAgainstBaseline(m, obs.value, b);
    if (s === null) {
      details.push({ metric: m, value: obs.value, unit: METRIC_CATALOG[m].unit, baseline: baselineOut, direction });
      missing.push(m);
      continue;
    }
    parts.push(s);
    details.push({ metric: m, value: obs.value, unit: METRIC_CATALOG[m].unit, baseline: baselineOut, direction });
  }

  if (component === "ENVIRONMENT_TRAVEL") {
    const env = environmentScore(day);
    if (env === null) {
      return { score: null, details, missing: metrics as unknown as MetricKey[] };
    }
    return { score: env, details, missing: [] };
  }

  if (component === "WORKLOAD_RESPONSE") {
    // Response semantics: today's load vs own typical load (deviation),
    // degraded when acute:chronic spikes (LOAD_SPIKE does not withhold).
    const loadObs = day.find((o) => o.metric === "LOAD_AU" && o.isValid);
    if (!loadObs) {
      return { score: null, details, missing: ["LOAD_AU"] };
    }
    const b = baselines.find((x) => x.metric === "LOAD_AU");
    const dev = normalizeAgainstBaseline("LOAD_AU", loadObs.value, b);
    if (dev === null) return { score: null, details, missing: ["LOAD_AU"] };
    let s = dev;
    const acwr = day.find((o) => o.metric === "ACWR" && o.isValid);
    if (acwr && acwr.value > th.acwrSpikeThreshold) {
      s *= 0.9;
      warnings.push(`LOAD_SPIKE — ACWR ${acwr.value.toFixed(2)} > ${th.acwrSpikeThreshold} (response degraded, review suggested).`);
    }
    return { score: s, details, missing: [] };
  }

  const usable = metrics.filter((m) => {
    const direction = METRIC_CATALOG[m].direction;
    return direction !== "PENALTY" && direction !== "CONTEXT";
  });
  if (parts.length === 0) {
    return { score: null, details, missing: usable };
  }
  return { score: parts.reduce((a, b) => a + b, 0) / parts.length, details, missing: [] };
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function buildDrivers(
  components: ComponentOutcome[],
  weights: Record<string, number>,
  priorContributions: Record<string, number> | null,
): DriverOutcome[] {
  const rows = COMPONENT_KEYS.map((k) => {
    const c = components.find((x) => x.component === k);
    if (!c || c.score === null) return null;
    const contrib = c.score * (weights[k] ?? 0) * 100;
    const prior = priorContributions ? priorContributions[k] : null;
    if (prior === null || prior === undefined || Number.isNaN(prior)) {
      return { type: contrib >= 50 ? "POSITIVE" : "NEGATIVE", text: `${COMPONENT_LABELS[k]} at ${Math.round(c.score * 100)}% capacity`, strength: 0 } as DriverOutcome;
    }
    const delta = contrib - prior;
    const dir = delta >= 0 ? "+" : "−";
    const text = `${COMPONENT_LABELS[k]} ${dir}${Math.abs(delta).toFixed(1)} pts vs own baseline`;
    return { type: delta >= 0 ? "POSITIVE" : "NEGATIVE", text, strength: Math.abs(delta) } as DriverOutcome;
  }).filter((x): x is DriverOutcome => x !== null);

  const positive = rows.filter((d) => d.type === "POSITIVE").sort((a, b) => b.strength - a.strength).slice(0, 3);
  const negative = rows.filter((d) => d.type === "NEGATIVE").sort((a, b) => b.strength - a.strength).slice(0, 3);
  return [...positive, ...negative];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeScore(input: ScoringInput, thresholdsOverride?: PrototypeThresholds): ScoringResult {
  const th = thresholdsOverride ?? PrototypeThresholdsSchema.parse({});
  const warnings: string[] = [];

  const { checks, hardFail, loadSpike } = runGates(input, th);

  // Component scoring (always attempted; gates decide release).
  const day = input.observations;
  const components: ComponentOutcome[] = COMPONENT_KEYS.map((k) => {
    const weight = input.weights[k] ?? 0;
    const { score, details } = scoreComponent(k, day, input.baselines, th, warnings);
    let status: ComponentOutcome["status"] = score === null ? "MISSING" : "VALID";
    let reason: string | null = null;
    if (score === null) {
      reason =
        k === "WORKLOAD_RESPONSE"
          ? "No training load captured on this date (rest day or missing capture)."
          : `Missing required measurements: ${COMPONENT_METRICS[k].filter((m) => METRIC_CATALOG[m].direction !== "PENALTY" && METRIC_CATALOG[m].direction !== "CONTEXT").join(", ")}.`;
    } else if (score < 0.15) {
      status = "LIMITED";
      reason = "Very low component score — verify data quality before acting.";
    }
    return {
      component: k,
      score: score === null ? null : round1(score * 100) / 100,
      weight,
      contribution: score === null ? null : round1(score * weight * 1000) / 10,
      status,
      reason,
      metricDetails: details,
    };
  });

  // Observation completeness: respiratory / oxygen / recovery are captured on
  // every training and testing day — a missing mandatory component (other than
  // workload, which legitimately rests) is an incomplete capture → withhold.
  const incompleteMandatory = components.filter(
    (c) => MANDATORY_COMPONENTS.includes(c.component as ComponentKey) &&
      c.component !== "WORKLOAD_RESPONSE" &&
      c.score === null,
  );
  if (incompleteMandatory.length > 0) {
    const names = incompleteMandatory.map((c) => c.component).join(", ");
    return {
      score: null,
      band: "WITHHELD",
      confidence: null,
      validity: "WITHHELD",
      withheldCode: "OBSERVATION_COMPLETENESS",
      explanation: `Composite withheld — incomplete capture for mandatory components: ${names}. ${incompleteMandatory.map((c) => c.reason).join(" ")}`,
      checks,
      components,
      drivers: [],
      warnings,
    };
  }

  // Baseline deviation component = closeness of today's key metrics to own p50.
  const devComp = components.find((c) => c.component === "BASELINE_DEVIATION");
  if (devComp) {
    const devMetrics: MetricKey[] = ["RESP_RATE", "HRV_MS", "RHR", "SLEEP_H"];
    const devs: number[] = [];
    for (const m of devMetrics) {
      const obs = day.find((o) => o.metric === m && o.isValid);
      const b = input.baselines.find((x) => x.metric === m);
      if (!obs || !b || Number.isNaN(b.p10)) continue;
      const spread = Math.max(b.p90 - b.p10, 1e-6);
      devs.push(clamp01(1 - Math.abs(obs.value - b.p50) / spread));
    }
    if (devs.length >= 2) {
      const s = devs.reduce((a, b) => a + b, 0) / devs.length;
      devComp.score = round1(s * 100) / 100;
      devComp.contribution = round1(s * (input.weights.BASELINE_DEVIATION ?? 0) * 1000) / 10;
      devComp.status = "VALID";
      devComp.reason = null;
    }
  }

  // ---- Gate failures → WITHHELD (never a number, never zero) --------------
  if (hardFail) {
    const failedChecks = checks.filter((c) => c.status === "FAILED");
    const anyInsufficient = failedChecks.some((c) => c.reason.includes("INSUFFICIENT_BASELINE"));
    const withheldCode = failedChecks.length >= 2 ? "MULTI_FAIL" : failedChecks[0].check;
    const validity: ScoringResult["validity"] = anyInsufficient
      ? "INSUFFICIENT_BASELINE"
      : failedChecks.length >= 2
        ? "RETEST"
        : "WITHHELD";
    const failedNames = failedChecks.map((c) => c.check).join(", ");
    return {
      score: null,
      band: "WITHHELD",
      confidence: null,
      validity,
      withheldCode,
      explanation: `Composite withheld — failed validity checks: ${failedNames}. ${failedChecks.map((c) => c.reason).join(" ")}`,
      checks,
      components,
      drivers: [],
      warnings,
    };
  }

  // ---- Composite ----------------------------------------------------------
  const scored = components.filter((c) => c.score !== null);
  if (scored.length === 0) {
    return {
      score: null,
      band: "WITHHELD",
      confidence: null,
      validity: "WITHHELD",
      withheldCode: "NO_SCORABLE_DATA",
      explanation: "Composite withheld — no component could be scored from the supplied observations.",
      checks,
      components,
      drivers: [],
      warnings,
    };
  }

  const weights = { ...input.weights };
  let validity: ScoringResult["validity"] = "VALID";
  let renormNote = "";

  if (scored.length < COMPONENT_KEYS.length && th.allowExplicitRenormalization) {
    // Explicit renormalization over available components (documented behavior).
    const sumUsed = scored.reduce((acc, c) => acc + c.weight, 0);
    if (sumUsed <= 0) {
      return {
        score: null, band: "WITHHELD", confidence: null, validity: "WITHHELD",
        withheldCode: "ZERO_WEIGHT_MASS",
        explanation: "Composite withheld — available components carry zero weight mass.",
        checks, components, drivers: [], warnings,
      };
    }
    for (const c of scored) c.weight = round1((c.weight / sumUsed) * 1000) / 1000;
    validity = "LIMITED";
    renormNote = ` LIMITED result: renormalized over ${scored.length}/7 components (${(sumUsed * 100).toFixed(0)}% of configured weight mass).`;
  }
  const composite = scored.reduce((acc, c) => acc + (c.score as number) * c.weight, 0) * 100;
  if (loadSpike) warnings.push("LOAD_SPIKE — acute:chronic workload ratio exceeded threshold; confidence degraded.");

  const finalScore = round1(composite);
  const band =
    finalScore >= th.bandReadyMin ? "READY" : finalScore >= th.bandMonitorMin ? "MONITOR" : "COMPROMISED";

  // ---- Confidence ----------------------------------------------------------
  const freshnessFactor = checks.find((c) => c.check === "CALIBRATION_FRESHNESS");
  const calFactor =
    freshnessFactor?.status === "PASSED"
      ? 1
      : freshnessFactor?.status === "WARNING"
        ? 0.9
        : 0.75;
  const signalFactor = clamp01(
    day.length ? Math.min(...day.map((o) => o.signalQuality)) : 0,
  );
  const completeness = scored.length / COMPONENT_KEYS.length;
  const mandatoryN = ["RESP_RATE", "SPO2", "HRV_MS", "LOAD_AU"]
    .map((m) => input.baselines.find((b) => b.metric === (m as MetricKey))?.n ?? 0);
  const baselineMaturity = clamp01(Math.min(...mandatoryN) / th.baselineMaturityN);
  let confidence = 100 * calFactor * signalFactor * completeness * baselineMaturity;
  if (loadSpike) confidence *= 0.9;
  confidence = Math.round(confidence);

  // ---- Drivers -------------------------------------------------------------
  const drivers = buildDrivers(components, weights, input.priorContributions ?? null);

  const driverNote = drivers.length
    ? ` Key drivers: ${drivers.slice(0, 2).map((d) => d.text).join("; ")}.`
    : "";

  const explanation =
    (validity === "LIMITED" ? "Composite computed with explicit renormalization." : "Composite computed with all seven components.") +
    renormNote +
    (loadSpike ? " LOAD_SPIKE detected — review suggested." : "") +
    driverNote +
    " PROTOTYPE model — decision support only, not a medical device.";

  return {
    score: finalScore,
    band,
    confidence,
    validity,
    withheldCode: null,
    explanation,
    checks,
    components,
    drivers,
    warnings,
  };
}
