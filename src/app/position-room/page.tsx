import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import {Card,  CardLabel, Tag, Sparkline, ConfidenceRing, WithheldStamp } from "@/components/ui/primitives";
import {errorToResponse,  UnauthorizedError } from "@/lib/auth/rbac";
import { requireReadForGuest } from "@/lib/offline";
import {getRosterRows,  type RosterRow } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

const GROUPS = ["QB", "SKILL", "TRENCH", "LB_TE", "ST"] as const;
const GROUP_NOTES: Record<string, string> = {
  QB: "SMX-QB — quarterback workload and recovery emphasis (PROTOTYPE weights).",
  SKILL: "SMX-SKILL — wide receivers, running backs, defensive backs (movement emphasis).",
  TRENCH: "SMX-TRENCH — offensive and defensive line (workload emphasis).",
  LB_TE: "SMX-LB/TE — linebacker, tight end and hybrid roles.",
  ST: "SMX-ST — kicking, punting and return units.",
};

export default async function PositionRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const group = (params.group ?? "QB").toUpperCase();

  let rows: RosterRow[];
  try {
    const user = await requireReadForGuest("roster.read");
    rows = await getRosterRows(user.memberships[0]?.teamId);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/position-room" title="Position Room">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  const groupRows = rows.filter((r) => r.position === group);
  const valid = groupRows.filter((r) => r.score !== null);
  const avg = valid.length
    ? Math.round((valid.reduce((a, r) => a + (r.score as number), 0) / valid.length) * 10) / 10
    : null;

  return (
    <AppShell crumb="/position-room" title="Position Room">
      <div className="mb-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <Link
            key={g}
            href={`/position-room?group=${g}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              group === g ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-ink"
            }`}
          >
            {g}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-sm text-muted">{GROUP_NOTES[group] ?? "Mixed group."}</p>

      <Card className="mb-4" ariaLabel="Position summary">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="hero-number text-4xl">{avg !== null ? avg : "—"}</div>
            <CardLabel>Average index</CardLabel>
          </div>
          <div>
            <div className="hero-number text-4xl">{groupRows.filter((r) => r.band === "READY").length}</div>
            <CardLabel>Ready</CardLabel>
          </div>
          <div>
            <div className="hero-number text-4xl">{groupRows.filter((r) => r.band === "WITHHELD").length}</div>
            <CardLabel>Withheld</CardLabel>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto" ariaLabel="Position roster">
        {groupRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
            No athletes in this position group.
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 pr-3">Athlete</th>
                <th className="pb-2 pr-3">Index</th>
                <th className="pb-2 pr-3">Band</th>
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2 pr-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((r) => (
                <tr key={r.athleteId} className="border-b border-edge/50">
                  <td className="py-2 pr-3">
                    <Link href={`/player/${r.athleteId}`} className="hover:text-accent">{r.displayName}</Link>
                  </td>
                  <td className="hero-number py-2 pr-3 text-lg">{r.score === null ? "—" : r.score.toFixed(1)}</td>
                  <td className="py-2 pr-3">{r.band === "WITHHELD" ? <WithheldStamp code={r.withheldCode} /> : r.band ? <Tag label={r.band} /> : "—"}</td>
                  <td className="py-2 pr-3">{r.confidence === null ? "—" : <ConfidenceRing value={r.confidence} />}</td>
                  <td className="py-2 pr-3"><Sparkline points={[r.score]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Comparisons respect role differences. Cross-position ranking is not displayed without an
        explicit, defensible method (spec §10).
      </p>
    </AppShell>
  );
}
