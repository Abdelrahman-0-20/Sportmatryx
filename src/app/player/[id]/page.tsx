import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, Sparkline, ConfidenceRing, WithheldStamp } from "@/components/ui/primitives";
import { AnimatedNumber } from "@/components/ui/animated";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { requireAthleteAccess, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { isGuest } from "@/lib/offline";
import { getAthleteDetail } from "@/lib/services/athlete";

export const dynamic = "force-dynamic";

const COMPONENT_LABELS: Record<string, string> = {
  RESPIRATORY_EFFICIENCY: "Respiratory Efficiency",
  OXYGEN_FUNCTION: "Oxygen Function",
  RECOVERY_AUTONOMIC: "Recovery & Autonomic",
  WORKLOAD_RESPONSE: "Workload Response",
  MOVEMENT_EXPLOSIVE: "Movement / Explosive",
  ENVIRONMENT_TRAVEL: "Environment & Travel",
  BASELINE_DEVIATION: "Baseline Deviation",
};

export default async function Player360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    if (!(await isGuest())) await requireAthleteAccess(id);
    detail = await getAthleteDetail(id);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/player" title="Player 360">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }
  if (!detail) {
    return (
      <AppShell crumb="/player" title="Player 360">
        <p className="text-sm text-muted">Athlete not found.</p>
      </AppShell>
    );
  }

  const s = detail.latestScore;
  const withheld = s ? s.band === "WITHHELD" : true;

  return (
    <AppShell crumb={`/player/${detail.athlete.externalId ?? detail.athlete.id}`} title={`${detail.athlete.externalId ?? ""} · Player 360`.trim()}>
      <p className="mb-4 text-sm text-muted">
        {detail.athlete.displayName} · {detail.athlete.position} · {detail.athlete.teamName} ·{" "}
        {detail.athlete.rosterRole} · consent:{" "}
        <Tag label={detail.consent?.status ?? "UNKNOWN"} />
      </p>

      {/* Hero row */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card ariaLabel="Latest index">
          <CardLabel>Latest SMX Performance Index</CardLabel>
          {withheld ? (
            <div className="flex flex-col items-start gap-2">
              <WithheldStamp code={s?.withheldCode} />
              <span className="text-sm text-muted">No composite released — validity gate failed.</span>
            </div>
          ) : s ? (
            <>
              <div className="flex items-baseline gap-3">
                <AnimatedNumber value={s.score ?? 0} className="hero-number text-6xl" />
                <Tag label={s.band ?? ""} glow />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1">Confidence <ConfidenceRing value={s.confidence ?? 0} /></span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Confidence {s.confidence}% — an evidence-quality indicator, not a probability.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                ·{" "}
                {new Date(s.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <p className="mt-2 text-xs text-muted">{s.explanation}</p>
            </>
          ) : (
            <p className="text-sm text-muted">No scores yet.</p>
          )}
        </Card>

        <Card ariaLabel="Drivers">
          <CardLabel>Why — top drivers</CardLabel>
          {s && s.drivers.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {s.drivers.map((d) => (
                <li key={d.text} className={d.type === "POSITIVE" ? "text-positive" : "text-monitor"}>
                  {d.type === "POSITIVE" ? "+" : "−"} {d.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{withheld ? "Drivers unavailable while withheld." : "No drivers recorded."}</p>
          )}
        </Card>

        <Card ariaLabel="Exceptions and devices">
          <CardLabel>Exceptions & devices</CardLabel>
          {detail.interventions.length === 0 ? (
            <p className="text-sm text-muted">No interventions.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5 text-sm">
              {detail.interventions.slice(0, 3).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span>{i.exceptionKey}</span>
                  <Tag label={i.priority} />
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-1 text-xs text-muted">
            {detail.devices.map((d) => (
              <li key={d.serialNumber}>
                {d.serialNumber} · {d.model} · calibration <span className={d.calibrationStatus === "OK" ? "text-ready" : "text-monitor"}>{d.calibrationStatus}</span>
              </li>
            ))}
            {detail.devices.length === 0 ? <li>No device-linked observations.</li> : null}
          </ul>
        </Card>
      </div>

      {/* Components + checks */}
      {s && !withheld ? (
        <Card className="mb-4" ariaLabel="Component breakdown">
          <CardLabel>Component breakdown ({s.validity})</CardLabel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2">Component</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Weight</th>
                <th className="pb-2">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {s.components.map((c) => (
                <tr key={c.name} className="border-b border-edge/50">
                  <td className="py-2">{COMPONENT_LABELS[c.name] ?? c.name}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-edge">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(c.score ?? 0) * 100}%` }} />
                      </div>
                      <span className="tabular text-xs text-muted">{c.score !== null ? (c.score * 100).toFixed(0) : "—"}</span>
                    </div>
                  </td>
                  <td className="tabular py-2 text-muted">{(c.weight * 100).toFixed(0)}%</td>
                  <td className="tabular py-2">{c.contribution !== null ? c.contribution.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {/* Validity checks */}
      {s ? (
        <Card className="mb-4" ariaLabel="Validity checks">
          <CardLabel>Validity checks ({s.validity})</CardLabel>
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2">
                <span className={c.status === "PASSED" ? "text-ready" : c.status === "FAILED" ? "text-critical" : c.status === "WARNING" ? "text-monitor" : "text-muted"}>
                  {c.status === "PASSED" ? "✓" : c.status === "FAILED" ? "✕" : "!"}
                </span>
                <span className="font-medium">{c.name.replace(/_/g, " ")}</span>
                <span className="text-muted">{c.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 14-day trend */}
        <Card ariaLabel="14-day trend">
          <CardLabel>14-day trend (gaps = withheld days)</CardLabel>
          <Sparkline points={detail.trend} width={400} height={60} />
          <div className="mt-2 tabular text-xs text-muted">
            {detail.trend.map((p) => (p === null ? "—" : p.toFixed(0))).join(" · ")}
          </div>
        </Card>

        {/* Baseline comparison */}
        <Card ariaLabel="Individual baseline">
          <CardLabel>
            Individual baseline {detail.baseline ? `v${detail.baseline.version} (${detail.baseline.status.replace(/_/g, " ")})` : ""}
          </CardLabel>
          {detail.baseline && detail.baseline.observations.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-1">Metric</th>
                  <th className="pb-1">p10</th>
                  <th className="pb-1">p50</th>
                  <th className="pb-1">p90</th>
                  <th className="pb-1">n</th>
                </tr>
              </thead>
              <tbody>
                {detail.baseline.observations.map((o) => (
                  <tr key={o.metric} className="border-b border-edge/50">
                    <td className="py-1.5">{o.metric}</td>
                    <td className="tabular py-1.5 text-muted">{o.p10.toFixed(1)}</td>
                    <td className="tabular py-1.5">{o.p50.toFixed(1)}</td>
                    <td className="tabular py-1.5 text-muted">{o.p90.toFixed(1)}</td>
                    <td className="tabular py-1.5 text-muted">{o.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">No established baseline — insufficient observations.</p>
          )}
        </Card>
      </div>

      {/* Sessions */}
      <Card className="mt-4" ariaLabel="Recent sessions">
        <CardLabel>Recent sessions</CardLabel>
        {detail.sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1">Date</th>
                <th className="pb-1">Type</th>
                <th className="pb-1">Duration</th>
                <th className="pb-1">Context</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions.map((sess) => (
                <tr key={sess.id} className="border-b border-edge/50">
                  <td className="tabular py-1.5 text-muted">{new Date(sess.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="py-1.5"><Tag label={sess.type} /></td>
                  <td className="tabular py-1.5 text-muted">{sess.durationMinutes ?? "—"} min</td>
                  <td className="py-1.5 text-muted">
                    {sess.opponent ? `vs ${sess.opponent}` : sess.venue ?? "—"}
                    {sess.temperature !== null ? ` · ${sess.temperature}°C` : ""}
                    {sess.airQualityIndex !== null ? ` · AQI ${sess.airQualityIndex}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-4 flex gap-4">
        <Link href="/roster" className="text-sm text-accent hover:underline">← Back to roster</Link>
        <Link href={`/player/${detail.athlete.id}/twin`} className="text-sm text-accent hover:underline">Digital Athlete Twin (PROTOTYPE)</Link>
        <Link href={`/athlete/${detail.athlete.id}/consent`} className="text-sm text-accent hover:underline">Governance & Consent</Link>
      </div>
    </AppShell>
  );
}
