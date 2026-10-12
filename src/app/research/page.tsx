import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag } from "@/components/ui/primitives";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Research & Exports — authorized CSV exports (team/athlete scope, optional
 * de-identification) and persisted report history (spec §16).
 */
export default async function ResearchPage() {
  let reports, athletes;
  let canExport = false;
  try {
    const user = await requireCapability("score.read");
    const teamId = user.memberships[0]?.teamId;
    canExport = ["ADMIN", "PERFORMANCE", "MEDICAL", "EXECUTIVE"].includes(user.role);
    [reports, athletes] = await Promise.all([
      prisma.report.findMany({ orderBy: { generatedAt: "desc" }, take: 10 }),
      prisma.athlete.findMany({
        where: teamId ? { teamId } : undefined,
        select: { id: true, externalId: true, firstName: true, lastName: true },
        take: 12,
      }),
    ]);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/research" title="Research & Exports">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell crumb="/research" title="Research & Exports">
      <p className="mb-4 text-sm text-muted">
        Exports are produced from authorized server-side queries, respect team and role access, and
        are audit-logged. De-identified exports replace names with stable subject references.
      </p>

      <Card className="mb-4" ariaLabel="Export controls">
        <CardLabel>CSV exports</CardLabel>
        {canExport ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/api/export?scope=roster&days=28" className="rounded-md border border-edge px-3 py-2 font-semibold hover:bg-panel-2">
              Team roster — 28 days
            </a>
            <a href="/api/export?scope=roster&days=28&deidentified=1" className="rounded-md border border-edge px-3 py-2 font-semibold hover:bg-panel-2">
              Team roster — 28 days · de-identified
            </a>
            <a href="/api/export?scope=roster&days=14&deidentified=1" className="rounded-md border border-edge px-3 py-2 font-semibold hover:bg-panel-2">
              Research cohort — 14 days · de-identified
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Your role does not include export capability. Export requires ADMIN, PERFORMANCE, MEDICAL
            or EXECUTIVE roles.
          </p>
        )}
      </Card>

      <Card className="mb-4" ariaLabel="Athlete exports">
        <CardLabel>Per-athlete exports</CardLabel>
        {canExport ? (
          <div className="flex flex-wrap gap-2 text-sm">
            {athletes.map((a) => (
              <a
                key={a.id}
                href={`/api/export?scope=athlete&id=${a.id}&days=28`}
                className="rounded-md border border-edge px-2.5 py-1 text-xs font-semibold hover:bg-panel-2"
              >
                {a.externalId ?? a.lastName} ↓
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Not available for your role.</p>
        )}
      </Card>

      <Card ariaLabel="Report history">
        <CardLabel>Report history</CardLabel>
        {reports.length === 0 ? (
          <p className="text-sm text-muted">No reports generated yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1">Report</th>
                <th className="pb-1">Type</th>
                <th className="pb-1">Status</th>
                <th className="pb-1">Generated</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-edge/50">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5 text-muted">{r.reportType}</td>
                  <td className="py-1.5"><Tag label={r.status === "COMPLETED" ? "VALID" : r.status} /></td>
                  <td className="tabular py-1.5 text-muted">{new Date(r.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Research use of athlete data is governed by consent records — restricted or revoked consent
        excludes data from research cohorts.
      </p>
    </AppShell>
  );
}
