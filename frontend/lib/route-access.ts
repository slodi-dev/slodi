/**
 * Who may open which route. Read by `middleware.ts`.
 *
 * Every page and route handler under `app/` must be covered by an entry here —
 * `lib/__tests__/route-access.test.ts` walks the directory and fails if one is
 * not. That test is what keeps new routes private: nobody has to remember the
 * middleware, only to answer the question the failing test asks.
 *
 * A path is matched against its longest listed prefix, on segment boundaries,
 * so a nested route can override its parent, and `/api/emails/unsubscribe` is
 * public under a private `/api/emails`. A path no
 * entry covers is not an app route at all and falls through to the 404 page,
 * which anyone may see.
 */

export type RouteAccess = "public" | "private" | "unknown";

const ROUTES: Record<string, Exclude<RouteAccess, "unknown">> = {
  // Front door
  "/": "public",
  "/about": "public",
  // Reached from a link in an email, by someone who may never have logged in
  "/unsubscribe": "public",
  "/api/emails/unsubscribe": "public",
  // Guests may play, and are nudged to log in to keep their score
  "/leikir": "public",
  "/api/leikir": "public",
  // Auth0 handlers; they answer for a missing session themselves
  "/api/auth": "public",
  // The about page's team section
  "/api/contributors": "public",

  "/admin": "private",
  "/analytics": "private",
  "/badges": "private",
  "/builder": "private",
  "/dashboard": "private",
  "/dev": "private",
  "/palette": "private",
  "/profile": "private",
  "/programs": "private",
  "/settings": "private",
  "/social": "private",
  "/tags": "private",
  "/yfirferd": "private",
  "/api/config": "private",
  "/api/devlogs": "private",
  "/api/emails": "private",
};

export function routeAccess(pathname: string): RouteAccess {
  if (pathname === "/") return ROUTES["/"];

  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const access = ROUTES[`/${segments.slice(0, i).join("/")}`];
    if (access) return access;
  }
  return "unknown";
}
