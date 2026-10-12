import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAthleteAccess, errorToResponse } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { weightsForPosition } from "@/lib/scoring/config";
import { clamp01 } from "@/lib/scoring/types";

const ScenarioSchema = z.object({
  athleteId: z.string().min(1),
  tzShiftHours: z.number().min(-12).max(12).default(0),
  heatIndexC: z.number().min(0).max(55).default(20),
  aqi: z.number().min(0).max(300).default(30),
  altitudeM: z.number().min(0).max(4000).default(100),
  sleepHours: z.number().min(0).max(12).default(8),
  practiceLoadPct: z.number().min(50).max(200).default(100),
});

/**
 * POST /api/twin/simulate — Digital Athlete Twin (PROTOTYPE).
 * Applies documented sensitivity curves to a copy of today's component
 * scores and recomputes the index through the same weighting. The response
 * always carries the disclaimer; nothing here is a forecast.
 */
export async function POST(request: Request) {
  try {
    const body = ScenarioSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid scenario payload.", code: "VALIDATION" }, { status: 400 });
    }
    const { athlete } = await requireAthleteAccess(body.data.athleteId);

    const latest = await prisma.performanceScore.findFirst({
      where: { athleteId: athlete.id, validityStatus: { in: ["VALID", "LIMITED"] } },
      orderBy: { timestamp: "desc" },
      include: { scoreComponents: true },
    });
    if (!latest) {
      return NextResponse.json({ error: "No valid score available to simulate from.", code: "NO_DATA" }, { status: 404 });
    }

    const weights = weightsForPosition(athlete.position);
    const byComponent = new Map(latest.scoreComponents.map((c) => [c.componentName, c.normalizedValue]));

    // Sensitivity application (monotonic, bounded curves per component).
    const line = (v: number, domain: readonly [number, number], effect: readonly [number, number]): number => {
      const [d0, d1] = domain;
      const [e0, e1] = effect;
      const t = (v - d0) / (d1 - d0);
      return e0 + (e1 - e0) * clamp01(t);
    };

    const applied = new Map<string, number>(byComponent);
    const tz = Math.abs(body.data.tzShiftHours);
    const heat = Math.max(0, body.data.heatIndexC - 25);
    const aqi = Math.max(0, body.data.aqi - 50);
    const alt = Math.max(0, body.data.altitudeM - 1500);
    const sleepDeficit = Math.max(0, 8 - body.data.sleepHours);
    const loadOver = Math.max(0, body.data.practiceLoadPct - 100);

    // Each stressor subtracts index points split across the components it plausibly touches.
    const environmentDelta = -(
      line(heat, [0, 15], [0, 4]) +
      line(aqi, [0, 100], [0, 2]) +
      line(alt, [0, 1500], [0, 3]) +
      line(tz, [0, 9], [0, 3])
    );
    const recoveryDelta = -(line(sleepDeficit, [0, 4], [0, 3]) + line(tz, [0, 9], [0, 2]));
    const workloadDelta = -line(loadOver, [0, 100], [0, 4]);

    const bend = (key: string, delta: number) => {
      const cur = applied.get(key);
      if (cur === undefined) return;
      applied.set(key, clamp01(cur + delta / 100));
    };
    bend("ENVIRONMENT_TRAVEL", environmentDelta);
    bend("RECOVERY_AUTONOMIC", recoveryDelta);
    bend("WORKLOAD_RESPONSE", workloadDelta);
    bend("BASELINE_DEVIATION", (recoveryDelta + workloadDelta) / 2);
    bend("MOVEMENT_EXPLOSIVE", workloadDelta / 2);
    bend("RESPIRATORY_EFFICIENCY", environmentDelta / 3);

    const baseIndex =
      latest.score ??
      [...applied.entries()].reduce((acc, [k, v]) => acc + v * (weights[k as keyof typeof weights] ?? 0), 0) * 100;
    const simulatedIndex =
      [...applied.entries()].reduce((acc, [k, v]) => acc + v * (weights[k as keyof typeof weights] ?? 0), 0) * 100;

    const componentDeltas = [...applied.entries()].map(([k, v]) => ({
      component: k,
      base: byComponent.get(k) ?? null,
      simulated: v,
      deltaIndexPoints: Math.round(((v - (byComponent.get(k) ?? 0)) * (weights[k as keyof typeof weights] ?? 0) * 100) * 10) / 10,
    }));

    return NextResponse.json({
      disclaimer: "Hypothetical exploration: not a forecast",
      modelVersion: latest.modelConfigurationVersionId,
      baseIndex: Math.round(baseIndex * 10) / 10,
      simulatedIndex: Math.round(simulatedIndex * 10) / 10,
      delta: Math.round((simulatedIndex - baseIndex) * 10) / 10,
      components: componentDeltas,
    });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
