import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withFallback } from "@/lib/offline";
import { SAMPLE_ROSTER, SAMPLE_OVERVIEW } from "@/lib/offline/sample-data";

/**
 * Team Command data services. All summaries come from persisted records —
 * never fabricated client-side. Latest score per athlete via DISTINCT ON.
 */

export interface RosterRow {
  athleteId: string;
  externalId: string | null;
  displayName: string;
  position: string;
  positionGroup: string;
  teamId: string;
  teamName: string;
  score: number | null;
  band: string | null;
  confidence: number | null; // 0..100
  validity: string;
  withheldCode: string | null;
  timestamp: string | null;
  openExceptions: number;
  maxSeverity: string | null;
}

export interface TeamOverview {
  roster: RosterRow[];
  counts: { ready: number; monitor: number; compromised: number; withheld: number };
  openExceptions: number;
  criticalHighExceptions: number;
  positionSummaries: { position: string; avgScore: number | null; ready: number; total: number }[];
  recentSessions: {
    id: string;
    athleteName: string;
    sessionType: string;
    date: string;
    durationMinutes: number | null;
    intensity: string | null;
    venue: string | null;
    temperature: number | null;
    airQualityIndex: number | null;
  }[];
  recentBaselineChanges: { athleteId: string; athleteName: string; metric: string; note: string; updatedAt: string }[];
}

export async function getRosterRows(teamId?: string): Promise<RosterRow[]> {
  return withFallback(
    () => queryRosterRows(teamId),
    () => [...SAMPLE_ROSTER].filter((r) => (teamId ? r.teamId === teamId : true)),
  );
}

async function queryRosterRows(teamId?: string): Promise<RosterRow[]> {
  const teamFilter = teamId ? Prisma.sql`WHERE a."teamId" = ${teamId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    {
      athleteId: string;
      externalId: string | null;
      firstName: string;
      lastName: string;
      position: string;
      teamId: string;
      teamName: string;
      score: number | null;
      band: string | null;
      confidence: number | null;
      validity: string;
      validityReason: string | null;
      timestamp: Date | null;
      openExceptions: bigint;
      maxSeverity: string | null;
    }[]
  >`
    SELECT a.id AS "athleteId",
           a."externalId",
           a."firstName",
           a."lastName",
           a.position::text AS position,
           t.id AS "teamId",
           t.name AS "teamName",
           s.score,
           s."scoreBand" AS band,
           s.confidence::float8 AS confidence,
           s."validityStatus"::text AS validity,
           s."validityReason" AS "validityReason",
           s.timestamp,
           COALESCE(exc.cnt, 0) AS "openExceptions",
           exc.sev AS "maxSeverity"
    FROM athletes a
    JOIN teams t ON t.id = a."teamId"
    LEFT JOIN LATERAL (
      SELECT ps.*
      FROM performance_scores ps
      WHERE ps."athleteId" = a.id
      ORDER BY ps.timestamp DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::bigint AS cnt,
             (array_agg(i.priority::text ORDER BY
                CASE i.priority WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 1 ELSE 0 END
                DESC))[1] AS sev
      FROM interventions i
      WHERE i."athleteId" = a.id AND i.status IN ('OPEN','ASSIGNED','UNDER_REVIEW','FOLLOW_UP_REQUIRED')
    ) exc ON true
    ${teamFilter}
    ORDER BY
      CASE exc.sev WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 1 ELSE 0 END DESC NULLS LAST,
      s.score ASC NULLS LAST,
      a."lastName" ASC
  `;

  const SEV_RANK: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  return rows.map((r) => ({
    athleteId: r.athleteId,
    externalId: r.externalId,
    displayName: `${r.lastName}, ${r.firstName.charAt(0)}.`,
    position: r.position,
    positionGroup: r.position,
    teamId: r.teamId,
    teamName: r.teamName,
    score: r.score,
    band: r.band,
    confidence: r.confidence === null ? null : Math.round(r.confidence * 100),
    validity: r.validity,
    withheldCode: r.validityReason,
    timestamp: r.timestamp ? r.timestamp.toISOString() : null,
    openExceptions: Number(r.openExceptions),
    maxSeverity: r.maxSeverity && SEV_RANK[r.maxSeverity] !== undefined ? r.maxSeverity : null,
  }));
}

export async function getTeamOverview(teamId?: string): Promise<TeamOverview> {
  return withFallback(() => queryTeamOverview(teamId), () => SAMPLE_OVERVIEW());
}

async function queryTeamOverview(teamId?: string): Promise<TeamOverview> {
  const roster = await getRosterRows(teamId);
  const counts = { ready: 0, monitor: 0, compromised: 0, withheld: 0 };
  for (const r of roster) {
    if (r.band === "READY") counts.ready += 1;
    else if (r.band === "MONITOR") counts.monitor += 1;
    else if (r.band === "COMPROMISED") counts.compromised += 1;
    else counts.withheld += 1;
  }

  const byPosition = new Map<string, RosterRow[]>();
  for (const r of roster) {
    const list = byPosition.get(r.position) ?? [];
    list.push(r);
    byPosition.set(r.position, list);
  }
  const positionSummaries = [...byPosition.entries()]
    .map(([position, rows]) => ({
      position,
      avgScore: rows.some((r) => r.score !== null)
        ? Math.round(
            (rows.filter((r) => r.score !== null).reduce((a, r) => a + (r.score as number), 0) /
              rows.filter((r) => r.score !== null).length) * 10,
          ) / 10
        : null,
      ready: rows.filter((r) => r.band === "READY").length,
      total: rows.length,
    }))
    .sort((a, b) => b.total - a.total);

  const recentSessionsRaw = await prisma.trainingSession.findMany({
    where: teamId ? { athlete: { teamId } } : undefined,
    orderBy: { date: "desc" },
    take: 12,
    include: {
      athlete: { select: { firstName: true, lastName: true } },
      footballContexts: { select: { venue: true, temperature: true, airQualityIndex: true }, take: 1 },
    },
  });

  const recentBaselineChangesRaw = await prisma.athleteBaseline.findMany({
    where: teamId ? { athlete: { teamId } } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
      baselineObservations: { select: { observationType: true, metadata: true }, take: 1 },
    },
  });

  return {
    roster,
    counts,
    openExceptions: roster.reduce((a, r) => a + r.openExceptions, 0),
    criticalHighExceptions: roster.filter((r) => r.maxSeverity === "CRITICAL" || r.maxSeverity === "HIGH").length,
    positionSummaries,
    recentSessions: recentSessionsRaw.map((s) => ({
      id: s.id,
      athleteName: `${s.athlete.lastName}, ${s.athlete.firstName.charAt(0)}.`,
      sessionType: s.sessionType,
      date: s.date.toISOString(),
      durationMinutes: s.durationMinutes,
      intensity: s.intensity,
      venue: s.footballContexts[0]?.venue ?? null,
      temperature: s.footballContexts[0]?.temperature ?? null,
      airQualityIndex: s.footballContexts[0]?.airQualityIndex ?? null,
    })),
    recentBaselineChanges: recentBaselineChangesRaw.map((b) => ({
      athleteId: b.athlete.id,
      athleteName: `${b.athlete.lastName}, ${b.athlete.firstName.charAt(0)}.`,
      metric: b.baselineObservations[0]?.observationType ?? "—",
      note: b.notes ?? "",
      updatedAt: b.updatedAt.toISOString(),
    })),
  };
}
