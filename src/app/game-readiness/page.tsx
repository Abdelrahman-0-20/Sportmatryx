import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import {Card,  CardLabel, Tag, WithheldStamp, ConfidenceRing } from "@/components/ui/primitives";
import {errorToResponse,  UnauthorizedError } from "@/lib/auth/rbac";
import { requireReadForGuest } from "@/lib/offline";
import { getRosterRows } from "@/lib/services/dashboard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Game Readiness — per-athlete readiness for the most recent/next game day,
 * with validity status and confidence on every number.
 */
export default async function GameReadinessPage() {
  let roster;
  let latestGame: { date: Date; opponent: string | null; athleteName: string | null } | null = null;
  try {
    const user = await requireReadForGuest("score.read");
    roster = await getRosterRows(user.memberships[0]?.teamId);
    const game = await prisma.trainingSession.findFirst({
      where: { sessionType: "GAME", athlete: { teamId: user.memberships[0]?.teamId } },
      orderBy: { date: "desc" },
      include: { athlete: { select: { firstName: true, lastName: true } }, footballContexts: { select: { opponent: true }, take: 1 } },
    });
    if (game) {
      latestGame = {
        date: game.date,
        opponent: game.footballContexts[0]?.opponent ?? null,
        athleteName: `${game.athlete.firstName} ${game.athlete.lastName}`,
      };
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/game-readiness" title="Game Readiness">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  const bands = { READY: 0, MONITOR: 0, COMPROMISED: 0, WITHHELD: 0 } as Record<string, number>;
  for (const r of roster) bands[r.band ?? "WITHHELD"] = (bands[r.band ?? "WITHHELD"] ?? 0) + 1;

  return (
    <AppShell crumb="/game-readiness" title="Game Readiness">
      <p className="mb-4 text-sm text-muted">
        Readiness snapshot for game-day decisions. Most recent game:{" "}
        {latestGame
          ? `${latestGame.opponent ?? "opponent n/a"} · ${latestGame.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "no games recorded"}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Object.entries(bands).map(([band, n]) => (
          <Card key={band}>
            <div className={`hero-number text-4xl ${band === "READY" ? "text-ready" : band === "MONITOR" ? "text-monitor" : band === "COMPROMISED" ? "text-compromised" : "text-withheld"}`}>{n}</div>
            <CardLabel>{band.charAt(0) + band.slice(1).toLowerCase()}</CardLabel>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto" ariaLabel="Game readiness by athlete">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="pb-2 pr-3">Athlete</th>
              <th className="pb-2 pr-3">Index</th>
              <th className="pb-2 pr-3">Band</th>
              <th className="pb-2 pr-3">Validity</th>
              <th className="pb-2 pr-3">Confidence</th>
              <th className="pb-2 pr-3">Decision note</th>
            </tr>
          </thead>
          <tbody>
            {roster.slice(0, 25).map((r) => (
              <tr key={r.athleteId} className="border-b border-edge/50">
                <td className="py-2 pr-3">
                  <Link href={`/player/${r.athleteId}`} className="hover:text-accent">{r.displayName}</Link>
                </td>
                <td className="hero-number py-2 pr-3">{r.score === null ? "—" : r.score.toFixed(1)}</td>
                <td className="py-2 pr-3">{r.band === "WITHHELD" ? <WithheldStamp code={r.withheldCode} /> : r.band ? <Tag label={r.band} /> : "—"}</td>
                <td className="py-2 pr-3 text-xs text-muted">{r.validity.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">{r.confidence === null ? "—" : <ConfidenceRing value={r.confidence} />}</td>
                <td className="py-2 pr-3 text-xs text-muted">
                  {r.band === "READY"
                    ? "Available for selection (staff review)."
                    : r.band === "MONITOR"
                      ? "Review before selection."
                      : r.band === "COMPROMISED"
                        ? "Human review required."
                        : `Withheld: ${r.withheldCode ?? "validity gate"}.`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">
        Decision support only — no automated lineup, clearance, or medical decisions (spec §13).
      </p>
    </AppShell>
  );
}
