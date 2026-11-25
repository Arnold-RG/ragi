import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side gate: no session cookie → no workspace or portal HTML is served.
 * The API still authorises every request; this stops unauthenticated page loads early.
 */
const AUTH = /^\/(login|verify|unlock|recovery|forgot|signup|setup|invite)(\/|$)/;

function hasSession(req: NextRequest) {
  return req.cookies.has("__Host-ragi_session") || req.cookies.has("ragi_session");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!AUTH.test(pathname) && !hasSession(req)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api|ws|icon.svg|favicon.ico|robots.txt).*)"] };
