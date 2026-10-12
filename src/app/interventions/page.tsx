import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel } from "@/components/ui/primitives";
import { Badge, statusVariant } from "@/components/ui/badge";
import { InterventionActions } from "@/components/app/intervention-actions";
import { requireCapability, can, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { listInterventions, getInterventionStats } from "@/lib/services/interventions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "SUGGESTED", label: "Suggested" },
  { key: "APPROVED", label: "Approved" },
  { key: "SNOOZED", label: "Snoozed" },
  { key: "DISMISSED", label: "Dismissed" },
] as const;

function tabStatuses(key: string): string[] | undefined {
  switch (key) {
    case "SUGGESTED": return ["OPEN", "ASSIGNED", "UNDER_REVIEW"];
    case "APPROVED": return ["UNDER_REVIEW", "RESOLVED"];
    case "SNOOZED": return ["FOLLOW_UP_REQUIRED"];
    case "DISMISSED": return ["DISMISSED"];
    default: return undefined;
  }
}

export default async function InterventionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = (params.tab ?? "ALL").toUpperCase();

  let rows, stats, teamId: string | undefined, canReview: boolean;
  try {
    const user = await requireCapability("intervention.read");
    teamId = user.memberships[0]?.teamId;
    [rows, stats] = await Promise.all([
      listInterventions(teamId, tabStatuses(tab)?.length === 1 ? tabStatuses(tab)?.[0] : undefined),
      getInterventionStats(teamId),
    ]);
    if (tab === "SUGGESTED") {
      rows = rows.filter((r) => r.status === "OPEN" || r.status === "ASSIGNED" || r.status === "UNDER_REVIEW");
    }
    canReview = can(user, "intervention.review", teamId ?? null);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/interventions" title="Intervention Queue">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell crumb="/interventions" title="Intervention Queue">
      <div className="mb-4 rounded-md border border-monitor/50 bg-monitor/10 p-3 text-sm text-monitor" role="note">
        Suggestions require human review. Approving records a review; it does not message, schedule
        or act. No action is taken automatically.
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card><div className="hero-number text-4xl">{stats.suggested}</div><CardLabel>Active suggestions</CardLabel></Card>
        <Card><div className="hero-number text-4xl">{stats.resolvedThisWeek}</div><CardLabel>Resolved this week</CardLabel></Card>
        <Card><div className="hero-number text-4xl">{stats.snoozed}</div><CardLabel>Snoozed / follow-up</CardLabel></Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/interventions?tab=${t.key}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              tab === t.key ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-x-auto" ariaLabel="Intervention queue">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
            No interventions in this view.
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 pr-3">Athlete</th>
                <th className="pb-2 pr-3">Exception</th>
                <th className="pb-2 pr-3">Recommended review</th>
                <th className="pb-2 pr-3">Priority</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Window</th>
                <th className="pb-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-edge/50 align-top">
                  <td className="py-2.5 pr-3 font-medium">
                    <Link href={`/player/${r.athleteId}`} className="hover:text-accent">{r.athleteName}</Link>
                  </td>
                  <td className="py-2.5 pr-3">{r.exceptionKey}</td>
                  <td className="py-2.5 pr-3 text-muted">{r.recommendation ?? r.description}</td>
                  <td className="py-2.5 pr-3"><Badge variant={statusVariant(r.priority)}>{r.priority.replace(/_/g, " ")}</Badge></td>
                  <td className="py-2.5 pr-3"><span className={r.status === "OPEN" ? "pulse-newest" : ""}><Badge variant={statusVariant(r.status)}>{r.status.replace(/_/g, " ")}</Badge></span></td>
                  <td className="py-2.5 pr-3 text-muted">{r.suggestedWindow ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <InterventionActions id={r.id} status={r.status} canReview={canReview} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
