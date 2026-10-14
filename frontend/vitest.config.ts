import { defineConfig } from "vitest/config";
import path from "path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

/**
 * Two kinds of test, one Vitest run:
 *
 *  - `unit`: the jsdom unit tests (`__tests__/**`, `*.test.ts(x)`). `npm test`.
 *  - `storybook-<theme>-<viewport>`: every story rendered in real Chromium,
 *    once per form — light, dark and a patrol accent, at phone (390px) and
 *    desktop width. `npm run test:stories`. A story fails on a render error, a
 *    failing `play`, a console.error (`.storybook/vitest.setup.ts`) or, where
 *    a11y is set to "error", an axe violation.
 *
 * The six forms are six projects that differ only in the Storybook globals
 * they start from. `theme` and `patrol` go through the real ThemeProvider
 * (preview.tsx); `viewport` names one of the viewports in preview.tsx and sets
 * the browser size. Design: docs/ui-quality-pipeline.md.
 *
 * STORYBOOK_THEMES=dark (or "light,patrol") limits the run to those themes;
 * CI runs one theme per matrix job. A story that is known to fail in one theme
 * opts out of that theme only with the tag `skip-<theme>` (e.g. `skip-dark`),
 * plus a comment naming the rule and its Shortcut story.
 */
const THEMES = {
  light: { theme: "light", patrol: "none" },
  dark: { theme: "dark", patrol: "none" },
  // Light theme with a patrol colour as --sl-color-primary, as ThemeProvider
  // sets it. Fálkar is the patrol closest to AA (white on falkar-500 is 4.07:1,
  // falkar-500 text on the page 3.99:1; the others are 1.6–3.4:1), so it is the
  // one that should pass first.
  //
  // knownA11yGaps: axe rules off for this theme only (preview.tsx), because
  // the cause is one token, not the stories. color-contrast: every primary
  // button, link and active nav item uses falkar-500, 3.55–4.07:1, needs
  // 4.5:1 — sc-629 (badges: sc-600). Remove it when that lands.
  patrol: { theme: "light", patrol: "falkar", knownA11yGaps: ["color-contrast"] },
} as const;
type ThemeName = keyof typeof THEMES;
const VIEWPORTS = ["phone", "desktop"] as const;

const requestedThemes = (process.env.STORYBOOK_THEMES ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
for (const name of requestedThemes) {
  if (!(name in THEMES)) {
    throw new Error(
      `STORYBOOK_THEMES: unknown theme "${name}" (${Object.keys(THEMES).join(", ")})`
    );
  }
}
const themes = (requestedThemes.length ? requestedThemes : Object.keys(THEMES)) as ThemeName[];

const storybookProjects = themes.flatMap((theme) =>
  VIEWPORTS.map((viewport) => ({
    extends: true as const,
    plugins: [
      storybookTest({
        configDir: path.join(__dirname, ".storybook"),
        initialGlobals: { ...THEMES[theme], viewport: { value: viewport, isRotated: false } },
        tags: { skip: [`skip-${theme}`] },
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
