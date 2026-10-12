import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag } from "@/components/ui/primitives";
import { ConsentPanel } from "@/components/app/consent-panel";
import { requireAthleteAccess, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Governance & Consent — per-athlete consent state, append-only change form,
 * and the athlete's audit trail (spec §17; governance reference design).
 */
export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let athleteRow, consentTrail, auditTrail, canWrite: boolean;
  try {
    const { user, athlete } = await requireAthleteAccess(id);
    [consentTrail, auditTrail] = await Promise.all([
      prisma.consentRecord.findMany({
        where: { athleteId: athlete.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.auditLog.findMany({
        where: { entityId: athlete.id },
        orderBy: { timestamp: "desc" },
        take: 10,
        include: { user: { select: { name: true, role: true } } },
      }),
    ]);
    canWrite = ["ADMIN", "MEDICAL", "EXECUTIVE"].includes(user.role) &&
      (user.role === "ADMIN" || user.memberships.some((m) => m.teamId === athlete.teamId));
    athleteRow = athlete;
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/athlete/consent" title="Governance & Consent">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  const current = consentTrail[0]?.status ?? "UNKNOWN";

  return (
    <AppShell crumb={`/athlete/${athleteRow.externalId ?? athleteRow.id}/consent`} title="Governance & Consent">
      <p className="mb-4 text-sm text-muted">
        {athleteRow.firstName} {athleteRow.lastName} · {athleteRow.position} · secure audit logging and consent state
        authorization. Only Medical, Executive and Admin roles can write consent changes.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card ariaLabel="Consent status">
            <CardLabel>Consent status</CardLabel>
            <ConsentPanel athleteId={athleteRow.id} current={current} canWrite={canWrite} />
          </Card>

          <Card ariaLabel="Governance callout">
            <CardLabel>Callout</CardLabel>
            <p className="text-sm text-muted">
              Revoked or restricted consent withholds the composite score with code CONSENT_STATE and
              excludes the athlete from research cohorts and exports. Consent records are append-only.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card ariaLabel="Consent history">
            <CardLabel>Consent history (append-only)</CardLabel>
            {consentTrail.length === 0 ? (
              <p className="text-sm text-muted">No consent records.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {consentTrail.map((c) => (
                  <li key={c.id} className="flex items-center justify-between border-b border-edge/50 pb-2 last:border-0">
                    <span><Tag label={c.status} /> <span className="ml-2 text-muted">{c.reason ?? ""}</span></span>
                    <span className="tabular text-xs text-muted">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card ariaLabel="Audit trail">
            <CardLabel>Audit trail for this athlete</CardLabel>
            {auditTrail.length === 0 ? (
              <p className="text-sm text-muted">No audit events.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {auditTrail.map((a) => (
                  <li key={a.id} className="border-b border-edge/50 pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="tabular text-xs text-muted">
                        {new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                        {new Date(a.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {a.user ? `${a.user.name ?? "?"} (${a.user.role})` : "system"}
                      {a.hash ? ` · hash chain ${a.hash.slice(0, 8)}…` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
