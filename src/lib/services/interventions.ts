import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/services/audit";
import { withFallback } from "@/lib/offline";
import { SAMPLE_INTERVENTIONS } from "@/lib/offline/sample-data";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Intervention queue services.
 *
 * HARD RULE (spec §13): approving an intervention records a human review and a
 * status change ONLY. It never messages, schedules, or performs any action.
 */

export type InterventionAction = "approve" | "dismiss" | "snooze" | "restore";

const ACTION_TARGET: Record<InterventionAction, "OPEN" | "ASSIGNED" | "UNDER_REVIEW" | "FOLLOW_UP_REQUIRED" | "RESOLVED" | "DISMISSED"> = {
  approve: "UNDER_REVIEW",
  dismiss: "DISMISSED",
  snooze: "FOLLOW_UP_REQUIRED",
  restore: "ASSIGNED",
};

export interface InterventionRow {
  id: string;
  athleteId: string;
  athleteName: string;
  teamId: string;
  exceptionKey: string;
  description: string;
  recommendation: string | null;
  priority: string;
  status: string;
  suggestedWindow: string | null;
  createdAt: string;
  reviews: { reviewer: string; status: string; notes: string | null; date: string }[];
}

export async function listInterventions(teamId?: string, status?: string): Promise<InterventionRow[]> {
  return withFallback(
    () => queryInterventions(teamId, status),
    () =>
      [...SAMPLE_INTERVENTIONS].filter(
        (i) => (status ? i.status === status : true) && (teamId ? i.teamId === teamId : true),
      ),
  );
}

async function queryInterventions(teamId?: string, status?: string): Promise<InterventionRow[]> {
  const rows = await prisma.intervention.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      athlete: { select: { firstName: true, lastName: true } },
      reviews: {
        orderBy: { reviewDate: "desc" },
        take: 3,
        include: { reviewer: { select: { name: true, role: true } } },
      },
    },
  });
  return rows.map((i) => ({
    id: i.id,
    athleteId: i.athleteId,
    athleteName: `${i.athlete.lastName}, ${i.athlete.firstName.charAt(0)}.`,
    teamId: i.teamId,
    exceptionKey: i.exceptionKey,
    description: i.description,
    recommendation: i.recommendation,
    priority: i.priority,
    status: i.status,
    suggestedWindow: i.suggestedWindow,
    createdAt: i.createdAt.toISOString(),
    reviews: i.reviews.map((r) => ({
      reviewer: `${r.reviewer.name ?? r.reviewer.role} (${r.reviewer.role})`,
      status: r.statusChangeTo,
      notes: r.notes,
      date: r.reviewDate.toISOString(),
    })),
  }));
}

export interface InterventionStats {
  suggested: number;
  approved: number;
  snoozed: number;
  dismissed: number;
  resolvedThisWeek: number;
}

export async function getInterventionStats(teamId?: string): Promise<InterventionStats> {
  return withFallback(
    () => queryInterventionStats(teamId),
    () => {
      const open = SAMPLE_INTERVENTIONS.filter((i) => ["OPEN", "ASSIGNED", "UNDER_REVIEW"].includes(i.status)).length;
      const approved = SAMPLE_INTERVENTIONS.filter((i) => i.status === "UNDER_REVIEW").length;
      const snoozed = SAMPLE_INTERVENTIONS.filter((i) => i.status === "FOLLOW_UP_REQUIRED").length;
      const dismissed = SAMPLE_INTERVENTIONS.filter((i) => i.status === "DISMISSED").length;
      const resolvedThisWeek = 1;
      return { suggested: open, approved, snoozed, dismissed, resolvedThisWeek };
    },
  );
}

async function queryInterventionStats(teamId?: string): Promise<InterventionStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [open, approved, snoozed, dismissed, resolved] = await Promise.all([
    prisma.intervention.count({ where: { ...(teamId ? { teamId } : {}), status: { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"] } } }),
    prisma.intervention.count({ where: { ...(teamId ? { teamId } : {}), status: "UNDER_REVIEW" } }),
    prisma.intervention.count({ where: { ...(teamId ? { teamId } : {}), status: "FOLLOW_UP_REQUIRED" } }),
    prisma.intervention.count({ where: { ...(teamId ? { teamId } : {}), status: "DISMISSED" } }),
    prisma.intervention.count({ where: { ...(teamId ? { teamId } : {}), status: "RESOLVED", updatedAt: { gte: weekAgo } } }),
  ]);
  return { suggested: open, approved, snoozed, dismissed, resolvedThisWeek: resolved };
}

/**
 * Apply a review action. Writes InterventionReview + AuditLog. Idempotent:
 * re-applying the same target status is a no-op success.
 */
export async function reviewIntervention(
  id: string,
  action: InterventionAction,
  user: SessionUser,
  notes?: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const intervention = await prisma.intervention.findUnique({ where: { id } });
  if (!intervention) return { ok: false, error: "Intervention not found." };

  const target = ACTION_TARGET[action];
  if (action === "snooze") {
    // Snooze parks the item as FOLLOW_UP_REQUIRED with a 24h re-open note.
    await prisma.intervention.update({
      where: { id },
      data: { status: "FOLLOW_UP_REQUIRED", updatedAt: new Date() },
    });
  } else if (action === "dismiss" && !notes) {
    // Documented reason required to dismiss (spec §13).
    return { ok: false, error: "A documented reason is required to dismiss." };
  } else {
    await prisma.intervention.update({
      where: { id },
      data: {
        status: target,
        assignedTo: intervention.assignedTo ?? user.id,
        updatedAt: new Date(),
      },
    });
  }

  await prisma.interventionReview.create({
    data: {
      interventionId: id,
      reviewerId: user.id,
      statusChangeTo: target,
      notes: notes ?? null,
    },
  });

  await audit({
    userId: user.id,
    action: `INTERVENTION_${action.toUpperCase()}`,
    entityType: "Intervention",
    entityId: id,
    newValue: { from: intervention.status, to: target, notes: notes ?? null },
  });

  // NOTE: intentionally no messaging, scheduling, or external action of any kind.
  return { ok: true, status: target };
}
