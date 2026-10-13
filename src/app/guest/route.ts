import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_COOKIE } from "@/lib/offline";

/**
 * GET /guest — "Continue as guest" entry point.
 * Sets a guest cookie and opens the app in offline/synthetic-sample mode.
 * Guest users see all read surfaces (roster, player 360, interventions,
 * trends) populated with clearly-labeled synthetic sample data; write
 * surfaces (admin, exports, consent changes, intervention reviews) remain
 * gated behind a real account.
 */
export async function GET() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/team-command");
}