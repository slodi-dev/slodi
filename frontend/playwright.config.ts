/**
 * Journey tests: each file under e2e/journeys/ proves one journey in
 * docs/journeys/. Run them with `scripts/e2e.sh` from the repo root, which
 * brings up the backend stack, builds the frontend and calls this config;
 * CI (.github/workflows/journeys.yml) runs the same script.
 *
 * The route crawler (e2e/crawl/) runs from the same config, once per form:
 * the `crawl-<width>-<theme>` projects below. The PR gate runs
 * `crawl-desktop-light`; nightly runs all four.
 *
 * Files are named `*.journey.ts` and `*.crawl.ts`, not `*.spec.ts`, so
 * Vitest's default glob never picks them up.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_FRONTEND_PORT ?? 13000);
const baseURL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

/** The four forms every page is crawled in. Phone is 390px, as in Storybook. */
const FORMS = [
  { width: "desktop", theme: "light", device: devices["Desktop Chrome"] },
  { width: "desktop", theme: "dark", device: devices["Desktop Chrome"] },
  {
    width: "phone",
    theme: "light",
    device: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
  },
  {
    width: "phone",
    theme: "dark",
    device: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
  },
] as const;

export default defineConfig<{ theme: "light" | "dark" }>({
  testDir: "./e2e",
  outputDir: "./e2e-results/artifacts",
  // A journey that takes longer than this has a hang, not a slow step.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Journeys share one seeded database. Each owns its own fixture rows, so
  // separate journey files may run side by side; the steps inside one journey
  // always run in order. The crawler only reads, so it runs fully parallel.
  workers: Number(process.env.E2E_WORKERS ?? 4),
  fullyParallel: false,
  forbidOnly: CI,
  // One retry in CI, and a test that passes only on retry is reported as
  // "flaky" rather than hidden. See docs/journey-testing-in-ci.md, "Flake".
  retries: CI ? 1 : 0,
  reporter: [
    [CI ? "github" : "list"],
    ["html", { outputFolder: "./e2e-results/html", open: "never" }],
    ["json", { outputFile: "./e2e-results/results.json" }],
  ],
  use: {
    baseURL,
    locale: "is-IS",
    timezoneId: "Atlantic/Reykjavik",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: "journeys/**/*.journey.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    ...FORMS.map(({ width, theme, device }) => ({
      name: `crawl-${width}-${theme}`,
      testMatch: "crawl/**/*.crawl.ts",
      // Pages are only read, so they can be visited side by side.
      fullyParallel: true,
      use: { ...device, theme },
    })),
  ],
  webServer: {
    // `next build` runs first, in scripts/e2e.sh, so a build failure is
    // reported as one and not as a server that never came up.
    command: `npm run start -- --port ${PORT}`,
    url: `${baseURL}/api/config`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
