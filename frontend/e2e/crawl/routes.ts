/**
 * Which URLs the route crawler visits.
 *
 * The list is derived from `app/**\/page.tsx`, so a new page is crawled the day
 * it lands. A static route is visited as is. A dynamic route (`[id]`, ...) is
 * visited once for every path in FILL, built from the seeded e2e data
 * (`backend/scripts/seed_e2e.py`, mirrored in `e2e/support/fixtures.ts`), or
 * listed in SKIP with the reason. `routes.test.ts` fails when a dynamic route is
 * in neither, so a new one can't go uncrawled by accident.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { CRAWL, LIKEABLE_TASK, OWNER_TASK, UNREVIEWED_TASK } from "../support/fixtures";

const FRONTEND_DIR = path.resolve(__dirname, "..", "..");
const APP_DIR = path.join(FRONTEND_DIR, "app");
const DEVLOG_DIR = path.join(FRONTEND_DIR, "content", "devlogs");

/** Every page route under app/, as written: `/programs/[id]`. */
export function pageRoutes(dir = APP_DIR, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Private folders (_x) and tests are not routes; `api` serves no pages.
      if (entry.name === "__tests__" || entry.name.startsWith("_")) continue;
      if (segments.length === 0 && entry.name === "api") continue;
      // Route groups like (landing) do not appear in the URL.
      const next = /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name];
      routes.push(...pageRoutes(path.join(dir, entry.name), next));
    } else if (/^page\.(tsx?|jsx?)$/.test(entry.name)) {
      routes.push(`/${segments.join("/")}`);
    }
  }
  return routes.sort();
}

export function isDynamic(route: string): boolean {
  return /\[[^\]]+\]/.test(route);
}

/** Devlog slugs, read the same way `lib/devlogs.ts` does (file name minus `.md`). */
function devlogSlugs(): string[] {
  return readdirSync(DEVLOG_DIR)
    .filter((f) => f.endsWith(".md") && !/^(README|TEMPLATE)\.md$/i.test(f))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/**
 * Concrete paths for each dynamic route. One path per kind of page the route
 * can render, not every row: the crawler looks for broken pages, not data.
 */
export const FILL: Record<string, () => string[]> = {
  // A task with instructions and a document, one with no likes, one waiting
  // for review, a program and an event (both liked, with instructions and a
  // document), and a hidden task only moderators and its author may open.
  "/programs/[id]": () =>
    [
      OWNER_TASK.id,
      LIKEABLE_TASK.id,
      UNREVIEWED_TASK.id,
      CRAWL.programId,
      CRAWL.eventId,
      CRAWL.hiddenTaskId,
    ].map((id) => `/programs/${id}`),
  // The newest devlog is enough: they all render through the same page.
  "/dev/[slug]": () =>
    devlogSlugs()
      .slice(-1)
      .map((slug) => `/dev/${slug}`),
  // Round 1, whose id the e2e seed pins. Its window is in the past, so it opens.
  "/leikir/heidursordla/[puzzleId]": () => [`/leikir/heidursordla/${CRAWL.puzzleId}`],
};

/** Dynamic routes the crawler can't fill, with the reason. Keep it short. */
export const SKIP: Record<string, string> = {};

export type CrawlTarget = {
  /** The route as written under app/, e.g. `/programs/[id]`. */
  route: string;
  /** The URL path visited, e.g. `/programs/00000000-...`. */
  path: string;
};

export function crawlTargets(): CrawlTarget[] {
  const targets: CrawlTarget[] = [];
  for (const route of pageRoutes()) {
    if (!isDynamic(route)) {
      targets.push({ route, path: route });
    } else if (FILL[route]) {
      for (const p of FILL[route]()) targets.push({ route, path: p });
    } else if (!(route in SKIP)) {
      throw new Error(
        `${route} is a dynamic route the crawler can't fill. Add it to FILL in ` +
          `e2e/crawl/routes.ts (with seeded data), or to SKIP with the reason.`
      );
    }
  }
  return targets;
}
