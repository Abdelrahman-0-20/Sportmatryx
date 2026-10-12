import { redirect } from "next/navigation";
import { requireCapability, type Capability, errorToResponse } from "./rbac";
import { ForbiddenError } from "./rbac";

/**
 * Page-level guard: redirects anonymous/stale-session visitors to /login
 * instead of throwing. Renders the denied message for ForbiddenError and
 * re-throws genuine server faults. Returns the SessionUser on success.
 */
export async function guardPage(
  capability: Capability,
  teamId: string | null = null,
): Promise<
  | { user: import("./session").SessionUser; denied?: undefined }
  | { user?: undefined; denied: { message: string; code: string } }
> {
  try {
    const user = await requireCapability(capability, teamId);
    return { user };
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return { denied: { message: `Access denied — your role does not include this capability. (${e.needed})`, code: "FORBIDDEN" } };
    }
    if ((e as Error).name === "UnauthorizedError") {
      redirect("/login");
    }
    throw e;
  }
}

/** Map a non-guard error to a display-safe message. */
export function pageError(e: unknown): { message: string; code: string } {
  const m = errorToResponse(e);
  return { message: m.body.error, code: m.body.code };
}
