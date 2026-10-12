import { prisma } from "@/lib/prisma";
import { errorToResponse, requireCapability } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { audit } from "@/lib/services/audit";
import { escapeCsv } from "@/lib/services/csv-util";

/**
 * Authorized CSV exports (spec §16): server-side queries only, team-scoped,
 * de-identification option for research use. Audit-logged.
 */

export interface ExportOptions {
  scope: "roster" | "athlete";
  athleteId?: string;
  deidentified: boolean;
  days: number;
}

export async function exportCsv(
  user: SessionUser,
  opts: ExportOptions,
): Promise<{ filename: string; csv: string } | { error: string; status: number }> {
  const teamId = user.memberships[0]?.teamId ?? null;
  if (opts.scope === "athlete" && !opts.athleteId) {
    return { error: "athleteId required for athlete scope.", status: 400 };
  }
  const since = new Date(Date.now() - opts.days * 24 * 3600 * 1000);

  const scores = await prisma.performanceScore.findMany({
    where:
      opts.scope === "athlete"
        ? { athleteId: opts.athleteId, timestamp: { gte: since } }
        : { athlete: { teamId: teamId ?? undefined }, timestamp: { gte: since } },
    orderBy: [{ athleteId: "asc" }, { timestamp: "desc" }],
    take: 5000,
    include: {
      athlete: { select: { externalId: true, firstName: true, lastName: true, position: true } },
      scoreComponents: { orderBy: { componentName: "asc" } },
    },
  });

  const header = opts.deidentified
    ? "subjectRef,position,date,index,band,validity,confidence,components"
    : "externalId,athlete,position,date,index,band,validity,confidence,components";

  const lines: string[] = [header];
  for (const s of scores) {
    const subjectRef = `S-${s.athlete.externalId ?? s.athleteId.slice(0, 8)}`;
    const who = opts.deidentified
      ? subjectRef
      : `${escapeCsv(s.athlete.firstName)} ${escapeCsv(s.athlete.lastName)}`;
    const ext = opts.deidentified ? subjectRef : (s.athlete.externalId ?? "—");
    const comps = s.scoreComponents
      .map((c) => `${c.componentName}:${c.normalizedValue !== null ? c.normalizedValue.toFixed(2) : ""}`)
      .join(" ");
    lines.push(
      [
        ext,
        who,
        s.athlete.position,
        s.timestamp.toISOString().slice(0, 10),
        s.score !== null ? s.score.toFixed(1) : "",
        s.scoreBand ?? "",
        s.validityStatus,
        s.confidence !== null ? Math.round(s.confidence * 100) : "",
        `"${comps}"`,
      ].join(","),
    );
  }

  await audit({
    userId: user.id,
    action: "EXPORT_RUN",
    entityType: "PerformanceScore",
    entityId: null,
    newValue: { scope: opts.scope, athleteId: opts.athleteId ?? null, deidentified: opts.deidentified, days: opts.days, rows: scores.length },
  });

  return {
    filename: `smx_export_${opts.scope}${opts.deidentified ? "_deidentified" : ""}_${new Date().toISOString().slice(0, 10)}.csv`,
    csv: lines.join("\n"),
  };
}

/** Route-handler wrapper: returns the CSV as a downloadable response. */
export async function handleExport(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "athlete" ? "athlete" : "roster";
    const deidentified = url.searchParams.get("deidentified") === "1";
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "28") || 28));
    const user = await requireCapability("export.run");
    const result = await exportCsv(user, { scope, athleteId: url.searchParams.get("id") ?? undefined, deidentified, days });
    if ("error" in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (e) {
    const mapped = errorToResponse(e);
    return new Response(JSON.stringify(mapped.body), {
      status: mapped.status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
