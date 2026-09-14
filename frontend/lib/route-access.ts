/**
 * Who may open which route. Read by `middleware.ts`.
 *
 * This is an allowlist: a route is public only if it is listed here, and
 * everything else — including paths no page serves — requires a session. A new
 * route is therefore private until someone deliberately adds it below.
 *
 * An entry covers its own path and everything beneath it, on segment
 * boundaries, so `/leikir` opens `/leikir/laddi-bird` but not `/leikirnir`.
 * `/` is the one exception and matches only the front page.
 * `lib/__tests__/route-access.test.ts` fails if an entry no longer matches any
 * route under `app/`, so the list cannot quietly go stale.
 */

export type RouteAccess = "public" | "private";

export const PUBLIC_ROUTES: readonly string[] = [
  // Front door
  "/",
  "/about",
  // Reached from a link in an email, by someone who may never have logged in
  "/unsubscribe",
  "/api/emails/unsubscribe",
  // Guests may play, and are nudged to log in to keep their score
  "/leikir",
  "/api/leikir",
  // Auth0 handlers; they answer for a missing session themselves
  "/api/auth",
  // The about page's team section
  "/api/contributors",
];

const PUBLIC = new Set(PUBLIC_ROUTES);

export function routeAccess(pathname: string): RouteAccess {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return PUBLIC.has("/") ? "public" : "private";

  for (let i = segments.length; i > 0; i--) {
    if (PUBLIC.has(`/${segments.slice(0, i).join("/")}`)) return "public";
  }
  return "private";
}
