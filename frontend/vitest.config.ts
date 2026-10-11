import { defineConfig } from "vitest/config";
import path from "path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

/**
 * Two kinds of test, one Vitest run:
 *
 *  - `unit`: the jsdom unit tests (`__tests__/**`, `*.test.ts(x)`). `npm test`.
 *  - `storybook-<theme>-<viewport>`: every story rendered in real Chromium,
 *    once per form — light and dark, at phone (390px) and desktop width.
 *    `npm run test:stories`. A story fails on a render error, a failing
 *    `play`, a console.error (`.storybook/vitest.setup.ts`) or, where a11y is
 *    set to "error", an axe violation.
 *
 * The four forms are four projects that differ only in the Storybook globals
 * they start from. `theme` goes through the real ThemeProvider (preview.tsx);
 * `viewport` names one of the viewports in preview.tsx and sets the browser
 * size. Design: docs/ui-quality-pipeline.md.
 */
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = ["phone", "desktop"] as const;

const storybookProjects = THEMES.flatMap((theme) =>
  VIEWPORTS.map((viewport) => ({
    extends: true as const,
    plugins: [
      storybookTest({
        configDir: path.join(__dirname, ".storybook"),
        initialGlobals: { theme, viewport: { value: viewport, isRotated: false } },
      }),
    ],
    test: {
      name: `storybook-${theme}-${viewport}`,
      setupFiles: ["./.storybook/vitest.setup.ts"],
      browser: {
        enabled: true,
        headless: true,
        provider: "playwright",
        instances: [{ browser: "chromium" as const }],
      },
    },
  }))
);

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@components": path.resolve(__dirname, "components"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
          css: {
            modules: {
              classNameStrategy: "non-scoped",
            },
          },
        },
      },
      ...storybookProjects,
    ],
  },
});
