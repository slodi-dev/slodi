import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";
import { routeAccess } from "./lib/route-access";

export async function middleware(request: NextRequest) {
  // Always let the SDK run: it serves /auth/* and keeps a rolling session fresh.
  const authResponse = await auth0.middleware(request);

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/auth/") || routeAccess(pathname) !== "private") {
    return authResponse;
  }

  const session = await auth0.getSession(request);
  if (session) return authResponse;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/auth/login", request.nextUrl.origin);
  login.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except build output and static files served from public/.
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|svg|webp|webmanifest|txt|xml|html|wav|mp3|md)$).*)",
  ],
};
