/**
 * Visual regression: a screenshot of every Storybook story, compared with a
 * baseline PNG committed under visual/__screenshots__/. Layer 2 of
 * docs/ui-quality-pipeline.md (sc-584).
 *
 * Runs against the built Storybook (`npm run build-storybook`), served by
 * scripts/serve-static.mjs. Always run it inside the official Playwright
 * Docker image, so font rendering matches the baselines:
 *
 *   npm run test:visual          # compare (what CI does)
 *   npm run test:visual:update   # accept the current look as the new baseline
 *
 * Both go through scripts/visual.sh. CI runs the same image
 * (.github/workflows/frontend-ci.yml, "Visual regression").
 *
 * Forms: light theme at desktop width only, for now. Adding a form is one
 * entry in FORMS; it adds one baseline per story.
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.VISUAL_PORT ?? 6007);
const CI = !!process.env.CI;

export const FORMS = [{ theme: "light", viewport: "desktop", width: 1280, height: 800 }] as const;

export type VisualForm = (typeof FORMS)[number];

export default defineConfig<{ form: VisualForm }>({
  testDir: "./visual",
  testMatch: "**/*.visual.ts",
  outputDir: "./visual-results/artifacts",
  // One baseline per story per form: visual/__screenshots__/<form>/<story-id>.png
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  timeout: 30_000,
  fullyParallel: true,
  workers: CI ? "100%" : "50%",
  forbidOnly: CI,
  // A screenshot that differs is a real difference: the run is deterministic,
  // so a retry would only hide flake.
  retries: 0,
  reporter: [
    [CI ? "github" : "list"],
    ["html", { outputFolder: "./visual-results/html", open: "never" }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // Per-pixel colour tolerance (YIQ, 0–1) and pixel count. Baselines are
      // made in the same image as CI, so nothing needs absorbing.
      threshold: 0.1,
      maxDiffPixels: 0,
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    deviceScaleFactor: 1,
    locale: "is-IS",
    timezoneId: "Atlantic/Reykjavik",
    colorScheme: "light",
    reducedMotion: "reduce",
  },
  projects: FORMS.map((form) => ({
    name: `${form.theme}-${form.viewport}`,
    use: { form, viewport: { width: form.width, height: form.height } },
  })),
  webServer: {
    command: `node scripts/serve-static.mjs storybook-static ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !CI,
    timeout: 30_000,
  },
});
