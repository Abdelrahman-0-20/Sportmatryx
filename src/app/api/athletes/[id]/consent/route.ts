import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability, errorToResponse } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/services/audit";

const BodySchema = z.object({
  status: z.enum(["GRANTED", "RESTRICTED", "REVOKED"]),
  reason: z.string().min(3).max(1000),
});

/**
 * POST /api/athletes/[id]/consent — append-only consent change.
 * Creates a ConsentRecord + hash-chained AuditLog entry. Consent write is
 * restricted to ADMIN / MEDICAL / EXECUTIVE (spec §17 matrix).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: "A change reason (3–1000 chars) and a valid status are required.", code: "VALIDATION" },
        { status: 400 },
      );
    }
    const user = await requireCapability("consent.write");

    const athlete = await prisma.athlete.findUnique({ where: { id }, select: { id: true, teamId: true } });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    // Team-scoped consent changes.
    const membership = user.memberships.find((m) => m.teamId === athlete.teamId);
    if (user.role !== "ADMIN" && !membership) {
      return NextResponse.json({ error: "You are not a member of this athlete's team.", code: "FORBIDDEN" }, { status: 403 });
    }

    const record = await prisma.consentRecord.create({
      data: {
        athleteId: athlete.id,
        consentType: "Data Sharing",
        status: body.data.status,
        grantedAt: body.data.status === "GRANTED" ? new Date() : undefined,
        revokedAt: body.data.status === "REVOKED" ? new Date() : null,
        grantedBy: user.id,
        reason: body.data.reason,
      },
      select: { id: true },
    });

    await audit({
      userId: user.id,
      action: `CONSENT_${body.data.status}`,
      entityType: "Athlete",
      entityId: athlete.id,
      newValue: { consentRecordId: record.id, status: body.data.status, reason: body.data.reason },
    });

    return NextResponse.json({ ok: true, consentId: record.id, status: body.data.status });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
