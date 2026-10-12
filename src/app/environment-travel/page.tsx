import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Sparkline } from "@/components/ui/primitives";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { daysAgoIso } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Environment & Travel — sourced/synthetic exposure context: heat, AQI,
 * altitude, venue, travel legs and days-since-travel. No live external data.
 */
export default async function EnvironmentTravelPage() {
  type Row = {
    athleteId: string;
    name: string;
    heat: (number | null)[];
    aqi: (number | null)[];
    travelDays: number | null;
    lastTravel: string | null;
  };
  let rows: Row[] = [];
  let envSummary: { heatDays: number; highAqiDays: number; travelEvents: number } | null = null;
  try {
    const user = await requireCapability("score.read");
    const teamId = user.memberships[0]?.teamId;
    const athletes = await prisma.athlete.findMany({
      where: { isActive: true, ...(teamId ? { teamId } : {}) },
      select: { id: true, firstName: true, lastName: true },
      take: 60,
    });

    rows = await Promise.all(
      athletes.map(async (a) => {
        const env = await prisma.$queryRaw<{ day: Date; type: string; value: number; valid: boolean }[]>`
          SELECT date_trunc('day', timestamp) AS day, type, value, "isValid"
          FROM observations
          WHERE "athleteId" = ${a.id} AND type IN ('HEAT_C','AQI','TZ_SHIFT_H') AND timestamp >= now() - interval '14 days'
          ORDER BY timestamp ASC
        `;
        const byType = (t: string) => {
          const perDay = new Map<string, number | null>();
          for (const d of env) {
            if (d.type !== t) continue;
            perDay.set(d.day.toISOString().slice(0, 10), d.valid ? d.value : null);
          }
          return [...perDay.values()];
        };
        const travelCtx = await prisma.footballContext.findFirst({
          where: { athleteId: a.id, travelLeg: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { daysSinceTravel: true, createdAt: true },
        });
        return {
          athleteId: a.id,
          name: `${a.lastName}, ${a.firstName.charAt(0)}.`,
          heat: byType("HEAT_C"),
          aqi: byType("AQI"),
          travelDays: travelCtx?.daysSinceTravel ?? null,
          lastTravel: travelCtx?.createdAt.toISOString() ?? null,
        };
      }),
    );

    const heatObs = await prisma.observation.count({
      where: { type: "HEAT_C", value: { gte: 30 }, timestamp: { gte: new Date(daysAgoIso(14)) }, ...(teamId ? { athlete: { teamId } } : {}) },
    });
    const aqiObs = await prisma.observation.count({
      where: { type: "AQI", value: { gte: 100 }, timestamp: { gte: new Date(daysAgoIso(14)) }, ...(teamId ? { athlete: { teamId } } : {}) },
    });
    const travelCount = await prisma.footballContext.count({
      where: { travelLeg: { not: null }, createdAt: { gte: new Date(daysAgoIso(14)) }, ...(teamId ? { athlete: { teamId } } : {}) },
    });
    envSummary = { heatDays: heatObs, highAqiDays: aqiObs, travelEvents: travelCount };
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/environment-travel" title="Environment & Travel">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  rows = rows.sort((a, b) => (b.travelDays ?? 99) - (a.travelDays ?? 99)).slice(0, 20);

  return (
    <AppShell crumb="/environment-travel" title="Environment & Travel">
      {envSummary ? (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Card>
            <div className="hero-number text-4xl text-monitor">{envSummary.heatDays}</div>
            <CardLabel>Heat ≥30°C observations (14d)</CardLabel>
          </Card>
          <Card>
            <div className="hero-number text-4xl text-monitor">{envSummary.highAqiDays}</div>
            <CardLabel>AQI ≥100 observations (14d)</CardLabel>
          </Card>
          <Card>
            <div className="hero-number text-4xl">{envSummary.travelEvents}</div>
            <CardLabel>Travel events (14d)</CardLabel>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-x-auto" ariaLabel="Environment and travel by athlete">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="pb-2 pr-3">Athlete</th>
              <th className="pb-2 pr-3">Heat 14d</th>
              <th className="pb-2 pr-3">AQI 14d</th>
              <th className="pb-2 pr-3">Last travel</th>
              <th className="pb-2 pr-3">Days since travel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.athleteId} className="border-b border-edge/50">
                <td className="py-2 pr-3">
                  <Link href={`/player/${r.athleteId}`} className="hover:text-accent">{r.name}</Link>
                </td>
                <td className="py-2 pr-3"><Sparkline points={r.heat} /></td>
                <td className="py-2 pr-3"><Sparkline points={r.aqi} /></td>
                <td className="py-2 pr-3 text-muted">{r.lastTravel ? new Date(r.lastTravel).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                <td className="tabular py-2 pr-3">{r.travelDays ?? <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">
        Exposure context shows observed conditions with sourced/synthetic provenance — no unsupported
        causal effects are asserted (spec §15). External feeds are not live; adapters are future work.
      </p>
    </AppShell>
  );
}

