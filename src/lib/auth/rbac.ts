import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * Server-enforced RBAC (spec section 17).
 * Deny by default. Team-scoped: access checks resolve the athlete's team and
 * verify the actor holds a membership on that team. ATHLETE role users may
 * only access their own athlete record.
 */

export type Role = "ADMIN" | "PERFORMANCE" | "MEDICAL" | "COACH" | "EXECUTIVE" | "ATHLETE";

export type Capability =
  | "roster.read"
  | "athlete.read"
  | "athlete.write"
  | "score.read"
  | "score.recalculate"
  | "consent.read"
  | "consent.write"
  | "intervention.read"
  | "intervention.review"
  | "import.run"
  | "export.run"
  | "audit.read"
  | "admin.settings"
  | "self.read";

/** Capability → roles allowed. Enforced server-side for every API route. */
const CAPABILITY_ROLES: Record<Capability, Role[]> = {
  "roster.read": ["ADMIN", "PERFORMANCE", "MEDICAL", "COACH", "EXECUTIVE"],
  "athlete.read": ["ADMIN", "PERFORMANCE", "MEDICAL", "COACH", "EXECUTIVE"],
  "athlete.write": ["ADMIN", "PERFORMANCE"],
  "score.read": ["ADMIN", "PERFORMANCE", "MEDICAL", "COACH", "EXECUTIVE"],
  "score.recalculate": ["ADMIN", "PERFORMANCE"],
  "consent.read": ["ADMIN", "PERFORMANCE", "MEDICAL", "EXECUTIVE"],
  "consent.write": ["ADMIN", "MEDICAL", "EXECUTIVE"],
  "intervention.read": ["ADMIN", "PERFORMANCE", "MEDICAL", "COACH", "EXECUTIVE"],
  "intervention.review": ["ADMIN", "PERFORMANCE", "MEDICAL", "EXECUTIVE"],
  "import.run": ["ADMIN", "PERFORMANCE"],
  "export.run": ["ADMIN", "PERFORMANCE", "MEDICAL", "EXECUTIVE"],
  "audit.read": ["ADMIN", "MEDICAL", "EXECUTIVE"],
  "admin.settings": ["ADMIN"],
  "self.read": ["ATHLETE"],
};

export class ForbiddenError extends Error {
  readonly needed: Capability;
  constructor(capability: Capability, message?: string) {
    super(message ?? `Forbidden — requires capability: ${capability}`);
    this.name = "ForbiddenError";
    this.needed = capability;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "UnauthorizedError";
  }
}

function roleOf(user: SessionUser, teamId: string | null): Role | null {
  if (user.role === "ADMIN") return "ADMIN";
  if (teamId) {
    const m = user.memberships.find((x) => x.teamId === teamId);
    return m ? (m.role as Role) : null;
  }
  return user.role as Role;
}

export function can(user: SessionUser, capability: Capability, teamId: string | null = null): boolean {
  const role = roleOf(user, teamId);
  if (!role) return false;
  if (user.role === "ADMIN") return true;
  return (CAPABILITY_ROLES[capability] as readonly string[]).includes(role);
}

/** Throws UnauthorizedError / ForbiddenError. Use inside every protected route. */
export async function requireCapability(
  capability: Capability,
  teamId: string | null = null,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!can(user, capability, teamId)) throw new ForbiddenError(capability);
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Athlete access control (IDOR protection): staff roles must be on the
 * athlete's team; ATHLETE users may only read their own linked record.
 */
export async function requireAthleteAccess(
  athleteId: string,
  capability: Capability = "athlete.read",
): Promise<{ user: SessionUser; athlete: { id: string; teamId: string; externalId: string | null; firstName: string; lastName: string; position: string } }> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, teamId: true, externalId: true, firstName: true, lastName: true, position: true },
  });
  if (!athlete) {
    const e = new Error("Athlete not found.") as Error & { status?: number };
    e.status = 404;
    throw e;
  }
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (user.role === "ATHLETE") {
    // Athletes read only their own record (linked by demo membership email).
    const self = await prisma.athlete.findFirst({
      where: { teamId: athlete.teamId, rosterRole: user.email ?? "" },
      select: { id: true },
    });
    if (!self || self.id !== athleteId) {
      throw new ForbiddenError("athlete.read", "Athletes may only access their own record.");
    }
    return { user, athlete };
  }
  await requireCapability(capability, athlete.teamId);
  return { user, athlete };
}

/** Standard error → HTTP response mapping shared by all route handlers. */
export function errorToResponse(e: unknown): { status: number; body: { error: string; code: string } } {
  if (e instanceof UnauthorizedError) {
    return { status: 401, body: { error: "Authentication required.", code: "UNAUTHORIZED" } };
  }
  if (e instanceof ForbiddenError) {
    return { status: 403, body: { error: e.message, code: "FORBIDDEN" } };
  }
  const err = e as Error & { status?: number; code?: string };
  if (err.status === 404) {
    return { status: 404, body: { error: err.message, code: "NOT_FOUND" } };
  }
  return { status: 500, body: { error: "Internal error.", code: "INTERNAL" } };
}
