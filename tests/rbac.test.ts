import { describe, it, expect } from "vitest";
import { can, errorToResponse, ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";

function user(role: string, teams: string[] = ["teamA"]): SessionUser {
  return {
    id: "u1",
    email: "u@demo.dev",
    name: "Test User",
    role,
    memberships: teams.map((teamId) => ({ teamId, role })),
  };
}

describe("RBAC capability matrix (server-enforced, deny by default)", () => {
  it("staff roles can read the roster on their team", () => {
    for (const role of ["ADMIN", "PERFORMANCE", "MEDICAL", "COACH", "EXECUTIVE"]) {
      expect(can(user(role), "roster.read", "teamA"), role).toBe(true);
    }
    expect(can(user("ATHLETE"), "roster.read", "teamA")).toBe(false);
  });

  it("only ADMIN/MEDICAL/EXECUTIVE can write consent", () => {
    for (const role of ["ADMIN", "MEDICAL", "EXECUTIVE"]) {
      expect(can(user(role), "consent.write", "teamA"), role).toBe(true);
    }
    for (const role of ["PERFORMANCE", "COACH", "ATHLETE"]) {
      expect(can(user(role), "consent.write", "teamA"), role).toBe(false);
    }
  });

  it("only ADMIN/PERFORMANCE/MEDICAL/EXECUTIVE can review interventions — coach cannot", () => {
    expect(can(user("PERFORMANCE"), "intervention.review", "teamA")).toBe(true);
    expect(can(user("COACH"), "intervention.review", "teamA")).toBe(false);
  });

  it("team isolation: a role held on teamA does not apply to teamB", () => {
    expect(can(user("PERFORMANCE", ["teamA"]), "roster.read", "teamB")).toBe(false);
  });

  it("unrelated roles cannot export", () => {
    expect(can(user("COACH"), "export.run", "teamA")).toBe(false);
    expect(can(user("EXECUTIVE"), "export.run", "teamA")).toBe(true);
  });

  it("audit.read is limited to ADMIN/MEDICAL/EXECUTIVE", () => {
    expect(can(user("ADMIN"), "audit.read", null)).toBe(true);
    expect(can(user("COACH"), "audit.read", "teamA")).toBe(false);
  });
});

describe("error mapping", () => {
  it("maps UnauthorizedError to 401", () => {
    const m = errorToResponse(new UnauthorizedError());
    expect(m.status).toBe(401);
    expect(m.body.code).toBe("UNAUTHORIZED");
  });

  it("maps ForbiddenError to 403 with the needed capability", () => {
    const m = errorToResponse(new ForbiddenError("consent.write"));
    expect(m.status).toBe(403);
    expect(m.body.code).toBe("FORBIDDEN");
    expect(m.body.error).toContain("consent.write");
  });

  it("never leaks stack traces for unknown errors", () => {
    const m = errorToResponse(new Error("secret db detail"));
    expect(m.status).toBe(500);
    expect(m.body.error).toBe("Internal error.");
    expect(JSON.stringify(m.body)).not.toContain("secret db detail");
  });
});
