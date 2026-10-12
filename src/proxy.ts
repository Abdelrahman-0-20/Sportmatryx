import { NextResponse, type NextRequest } from "next/server";

/**
 * Cookie-presence gate only (defense in depth). Every server route re-checks
 * the session and RBAC itself; this merely redirects anonymous browsers.
 */
export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has("smx_session");
  const { pathname } = request.nextUrl;

  const protectedPrefixes = [
    "/team-command",
    "/roster",
    "/player",
    "/position-room",
    "/practice-command",
    "/game-readiness",
    "/recovery-command",
    "/environment-travel",
    "/interventions",
    "/data-quality",
    "/research",
    "/admin",
    "/athlete",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // No /login → app bounce here: a stale cookie would loop forever. The login
  // page validates the session server-side and forwards real users itself.
  return NextResponse.next();
}

export const config = {
  matcher: ["/team-command/:path*", "/roster/:path*", "/player/:path*", "/position-room/:path*", "/practice-command/:path*", "/game-readiness/:path*", "/recovery-command/:path*", "/environment-travel/:path*", "/interventions/:path*", "/data-quality/:path*", "/research/:path*", "/admin/:path*", "/athlete/:path*"],
};
