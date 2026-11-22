// @vitest-environment node
/**
 * Runs with the unit tests (`npm test`), so a new dynamic route the crawler
 * can't open fails CI before the journey stack is even started.
 */
import { describe, expect, it } from "vitest";
import { routeAccess } from "../../lib/route-access";
import { crawlTargets, FILL, isDynamic, pageRoutes, SKIP } from "./routes";

describe("route crawler targets", () => {
  it("finds the pages under app/", () => {
    const routes = pageRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/programs/[id]");
    expect(routes).not.toContain("/api/config");
  });

  it.each(pageRoutes().filter(isDynamic))(
    "dynamic route %s is filled from seeded data or skipped with a reason",
    (route) => {
      // A failure here means a new [param] page. Add it to FILL in
      // e2e/crawl/routes.ts with a path built from backend/scripts/seed_e2e.py,
      // or to SKIP with the reason it can't be.
      const filled = route in FILL && FILL[route]().length > 0;
      const skipped = route in SKIP && SKIP[route].trim().length > 0;
      expect(filled || skipped).toBe(true);
    }
  );

  it("has no stale FILL or SKIP entries", () => {
    const routes = new Set(pageRoutes());
    for (const route of [...Object.keys(FILL), ...Object.keys(SKIP)]) {
      expect(routes, `${route} no longer exists under app/`).toContain(route);
    }
  });

  it("fills every dynamic segment", () => {
    for (const { path } of crawlTargets()) expect(path).not.toMatch(/\[|\]/);
  });

  // Item pages are signed-in only (user decision 2026-10-11). Private routes
  // make the crawler assert that a signed-out visit is sent to log in
  // (pages.crawl.ts), so this pins every item path the crawl opens to that.
  it("crawls item pages, and every one is private", () => {
    const items = crawlTargets().filter((t) => t.route === "/programs/[id]");
    expect(items.length).toBeGreaterThan(0);
    for (const { path } of items) expect(routeAccess(path), path).toBe("private");
  });
});
