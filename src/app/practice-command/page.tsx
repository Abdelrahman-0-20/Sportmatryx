import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, Tag } from "@/components/ui/primitives";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Practice Command — session workload view: recent practices, load summaries,
 * and workload-response comparisons vs individual baselines.
 */
export default async function PracticeCommandPage() {
  let rows;
  try {
    const user = await requireCapability("score.read");
    const teamId = user.memberships[0]?.teamId;
    rows = await prisma.trainingSession.findMany({
      where: { sessionType: { in: ["PRACTICE", "TESTING"] }, ...(teamId ? { athlete: { teamId } } : {}) },
      orderBy: { date: "desc" },
      take: 40,
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, position: true } },
        footballContexts: { select: { drill: true, repetition: true, venue: true, isIndoor: true, temperature: true, humidity: true, airQualityIndex: true }, take: 1 },
      },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/practice-command" title="Practice Command">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  // Session-level load: max LOAD_AU observation on the session date.
  const loadByDate = new Map<string, number | null>();
  for (const s of rows) {
    const obs = await prisma.observation.findFirst({
      where: { athleteId: s.athleteId, type: "LOAD_AU", timestamp: { gte: s.date, lt: new Date(s.date.getTime() + 24 * 3600 * 1000) }, isValid: true },
      select: { value: true },
    });
    loadByDate.set(s.id, obs ? obs.value : null);
  }

  return (
    <AppShell crumb="/practice-command" title="Practice Command">
      <p className="mb-4 text-sm text-muted">
        External workload and drill context per session. Missing load is shown as missing — never zero.
      </p>
      <Card className="overflow-x-auto" ariaLabel="Practice sessions">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
            No practice sessions recorded.
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Athlete</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Drill</th>
                <th className="pb-2 pr-3">Duration</th>
                <th className="pb-2 pr-3">Load (AU)</th>
                <th className="pb-2 pr-3">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-b border-edge/50">
                  <td className="tabular py-2 pr-3 text-muted">{new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/player/${s.athleteId}`} className="hover:text-accent">
                      {s.athlete.lastName}, {s.athlete.firstName.charAt(0)}.
                    </Link>
                  </td>
                  <td className="py-2 pr-3"><Tag label={s.sessionType} /></td>
                  <td className="py-2 pr-3 text-muted">
                    {s.footballContexts[0]?.drill ?? "—"}
                    {s.footballContexts[0]?.repetition ? ` ×${s.footballContexts[0].repetition}` : ""}
                  </td>
                  <td className="tabular py-2 pr-3 text-muted">{s.durationMinutes ?? "—"} min</td>
                  <td className="tabular py-2 pr-3">{loadByDate.get(s.id) ?? <span className="text-muted">—</span>}</td>
                  <td className="py-2 pr-3 text-xs text-muted">
                    {s.footballContexts[0]?.isIndoor ? "Indoor" : "Outdoor"}
                    {s.footballContexts[0]?.temperature !== null && s.footballContexts[0]?.temperature !== undefined ? ` · ${s.footballContexts[0].temperature}°C` : ""}
                    {s.footballContexts[0]?.airQualityIndex ? ` · AQI ${s.footballContexts[0].airQualityIndex}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Acute:chronic workload ratios are a configurable research feature — not injury predictors (spec §12).
      </p>
    </AppShell>
  );
}

