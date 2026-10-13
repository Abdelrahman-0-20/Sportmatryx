import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import {Card,  Tag, Sparkline, ConfidenceRing, WithheldStamp } from "@/components/ui/primitives";
import {Avatar,  AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/utils";
import {Tooltip,  TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {errorToResponse,  UnauthorizedError } from "@/lib/auth/rbac";
import { requireReadForGuest } from "@/lib/offline";
import {getRosterRows,  type RosterRow } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "READY", "MONITOR", "COMPROMISED", "WITHHELD", "EXCEPTIONS"] as const;

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; group?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "ALL").toUpperCase();
  const group = params.group ?? "ALL";

  let rows: RosterRow[];
  try {
    const user = await requireReadForGuest("roster.read");
    rows = await getRosterRows(user.memberships[0]?.teamId);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/roster" title="Roster">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  const filtered = rows.filter((r) => {
    const bandOk =
      view === "ALL" ||
      (view === "EXCEPTIONS" && r.openExceptions > 0) ||
      r.band === view;
    const groupOk = group === "ALL" || r.position === group;
    return bandOk && groupOk;
  });

  return (
    <AppShell crumb="/roster" title="Roster Mission Control">
      <p className="mb-4 text-sm text-muted">
        Sorted by exception severity, then lowest index. Click a row for Player 360.
      </p>

      {/* Filter bar */}
      <Card className="mb-4" ariaLabel="Roster filters">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/roster?view=${f}${group === "ALL" ? "" : `&group=${group}`}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                view === f ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-ink"
              }`}
            >
              {f === "ALL" ? "All athletes" : f === "EXCEPTIONS" ? "Exceptions only" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-edge" />
          {["ALL", "QB", "SKILL", "TRENCH", "LB_TE", "ST"].map((g) => (
            <Link
              key={g}
              href={`/roster?view=${view}${g === "ALL" ? "" : `&group=${g}`}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                group === g ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-ink"
              }`}
            >
              {g}
            </Link>
          ))}
        </div>
      </Card>

      {/* Roster grid */}
      <Card className="overflow-x-auto" ariaLabel="Roster grid">
        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
            No athletes match this filter.
          </p>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 pr-3">Athlete</th>
                <th className="pb-2 pr-3">ID</th>
                <th className="pb-2 pr-3">Position</th>
                <th className="pb-2 pr-3">Index</th>
                <th className="pb-2 pr-3">Band</th>
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2 pr-3">14-day trend</th>
                <th className="pb-2 pr-3">Exceptions</th>
              </tr>
            </thead>
            <tbody className="row-stagger">
              {filtered.map((r) => {
                const withheld = r.band === "WITHHELD";
                const border = r.maxSeverity === "CRITICAL" ? "border-l-2 border-l-critical" : r.maxSeverity === "HIGH" ? "border-l-2 border-l-monitor" : "";
                return (
                  <tr
                    key={r.athleteId}
                    className={`row-in border-b border-edge/50 transition-colors hover:bg-panel-2 ${border}`}
                  >
                    <td className="py-2.5 pr-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        <Avatar>
                          <AvatarFallback>{initialsOf(r.displayName)}</AvatarFallback>
                        </Avatar>
                        <Link href={`/player/${r.athleteId}`} className="text-ink hover:text-accent">
                          {r.displayName}
                        </Link>
                      </div>
                    </td>
                    <td className="tabular py-2.5 pr-3 text-muted">{r.externalId ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-muted">{r.position}</td>
                    <td className="hero-number py-2.5 pr-3 text-xl">
                      {withheld || r.score === null ? "—" : r.score.toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {withheld ? (
                        <WithheldStamp code={r.withheldCode} />
                      ) : r.band ? (
                        <Tag label={r.band} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.confidence === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <ConfidenceRing value={r.confidence} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Confidence {r.confidence}% — evidence-quality indicator, not a probability.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <SparklinePoints athleteId={r.athleteId} />
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.openExceptions > 0 ? (
                        <span className={`text-xs font-semibold ${r.maxSeverity === "CRITICAL" ? "text-critical" : "text-monitor"}`}>
                          {r.openExceptions} exception{r.openExceptions === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">No exceptions</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}

/** Sparkline computed server-side from the athlete's 14-day score trend. */
async function SparklinePoints({ athleteId }: { athleteId: string }) {
  const scores = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.performanceScore.findMany({
      where: { athleteId },
      orderBy: { timestamp: "desc" },
      take: 14,
      select: { score: true, validityStatus: true },
    }),
  );
  const points = scores.reverse().map((s) =>
    s.validityStatus === "VALID" || s.validityStatus === "LIMITED" ? s.score : null,
  );
  return <Sparkline points={points} />;
}
