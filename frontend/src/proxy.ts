import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side gate: no session cookie → no workspace or portal HTML is served.
 * The API still authorises every request; this stops unauthenticated page loads early.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthPage = /^\/(login|verify|recovery)(\/|$)/.test(pathname);
  if (!isAuthPage && !req.cookies.has("ragi_session")) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api|icon.svg|favicon.ico|robots.txt).*)"] };
