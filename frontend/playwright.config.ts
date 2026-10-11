/**
 * Journey tests: each file under e2e/journeys/ proves one journey in
 * docs/journeys/. Run them with `scripts/e2e.sh` from the repo root, which
 * brings up the backend stack, builds the frontend and calls this config;
 * CI (.github/workflows/journeys.yml) runs the same script.
 *
 * Files are named `*.journey.ts`, not `*.spec.ts`, so Vitest's default glob
 * never picks them up.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_FRONTEND_PORT ?? 13000);
const baseURL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e/journeys",
  testMatch: "**/*.journey.ts",
  outputDir: "./e2e-results/artifacts",
  // A journey that takes longer than this has a hang, not a slow step.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Journeys share one seeded database. Each owns its own fixture rows, so they
  // can run in parallel later; one worker keeps the first ones easy to read.
  workers: 1,
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
