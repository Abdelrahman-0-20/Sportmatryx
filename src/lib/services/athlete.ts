import { prisma } from "@/lib/prisma";

/** Player 360 + longitudinal services. */

export interface AthleteScoreRow {
  id: string;
  timestamp: string;
  score: number | null;
  band: string | null;
  confidence: number | null;
  validity: string;
  withheldCode: string | null;
  explanation: string | null;
}

export interface AthleteDetail {
  athlete: {
    id: string;
    externalId: string | null;
    displayName: string;
    position: string;
    rosterRole: string | null;
    isActive: boolean;
    teamName: string;
    teamId: string;
  };
  consent: { status: string; reason: string | null; grantedAt: string } | null;
  latestScore: (AthleteScoreRow & {
    components: { name: string; score: number | null; weight: number; contribution: number | null; reason: string | null }[];
    drivers: { type: string; text: string; strength: number | null }[];
    checks: { name: string; status: string; reason: string | null }[];
  }) | null;
  trend: (number | null)[];
  baseline: {
    id: string;
    status: string;
    version: number;
    notes: string | null;
    observations: { metric: string; p10: number; p50: number; p90: number; n: number }[];
  } | null;
  sessions: {
    id: string;
    type: string;
    date: string;
    durationMinutes: number | null;
    intensity: string | null;
    venue: string | null;
    temperature: number | null;
    airQualityIndex: number | null;
    opponent: string | null;
  }[];
  interventions: {
    id: string;
    exceptionKey: string;
    description: string;
    priority: string;
    status: string;
    createdAt: string;
  }[];
  devices: { serialNumber: string; model: string; calibrationStatus: string; calibratedAt: string }[];
}

export async function getAthleteDetail(athleteId: string): Promise<AthleteDetail | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      team: { select: { id: true, name: true } },
      consentRecords: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!athlete) return null;

  const scores = await prisma.performanceScore.findMany({
    where: { athleteId },
    orderBy: { timestamp: "desc" },
    take: 15,
    include: {
      scoreComponents: { orderBy: { componentName: "asc" } },
      scoreDrivers: true,
      validityChecks: true,
    },
  });

  const latest = scores[0] ?? null;
  const baseline = await prisma.athleteBaseline.findFirst({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    include: { baselineObservations: true },
  });
  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: 10,
    include: { footballContexts: { select: { venue: true, temperature: true, airQualityIndex: true, opponent: true }, take: 1 } },
  });
  const interventions = await prisma.intervention.findMany({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const deviceIds = await prisma.observation.findMany({
    where: { athleteId, deviceId: { not: null } },
    select: { deviceId: true },
    distinct: ["deviceId"],
    take: 5,
  });
  const deviceRows = await prisma.device.findMany({
    where: { id: { in: deviceIds.map((d) => d.deviceId as string) } },
    include: { calibrationRecords: { orderBy: { calibrationDate: "desc" }, take: 1 } },
  });

  const trend = scores
    .slice(0, 14)
    .reverse()
    .map((s) => (s.validityStatus === "VALID" || s.validityStatus === "LIMITED" ? s.score : null));

  return {
    athlete: {
      id: athlete.id,
      externalId: athlete.externalId,
      displayName: `${athlete.firstName} ${athlete.lastName}`,
      position: athlete.position,
      rosterRole: athlete.rosterRole,
      isActive: athlete.isActive,
      teamName: athlete.team.name,
      teamId: athlete.teamId,
    },
    consent: athlete.consentRecords[0]
      ? {
          status: athlete.consentRecords[0].status,
          reason: athlete.consentRecords[0].reason,
          grantedAt: athlete.consentRecords[0].grantedAt.toISOString(),
        }
      : null,
    latestScore: latest
      ? {
          id: latest.id,
          timestamp: latest.timestamp.toISOString(),
          score: latest.score,
          band: latest.scoreBand,
          confidence: latest.confidence === null ? null : Math.round(latest.confidence * 100),
          validity: latest.validityStatus,
          withheldCode: latest.validityReason,
          explanation: latest.explanation,
          components: latest.scoreComponents.map((c) => ({
            name: c.componentName,
            score: c.normalizedValue,
            weight: c.weightApplied,
            contribution: c.contributionToScore,
            reason: c.validityReason,
          })),
          drivers: latest.scoreDrivers.map((d) => ({
            type: d.driverType,
            text: d.description,
            strength: d.strength,
          })),
          checks: latest.validityChecks.map((c) => ({
            name: c.checkName,
            status: c.status,
            reason: c.reason,
          })),
        }
      : null,
    trend,
    baseline: baseline
      ? {
          id: baseline.id,
          status: baseline.status,
          version: baseline.version,
          notes: baseline.notes,
          observations: baseline.baselineObservations
            .filter((o) => o.metadata !== null && typeof o.metadata === "object")
            .map((o) => {
              const meta = o.metadata as { p10?: number; p50?: number; p90?: number; n?: number };
              return {
                metric: o.observationType,
                p10: meta.p10 ?? 0,
                p50: meta.p50 ?? 0,
                p90: meta.p90 ?? 0,
                n: meta.n ?? 0,
              };
            }),
        }
      : null,
    sessions: sessions.map((s) => ({
      id: s.id,
      type: s.sessionType,
      date: s.date.toISOString(),
      durationMinutes: s.durationMinutes,
      intensity: s.intensity,
      venue: s.footballContexts[0]?.venue ?? null,
      temperature: s.footballContexts[0]?.temperature ?? null,
      airQualityIndex: s.footballContexts[0]?.airQualityIndex ?? null,
      opponent: s.footballContexts[0]?.opponent ?? null,
    })),
    interventions: interventions.map((i) => ({
      id: i.id,
      exceptionKey: i.exceptionKey,
      description: i.description,
      priority: i.priority,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
    devices: deviceRows.map((d) => ({
      serialNumber: d.serialNumber,
      model: d.model,
      calibrationStatus: d.calibrationRecords[0]?.status ?? "Unknown",
      calibratedAt: d.calibrationRecords[0]?.calibrationDate.toISOString() ?? "",
    })),
  };
}
