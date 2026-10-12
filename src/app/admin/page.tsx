import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag } from "@/components/ui/primitives";
import { VerifyChainButton } from "@/components/app/verify-chain";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Administration & Audit — audit trail (hash-chained), model configuration
 * versions, and user roster. ADMIN/MEDICAL/EXECUTIVE only (audit.read).
 */
export default async function AdminPage() {
  let audits, versions, users;
  try {
    await requireCapability("audit.read");
    [audits, versions, users] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 30,
        include: { user: { select: { name: true, role: true } } },
      }),
      prisma.modelConfigurationVersion.findMany({
        orderBy: { versionNumber: "desc" },
        include: { performanceModel: { select: { name: true } } },
      }),
      prisma.user.findMany({ select: { name: true, email: true, role: true }, take: 12 }),
    ]);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/admin" title="Administration & Audit">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell crumb="/admin" title="Administration & Audit">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card ariaLabel="Audit trail">
          <CardLabel>Tamper-evident audit trail</CardLabel>
          <VerifyChainButton />
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1">When</th>
                <th className="pb-1">Event</th>
                <th className="pb-1">Actor</th>
                <th className="pb-1">Chain</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} className="border-b border-edge/50">
                  <td className="tabular py-1.5 text-muted">
                    {a.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    {a.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-1.5">{a.action}</td>
                  <td className="py-1.5 text-muted">{a.user ? `${a.user.name ?? "?"} (${a.user.role})` : "system"}</td>
                  <td className="py-1.5 font-mono text-xs text-accent">{a.hash ? `${a.hash.slice(0, 8)}…` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card ariaLabel="Model configuration versions">
            <CardLabel>Model configuration versions</CardLabel>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-1">Model</th>
                  <th className="pb-1">Version</th>
                  <th className="pb-1">Active</th>
                  <th className="pb-1">Effective</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b border-edge/50">
                    <td className="py-1.5">{v.performanceModel.name}</td>
                    <td className="tabular py-1.5">v{v.versionNumber}</td>
                    <td className="py-1.5">{v.isActive ? <Tag label="VALID" /> : <span className="text-xs text-muted">archived</span>}</td>
                    <td className="tabular py-1.5 text-muted">{v.effectiveFrom.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card ariaLabel="Users">
            <CardLabel>Users (development-only demo accounts)</CardLabel>
            <ul className="flex flex-col gap-1.5 text-sm">
              {users.map((u) => (
                <li key={u.email ?? u.name ?? "?"} className="flex items-center justify-between border-b border-edge/50 pb-1.5 last:border-0">
                  <span>{u.name ?? u.email}</span>
                  <Tag label={u.role} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
