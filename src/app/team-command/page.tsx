import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, LinkButton } from "@/components/ui/primitives";
import { requireCapability, ForbiddenError } from "@/lib/auth/rbac";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { getTeamOverview } from "@/lib/services/dashboard";
import { prisma } from "@/lib/prisma";
import { errorToResponse } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-edge p-4 text-sm text-muted">{message}</p>;
}

export default async function TeamCommandPage() {
  let overview;
  let teamName: string | null = null;
  try {
    const user = await requireCapability("roster.read");
    const primaryTeamId = user.memberships[0]?.teamId ?? null;
    const team = primaryTeamId ? await prisma.team.findUnique({ where: { id: primaryTeamId } }) : null;
    teamName = team?.name ?? null;
    overview = await getTeamOverview(primaryTeamId ?? undefined);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    if (e instanceof ForbiddenError) {
      return (
        <AppShell crumb="/team-command" title="Team Command">
          <EmptyState message={`Access denied — your role does not include roster access. (${mapped.body.code})`} />
        </AppShell>
      );
    }
    throw e;
  }

  const { counts } = overview;

  return (
    <AppShell crumb="/team-command" title="Team Command">
      <p className="mb-4 text-sm text-muted">
        {teamName ?? "All teams"} · reporting period: last 14 days · {overview.roster.length} athletes on roster
      </p>

      {/* Summary strip */}
      <Card className="fade-up card-lift mb-4" ariaLabel="Readiness summary">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "Ready", value: counts.ready, color: "text-ready" },
            { label: "Monitor", value: counts.monitor, color: "text-monitor" },
            { label: "Compromised", value: counts.compromised, color: "text-compromised" },
            { label: "Withheld", value: counts.withheld, color: "text-withheld" },
            { label: "Active exceptions", value: overview.openExceptions, color: "text-ink" },
          ].map((s) => (
            <div key={s.label}>
              <div className={`hero-number text-4xl ${s.color}`}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="stagger mb-4 grid gap-4 lg:grid-cols-3">
        {/* Readiness distribution */}
        <Card ariaLabel="Readiness distribution" variant="elevated" className="card-lift">
          <CardLabel>Readiness distribution</CardLabel>
          <div className="flex h-3 overflow-hidden rounded-full border border-edge">
            <div className="bg-ready" style={{ width: `${pct(counts.ready, overview.roster.length)}%` }} />
            <div className="bg-monitor" style={{ width: `${pct(counts.monitor, overview.roster.length)}%` }} />
            <div className="bg-compromised" style={{ width: `${pct(counts.compromised, overview.roster.length)}%` }} />
            <div className="bg-withheld/40" style={{ width: `${pct(counts.withheld, overview.roster.length)}%` }} />
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-muted">
            <span><span className="text-ready">■</span> Ready</span>
            <span><span className="text-monitor">■</span> Monitor</span>
            <span><span className="text-compromised">■</span> Compromised</span>
            <span><span className="text-withheld">■</span> Withheld</span>
          </div>
          <LinkButton href="/roster" variant="ghost" className="mt-3">Open full roster →</LinkButton>
        </Card>

        {/* Position-group summaries */}
        <Card ariaLabel="Position group summaries" variant="elevated" className="card-lift">
          <CardLabel>Position groups</CardLabel>
          {overview.positionSummaries.length === 0 ? (
            <EmptyState message="No athletes yet." />
          ) : (
            <ul className="flex flex-col gap-2">
              {overview.positionSummaries.map((p) => (
                <li key={p.position} className="flex items-center justify-between text-sm">
                  <Link href={`/position-room?group=${p.position}`} className="text-accent hover:underline">
                    {p.position}
                  </Link>
                  <span className="tabular text-muted">
                    {p.avgScore !== null ? `avg ${p.avgScore}` : "—"} · {p.ready}/{p.total} ready
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Exceptions requiring human review */}
        <Card ariaLabel="Exceptions requiring review" variant="elevated" className="card-lift">
          <CardLabel>Requiring human review</CardLabel>
          {overview.criticalHighExceptions === 0 ? (
            <p className="text-sm text-muted">No critical or high-severity exceptions.</p>
          ) : (
            <p className="text-sm">
              <span className="hero-number text-3xl text-compromised">{overview.criticalHighExceptions}</span>
              <span className="ml-2 text-muted">critical/high athlete(s)</span>
            </p>
          )}
          <LinkButton href="/interventions" variant="ghost" className="mt-3">Open Intervention Queue →</LinkButton>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent sessions */}
        <Card ariaLabel="Recent sessions" variant="elevated">
          <CardLabel>Recent sessions</CardLabel>
          {overview.recentSessions.length === 0 ? (
            <EmptyState message="No sessions recorded yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-1">Athlete</th>
                  <th className="pb-1">Type</th>
                  <th className="pb-1">Date</th>
                  <th className="pb-1">Context</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentSessions.slice(0, 6).map((s) => (
                  <tr key={s.id} className="border-t border-edge/60">
                    <td className="py-1.5">{s.athleteName}</td>
                    <td><Tag label={s.sessionType} /></td>
                    <td className="tabular text-muted">{fmtDate(s.date)}</td>
                    <td className="text-muted">
                      {s.venue ?? "—"}
                      {s.temperature !== null ? ` · ${s.temperature}°C` : ""}
                      {s.airQualityIndex !== null ? ` · AQI ${s.airQualityIndex}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Baseline changes */}
        <Card ariaLabel="Recent baseline changes" variant="elevated">
          <CardLabel>Recent baseline activity</CardLabel>
          {overview.recentBaselineChanges.length === 0 ? (
            <EmptyState message="No baseline records yet." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {overview.recentBaselineChanges.map((b) => (
                <li key={b.athleteId + b.metric} className="flex items-center justify-between border-t border-edge/60 pt-2 first:border-0 first:pt-0">
                  <Link href={`/player/${b.athleteId}`} className="text-accent hover:underline">{b.athleteName}</Link>
                  <span className="text-muted">{b.metric} · {fmtDate(b.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
