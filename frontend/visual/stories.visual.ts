/**
 * One screenshot per Storybook story per form, compared with its baseline.
 * Config, forms and how to update: playwright.visual.config.ts.
 *
 * The story list is the built Storybook's index.json, so a new story gets a
 * test (and needs a baseline) without touching this file. A story that cannot
 * be made deterministic opts out with `tags: ["skip-visual"]` and a comment
 * saying why.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import type { VisualForm } from "../playwright.visual.config";

type IndexEntry = { type: "story" | "docs"; id: string; title: string; tags?: string[] };

const index = JSON.parse(
  readFileSync(path.join(__dirname, "..", "storybook-static", "index.json"), "utf8")
) as { entries: Record<string, IndexEntry> };

const stories = Object.values(index.entries).filter(
  (entry) => entry.type === "story" && !entry.tags?.includes("skip-visual")
);

/**
 * Baseline file name: the story id in plain ASCII, so the file names are the
 * same bytes on every OS and file system (macOS stores "ð" and "ö" differently).
 */
const ASCII: Record<string, string> = {
  á: "a",
  ð: "d",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ý: "y",
  þ: "th",
  æ: "ae",
  ö: "o",
};
function baselineName(id: string): string {
  return id.replace(/[^a-z0-9-]/g, (c) => ASCII[c] ?? "_");
}
const seen = new Map<string, string>();
for (const story of stories) {
  const name = baselineName(story.id);
  const other = seen.get(name);
  if (other) throw new Error(`Stories ${other} and ${story.id} share the baseline ${name}`);
  seen.set(name, story.id);
}

/** Every story sees the same "now": dates, countdowns and "x days ago" are stable. */
const FIXED_NOW = new Date("2026-06-15T12:00:00Z");

const test = base.extend<{ form: VisualForm }>({
  form: [{ theme: "light", viewport: "desktop", width: 1280, height: 800 }, { option: true }],
});

test.beforeEach(async ({ page }) => {
  // Time stands still for the story. Date.now() is FIXED_NOW; performance.now()
  // and the requestAnimationFrame timestamp never advance, so loops that step
  // by elapsed time (tickers, the clicker) are drawn at t = 0.
  //
  // Animation frames are held until the story has finished and its images and
  // sprites have loaded (releaseFrames() below), then a loop that steps once
  // per frame (the canvas games) gets exactly MAX_FRAMES frames: a callback
  // scheduled from inside a rAF callback is dropped past that depth. One-off
  // rAFs (measuring, focus) all run on release.
  //
  // Timers still fire, so Storybook, mocks and play functions run as normal.
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    const MAX_FRAMES = 3;
    const start = performance.now();
    performance.now = () => start;
    const raf = window.requestAnimationFrame.bind(window);
    let depth = 0;
    let held: (() => void)[] | null = [];
    const schedule = (run: () => void) => (held ? (held.push(run), 0) : raf(run));
    window.requestAnimationFrame = (callback) => {
      const callbackDepth = depth + 1;
      if (callbackDepth > MAX_FRAMES) return 0;
      return schedule(() => {
        depth = callbackDepth;
        try {
          callback(start);
        } finally {
          depth = 0;
        }
      });
    };
    (window as unknown as { __releaseFrames: () => void }).__releaseFrames = () => {
      const queued = held ?? [];
      held = null;
      for (const run of queued) raf(run);
    };
  });
  // A seeded Math.random, so shuffles and random picks are the same every run.
  await page.addInitScript(() => {
    let seed = 0x2f6b_5e1d;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  // Only the Storybook server: nothing reaches the network.
  await page.route(/^(?!http:\/\/127\.0\.0\.1[:/])/, (route) => route.abort());
});

for (const story of stories) {
  test(`${story.title} › ${story.id}`, async ({ page, form }) => {
    const globals = `theme:${form.theme};viewport:${form.viewport}`;
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=${globals}`);

    // Rendered, play function run and afterEach hooks done (or failed). Polled
    // on a timer, as animation frames are held.
    await page.waitForFunction(
      () => {
        const phase = (
          window as unknown as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }
        ).__STORYBOOK_PREVIEW__?.currentRender?.phase;
        return phase === "finished" || phase === "errored" || phase === "aborted";
      },
      undefined,
      { polling: 50 }
    );
    await expect(page.locator("body.sb-show-errordisplay"), "the story errored").toHaveCount(0);

    // Everything the story asked for (sprites, images, lazy chunks) has
    // arrived, then the held frames run and the images decode.
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      (window as unknown as { __releaseFrames: () => void }).__releaseFrames();
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
          )
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    await expect(page).toHaveScreenshot(`${baselineName(story.id)}.png`, { fullPage: true });
  });
}

// A baseline whose story was renamed, deleted or skipped. A full
// `npm run test:visual:update` deletes them; a plain run fails and lists them.
test("every baseline has a story", async ({}, testInfo) => {
  const dir = path.dirname(testInfo.snapshotPath("x.png"));
  if (!existsSync(dir)) return;
  const expected = new Set(stories.map((story) => `${baselineName(story.id)}.png`));
  const orphans = readdirSync(dir).filter((file) => !expected.has(file));
  if (orphans.length && ["all", "changed"].includes(testInfo.config.updateSnapshots)) {
    for (const file of orphans) rmSync(path.join(dir, file));
    return;
  }
  expect(orphans, "baselines with no story; run npm run test:visual:update").toEqual([]);
});
