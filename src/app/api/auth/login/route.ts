import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { errorToResponse } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/login — demo login (development-only seeded accounts).
 * Rate-limitable at the edge; passwords verified with scrypt + timingSafeEqual.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required.", code: "VALIDATION" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.hashedPassword || !(await verifyPassword(password, user.hashedPassword))) {
      // Uniform response avoids user enumeration.
      return NextResponse.json({ error: "Invalid credentials.", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, role: user.role, name: user.name });
  } catch (e) {
    // Database connectivity deserves an actionable message, not "Internal error."
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Can't reach database server") || msg.includes("ECONNREFUSED") || msg.includes("P1001")) {
      return NextResponse.json(
        { error: "Database is not running. Start it with: pnpm db:start (then retry).", code: "DB_UNREACHABLE" },
        { status: 503 },
      );
    }
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
