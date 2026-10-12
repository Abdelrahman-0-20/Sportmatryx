import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, WithheldStamp } from "@/components/ui/primitives";
import { ImportPanel } from "@/components/app/import-panel";
import { requireCapability, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { nowMs, daysAgoIso } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Data Quality & Validity — quality views (spec §14): missingness, invalid
 * samples, calibration issues, import failures, withheld scores.
 */
export default async function DataQualityPage() {
  let stats, invalidSamples, staleDevices, importJobs, withheld, staleObs;
  try {
    await requireCapability("roster.read");
    const since = new Date(daysAgoIso(14));
    [invalidSamples, staleDevices, importJobs, withheld, staleObs] = await Promise.all([
      prisma.observation.count({ where: { isValid: false, timestamp: { gte: since } } }),
      prisma.device.findMany({
        include: { calibrationRecords: { orderBy: { calibrationDate: "desc" }, take: 1 } },
        take: 12,
      }),
      prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.performanceScore.findMany({
        where: { validityStatus: { in: ["WITHHELD", "RETEST", "INSUFFICIENT_BASELINE"] }, timestamp: { gte: new Date(daysAgoIso(7)) } },
        orderBy: { timestamp: "desc" },
        take: 12,
        include: { athlete: { select: { id: true, firstName: true, lastName: true, externalId: true } } },
      }),
      prisma.$queryRaw<{ metric: string; stale_hours: number }[]>`
        SELECT type AS metric, round(extract(epoch FROM (now() - max(timestamp))) / 3600)::int AS stale_hours
        FROM observations
        GROUP BY type
        ORDER BY stale_hours DESC
        LIMIT 8
      `,
    ]);
    stats = {
      invalidSamples,
      totalObs: await prisma.observation.count(),
    };
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/data-quality" title="Data Quality & Validity">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  return (
    <AppShell crumb="/data-quality" title="Data Quality & Validity">
      <div className="stagger mb-4 grid gap-4 md:grid-cols-4">
        <Card>
          <div className="hero-number text-4xl">{stats.totalObs}</div>
          <CardLabel>Total observations</CardLabel>
        </Card>
        <Card>
          <div className={`hero-number text-4xl ${stats.invalidSamples > 0 ? "text-monitor" : "text-ready"}`}>{stats.invalidSamples}</div>
          <CardLabel>Invalid samples (14d)</CardLabel>
        </Card>
        <Card>
          <div className="hero-number text-4xl text-withheld">{withheld?.length ?? 0}</div>
          <CardLabel>Withheld scores (7d)</CardLabel>
        </Card>
        <Card>
          <div className={`hero-number text-4xl ${staleDevices.filter((d) => d.calibrationRecords[0]?.status !== "OK").length > 0 ? "text-monitor" : "text-ready"}`}>
            {staleDevices.filter((d) => d.calibrationRecords[0]?.status !== "OK").length}
          </div>
          <CardLabel>Devices with calibration issues</CardLabel>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card ariaLabel="CSV import">
          <CardLabel>CSV import (validated)</CardLabel>
          <ImportPanel />
        </Card>

        <Card ariaLabel="Import jobs">
          <CardLabel>Import jobs</CardLabel>
          {importJobs.length === 0 ? (
            <p className="text-sm text-muted">No imports yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-1">File</th>
                  <th className="pb-1">Status</th>
                  <th className="pb-1">Rows</th>
                  <th className="pb-1">Errors</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.map((j) => (
                  <tr key={j.id} className="border-b border-edge/50">
                    <td className="py-1.5">{j.fileName ?? "—"}</td>
                    <td className="py-1.5"><Tag label={j.status} /></td>
                    <td className="tabular py-1.5 text-muted">{j.processedRows ?? 0}/{j.totalRows ?? 0}</td>
                    <td className="tabular py-1.5">{(j.errorRows ?? 0) > 0 ? <span className="text-monitor">{j.errorRows}</span> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card ariaLabel="Signal staleness">
          <CardLabel>Signal staleness by metric (hours since last valid sample)</CardLabel>
          {staleObs && staleObs.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {staleObs.map((s) => (
                <li key={s.metric} className="flex items-center justify-between">
                  <span>{s.metric}</span>
                  <span className={`tabular text-xs ${s.stale_hours > 36 ? "text-monitor" : "text-muted"}`}>{s.stale_hours}h</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No observations.</p>
          )}
        </Card>

        <Card ariaLabel="Calibration issues">
          <CardLabel>Device calibration</CardLabel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1">Device</th>
                <th className="pb-1">Calibrated</th>
                <th className="pb-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {staleDevices.map((d) => {
                const cal = d.calibrationRecords[0];
                const status = cal?.status ?? "Unknown";
                const ageH = cal ? Math.round((nowMs() - cal.calibrationDate.getTime()) / 3600000) : null;
                return (
                  <tr key={d.id} className="border-b border-edge/50">
                    <td className="py-1.5">{d.serialNumber} · {d.model}</td>
                    <td className="tabular py-1.5 text-muted">{ageH !== null ? `${ageH}h ago` : "—"}</td>
                    <td className="py-1.5">
                      {status === "OK" ? <Tag label="VALID" /> : <Tag label="HIGH" />}
                      <span className="ml-2 text-xs text-muted">{status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-4" ariaLabel="Withheld scores">
        <CardLabel>Withheld scores (last 7 days)</CardLabel>
        {(withheld ?? []).length === 0 ? (
          <p className="text-sm text-muted">No withheld scores in the last week.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1">Athlete</th>
                <th className="pb-1">Code</th>
                <th className="pb-1">Date</th>
                <th className="pb-1">Guidance</th>
              </tr>
            </thead>
            <tbody>
              {(withheld ?? []).map((s) => (
                <tr key={s.id} className="border-b border-edge/50">
                  <td className="py-1.5">
                    <Link href={`/player/${s.athlete.id}`} className="hover:text-accent">
                      {s.athlete.lastName}, {s.athlete.firstName.charAt(0)}.
                    </Link>
                  </td>
                  <td className="py-1.5"><WithheldStamp code={s.validityReason} /></td>
                  <td className="tabular py-1.5 text-muted">{new Date(s.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="py-1.5 text-xs text-muted">
                    {s.validityReason === "MULTI_FAIL"
                      ? "Request validation retest with verified device."
                      : s.validityReason === "CALIBRATION_FRESHNESS"
                        ? "Recalibrate device before next capture."
                        : s.validityReason === "CONSENT_STATE"
                          ? "Confirm consent state with governance."
                          : "Retest required."}
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
