import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, Sparkline, Tag } from "@/components/ui/primitives";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Recovery Command — recovery observation history, baseline comparisons,
 * retest queue and follow-up status. Missing observations stay missing.
 */
export default async function RecoveryCommandPage() {
  type Row = {
    athleteId: string;
    name: string;
    hrv: (number | null)[];
    rhr: (number | null)[];
    sleep: (number | null)[];
    retests: number;
  };
  let rows: Row[] = [];
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
        const days = await prisma.$queryRaw<{ day: Date; type: string; value: number; valid: string }[]>`
          SELECT date_trunc('day', timestamp) AS day, type, value, "isValid"::text AS valid
          FROM observations
          WHERE "athleteId" = ${a.id} AND type IN ('HRV_MS','RHR','SLEEP_H') AND timestamp >= now() - interval '14 days'
          ORDER BY timestamp ASC
        `;
        const byType = (t: string) => {
          const perDay = new Map<string, { v: number | null; valid: boolean }>();
          for (const d of days) {
            if (d.type !== t) continue;
            const key = d.day.toISOString().slice(0, 10);
            if (!perDay.has(key)) perDay.set(key, { v: d.valid === "true" ? d.value : null, valid: d.valid === "true" });
          }
          return [...perDay.values()].map((x) => x.v);
        };
        const retests = await prisma.intervention.count({
          where: { athleteId: a.id, exceptionKey: { contains: "RETEST" }, status: { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW", "FOLLOW_UP_REQUIRED"] } },
        });
        return {
          athleteId: a.id,
          name: `${a.lastName}, ${a.firstName.charAt(0)}.`,
          hrv: byType("HRV_MS"),
          rhr: byType("RHR"),
          sleep: byType("SLEEP_H"),
          retests,
        };
      }),
    );
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/recovery-command" title="Recovery Command">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  rows = rows.sort((a, b) => b.retests - a.retests).slice(0, 20);

  return (
    <AppShell crumb="/recovery-command" title="Recovery Command">
      <p className="mb-4 text-sm text-muted">
        14-day HRV, resting heart rate and sleep trajectories per athlete. Gaps = missing/invalid data.
      </p>
      <Card ariaLabel="Recovery table">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="pb-2 pr-3">Athlete</th>
              <th className="pb-2 pr-3">HRV 14d</th>
              <th className="pb-2 pr-3">Resting HR 14d</th>
              <th className="pb-2 pr-3">Sleep 14d</th>
              <th className="pb-2 pr-3">Retest queue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.athleteId} className="border-b border-edge/50">
                <td className="py-2 pr-3">
                  <Link href={`/player/${r.athleteId}`} className="hover:text-accent">{r.name}</Link>
                </td>
                <td className="py-2 pr-3"><Sparkline points={r.hrv} /></td>
                <td className="py-2 pr-3"><Sparkline points={r.rhr} /></td>
                <td className="py-2 pr-3"><Sparkline points={r.sleep} /></td>
                <td className="py-2 pr-3">
                  {r.retests > 0 ? <Tag label="RETEST" /> : <span className="text-xs text-muted">None</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">
        Recovery observations support review workflows; they never auto-clear an athlete for play (spec §12).
      </p>
    </AppShell>
  );
}

