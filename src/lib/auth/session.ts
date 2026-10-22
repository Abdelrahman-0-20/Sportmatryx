import { prisma } from "@/lib/prisma";
import { generateToken } from "./password";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * DB-backed session auth.
 * Cookie: smx_session=<sessionId>.<hmac(sessionId, AUTH_SECRET)>
 * The HMAC prevents forged session ids from being probed; the session state
 * itself lives in the database and is revoked on logout.
 */
export const SESSION_COOKIE = "smx_session";
const SESSION_TTL_DAYS = 14;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (min 16 chars).");
  }
  return secret;
}

function signSessionId(sessionId: string): string {
  return createHmac("sha256", authSecret()).update(sessionId).digest("base64url");
}

function verifySigned(value: string): string | null {
  const idx = value.indexOf(".");
  if (idx <= 0) return null;
  const id = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = Buffer.from(signSessionId(id));
  let given: Buffer;
  try {
    given = Buffer.from(sig);
  } catch {
    return null;
  }
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? id : null;
}

export async function createSession(userId: string): Promise<void> {
  const sessionId = generateToken(24);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { sessionToken: sessionId, userId, expires } });
  const store = await cookies();
  store.set(SESSION_COOKIE, `${sessionId}.${signSessionId(sessionId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  // Logging in ends guest mode; otherwise a stale smx_guest cookie keeps
  // isGuest() true forever and read paths silently serve sample data.
  store.delete("smx_guest");
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const id = verifySigned(raw);
    if (id) {
      await prisma.session.deleteMany({ where: { sessionToken: id } });
    }
  }
  store.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  memberships: { teamId: string; role: string }[];
}

/** Resolve the current user from the request cookie, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sessionId = verifySigned(raw);
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
    include: { user: { include: { memberships: { select: { teamId: true, role: true } } } } },
  });
  if (!session || session.expires < new Date()) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    memberships: session.user.memberships.map((m) => ({ teamId: m.teamId, role: m.role })),
  };
}
