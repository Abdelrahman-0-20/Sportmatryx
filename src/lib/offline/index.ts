import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Guest / offline demo mode.
 *
 * A "Continue as guest" user (or any request made while the database is
 * unreachable, e.g. a Vercel deployment without a live DATABASE_URL) is served
 * SYNTHETIC SAMPLE DATA instead of a crash. This keeps the application fully
 * demonstrable end-to-end without a live database.
 *
 * HONESTY GUARANTEE (spec §25): guest/offline data is always explicitly labeled
 * "synthetic sample" in the UI via the offline-demo banner. It is never
 * presented as real athlete data, and it is never written back to any store.
 */
export const GUEST_COOKIE = "smx_guest";

/** Is the current request in guest mode (landed via /guest, no real session)? */
export async function isGuest(): Promise<boolean> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value === "1";
}

/**
 * Run a database-backed operation, falling back to a provided sample result
 * when the database is unreachable OR the request is in guest mode.
 */
export async function withFallback<T>(dbFn: () => Promise<T>, sample: () => T): Promise<T> {
  const guest = await isGuest();
  if (guest) return sample();
  try {
    return await dbFn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const isDbDown =
      msg.includes("Can't reach database server") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("P1001") ||
      msg.includes("Environment variable not found: DATABASE_URL") ||
      msg.includes("database server") ||
      msg.toLowerCase().includes("connection");
    if (isDbDown) return sample();
    throw e;
  }
}

/** A throwaway guest user descriptor, so the shell can render without auth. */
export const GUEST_USER = {
  id: "guest",
  email: "guest",
  name: "Guest (synthetic demo)",
  role: "GUEST",
  memberships: [],
};

/**
 * Read-only access guard that ALSO permits a guest (offline/synthetic) visitor
 * for the intersection of capabilities a guest is allowed to see. Everything
 * else still requires a real authenticated, authorized user.
 */
export async function requireReadForGuest(capability: string): Promise<SessionUser | typeof GUEST_USER> {
  const guest = await isGuest();
  if (guest && isGuestReadable(capability)) return GUEST_USER;
  // Fall back to the standard, server-enforced check.
  const { requireCapability } = await import("@/lib/auth/rbac");
  return requireCapability(capability as never);
}

const GUEST_READABLE = new Set([
  "roster.read",
  "athlete.read",
  "score.read",
  "intervention.read",
]);

function isGuestReadable(capability: string): boolean {
  return GUEST_READABLE.has(capability);
}