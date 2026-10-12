import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability, errorToResponse } from "@/lib/auth/rbac";
import { reviewIntervention, type InterventionAction } from "@/lib/services/interventions";

const BodySchema = z.object({ notes: z.string().max(2000).optional() });

const ACTIONS: InterventionAction[] = ["approve", "dismiss", "snooze", "restore"];

/**
 * POST /api/interventions/[id]/[action]
 * Approve records a human review ONLY — never messages, schedules, or acts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const { id, action } = await params;
    if (!ACTIONS.includes(action as InterventionAction)) {
      return NextResponse.json({ error: "Unknown action.", code: "VALIDATION" }, { status: 400 });
    }
    const body = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload.", code: "VALIDATION" }, { status: 400 });
    }
    const user = await requireCapability("intervention.review");
    const result = await reviewIntervention(id, action as InterventionAction, user, body.data.notes);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: result.status });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
