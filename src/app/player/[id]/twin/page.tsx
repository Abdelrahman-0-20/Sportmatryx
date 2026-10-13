import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, Sparkline } from "@/components/ui/primitives";
import { ScenarioCompare } from "@/components/app/scenario-compare";
import { requireAthleteAccess, errorToResponse, UnauthorizedError } from "@/lib/auth/rbac";
import { isGuest } from "@/lib/offline";
import { getAthleteDetail } from "@/lib/services/athlete";
import { weightsForPosition, COMPONENT_LABELS } from "@/lib/scoring/config";

export const dynamic = "force-dynamic";

/**
 * Digital Athlete Twin (PROTOTYPE) — longitudinal baseline view and
 * hypothetical scenario comparison. Never presented as a forecast.
 */
export default async function TwinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    if (!(await isGuest())) await requireAthleteAccess(id);
    detail = await getAthleteDetail(id);
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/player/twin" title="Digital Athlete Twin">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }
  if (!detail) {
    return (
      <AppShell crumb="/player/twin" title="Digital Athlete Twin">
        <p className="text-sm text-muted">Athlete not found.</p>
      </AppShell>
    );
  }

  const weights = weightsForPosition(detail.athlete.position);
  const weightText = Object.entries(weights)
    .map(([k, v]) => `${COMPONENT_LABELS[k as keyof typeof COMPONENT_LABELS].split(" ")[0].toLowerCase()} ${v}`)
    .join(", ");

  return (
    <AppShell crumb={`/player/${detail.athlete.externalId ?? detail.athlete.id}/twin`} title={`${detail.athlete.externalId ?? ""} · Digital Athlete Twin`.trim()}>
      <div className="mb-3 flex items-center gap-3">
        <Tag label="PROTOTYPE" />
        <Link href={`/player/${detail.athlete.id}`} className="text-sm text-accent hover:underline">← Player 360</Link>
      </div>
      <p className="mb-4 text-sm text-muted">
        Longitudinal baseline and hypothetical scenario-comparison workspace. Weights applied: {weightText}.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Baseline band chart (p10–p90 per component via sparkline-style ranges) */}
          <Card ariaLabel="Baseline bands">
            <CardLabel>Baseline bands · p10–p90 per metric (own history)</CardLabel>
            {detail.baseline && detail.baseline.observations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {detail.baseline.observations.map((o) => {
                  const lo = Math.min(o.p10, o.p50, o.p90);
                  const hi = Math.max(o.p10, o.p50, o.p90);
                  const span = Math.max(hi - lo, 1e-6);
                  const p10pct = ((o.p10 - lo) / span) * 100;
                  const p50pct = ((o.p50 - lo) / span) * 100;
                  return (
                    <div key={o.metric} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-muted">{o.metric}</span>
                      <div className="relative h-4 flex-1 rounded bg-edge/60">
                        <div
                          className="absolute inset-y-0 rounded bg-accent/25"
                          style={{ left: `${p10pct}%`, right: 0 }}
                        />
                        <div
                          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent"
                          style={{ left: `calc(${p50pct}% - 4px)` }}
                        />
                      </div>
                      <span className="tabular w-24 shrink-0 text-right text-xs text-muted">
                        {o.p10.toFixed(1)}–{o.p90.toFixed(1)} (n={o.n})
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">
                No established baseline — insufficient observations. Bands require ≥8 valid
                observations in the 28-day window.
              </p>
            )}
          </Card>

          {/* Trajectory strip */}
          <Card ariaLabel="Trajectory">
            <CardLabel>Trajectory strip · past trend, NOT a forecast</CardLabel>
            <Sparkline points={detail.trend} width={520} height={80} />
            <p className="mt-2 text-xs text-muted">
              14-day index values. Withheld days appear as empty gaps — no dots, no line, no zeros.
            </p>
          </Card>
        </div>

        <Card ariaLabel="Scenario compare">
          <CardLabel>Scenario compare</CardLabel>
          <ScenarioCompare athleteId={detail.athlete.id} />
        </Card>
      </div>
    </AppShell>
  );
}
