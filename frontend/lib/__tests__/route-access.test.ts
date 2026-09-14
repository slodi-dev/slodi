// @vitest-environment node
import { readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { routeAccess } from "@/lib/route-access";

const APP_DIR = path.resolve(__dirname, "../../app");

/** Every URL a page.tsx or route.ts under app/ serves, with dynamic segments filled in. */
function appRoutes(dir = APP_DIR, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name.startsWith("_")) continue;
      // Route groups like (landing) do not appear in the URL
      const segment = /^\(.*\)$/.test(entry.name)
        ? null
        : entry.name.replace(/^\[+\.*(.*?)\]+$/, "sample-$1");
      routes.push(
        ...appRoutes(path.join(dir, entry.name), segment ? [...segments, segment] : segments)
      );
    } else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry.name)) {
      routes.push(`/${segments.join("/")}`);
    }
  }
  return routes;
}

describe("routeAccess", () => {
  it("finds the app routes it is meant to check", () => {
    const routes = appRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/programs/sample-id");
    expect(routes).toContain("/api/leikir/sample-game/scores");
  });

  it.each(appRoutes())("classifies %s as public or private", (route) => {
    // A failure here means a new route was added without deciding who may see
    // it. Add it to lib/route-access.ts — as private unless it must be public.
    expect(routeAccess(route)).not.toBe("unknown");
  });

  it.each([
    ["/", "public"],
    ["/about", "public"],
    ["/unsubscribe", "public"],
    ["/api/emails/unsubscribe", "public"],
    ["/leikir", "public"],
    ["/leikir/arnor-clicker", "public"],
    ["/leikir/heidursordla/sample-id", "public"],
    ["/api/leikir/laddi-bird/scores", "public"],
    ["/api/auth/token", "public"],
    ["/admin", "private"],
    ["/admin/emails", "private"],
    ["/yfirferd", "private"],
    ["/programs/sample-id", "private"],
    ["/settings", "private"],
    ["/dev/sample-slug", "private"],
    ["/palette", "private"],
    ["/api/emails", "private"],
    ["/api/config", "private"],
    ["/does-not-exist", "unknown"],
    ["/aboutx", "unknown"],
    ["/leikirnir", "unknown"],
  ])("%s is %s", (route, expected) => {
    expect(routeAccess(route)).toBe(expected);
  });
});
