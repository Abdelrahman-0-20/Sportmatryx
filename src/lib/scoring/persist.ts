import { prisma } from "@/lib/prisma";
import type { ScoringInput, ScoringResult } from "@/lib/scoring/types";
import type { Prisma } from "@prisma/client";

/**
 * Persist a computed ScoringResult as a full provenance record:
 * PerformanceScore + ScoreComponent[] + ScoreDriver[] + ValidityCheck[].
 *
 * Reproducibility contract: the persisted components, checks and drivers are
 * sufficient to recompute and re-verify the composite from saved inputs.
 */
export async function persistScore(
  input: ScoringInput,
  result: ScoringResult,
  refs: {
    performanceModelId: string;
    modelConfigurationVersionId: string;
    athleteBaselineId: string | null;
    observationIdsByMetric: Partial<Record<string, string>>;
  },
): Promise<string> {
  const componentsData: Prisma.ScoreComponentCreateManyPerformanceScoreInput[] =
    result.components.map((c) => ({
      componentName: c.component,
      normalizedValue: c.score ?? 0,
      originalValue: c.metricDetails[0]?.value ?? null,
      originalUnit: c.metricDetails[0]?.unit ?? null,
      weightApplied: c.weight,
      contributionToScore: c.contribution ?? 0,
      validityStatus: c.score === null ? "INSUFFICIENT_DATA" : result.validity === "LIMITED" ? "LIMITED" : "VALID",
      validityReason: c.reason,
      observationId:
        (c.metricDetails[0] &&
          refs.observationIdsByMetric[c.metricDetails[0].metric as string]) ||
        null,
    }));

  const driversData: Prisma.ScoreDriverCreateManyPerformanceScoreInput[] = result.drivers.map((d) => ({
    driverType: d.type,
    description: d.text,
    strength: d.strength,
  }));

  const checksData: Prisma.ValidityCheckCreateManyPerformanceScoreInput[] = result.checks.map((c) => ({
    checkName: c.check,
    status: c.status,
    reason: c.reason,
    details: { severity: c.severity },
  }));

  const created = await prisma.performanceScore.create({
    data: {
      athleteId: input.athleteId,
      performanceModelId: refs.performanceModelId,
      modelConfigurationVersionId: refs.modelConfigurationVersionId,
      athleteBaselineId: refs.athleteBaselineId,
      timestamp: new Date(input.scoringDate),
      score: result.score,
      scoreBand: result.band,
      confidence: result.confidence === null ? null : result.confidence / 100,
      validityStatus: mapValidity(result.validity),
      validityReason: result.withheldCode,
      explanation: result.explanation,
      scoreComponents: { create: componentsData },
      scoreDrivers: { create: driversData },
      validityChecks: { create: checksData },
    },
    select: { id: true },
  });
  return created.id;
}

export function mapValidity(
  v: ScoringResult["validity"],
): "VALID" | "LIMITED" | "WITHHELD" | "RETEST" | "INSUFFICIENT_BASELINE" | "INSUFFICIENT_DATA" {
  switch (v) {
    case "VALID":
      return "VALID";
    case "LIMITED":
      return "LIMITED";
    case "WITHHELD":
      return "WITHHELD";
    case "RETEST":
      return "RETEST";
    case "INSUFFICIENT_BASELINE":
      return "INSUFFICIENT_BASELINE";
    default:
      return "INSUFFICIENT_DATA";
  }
}
