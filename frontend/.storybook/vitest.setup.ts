/**
 * Setup for the `storybook-*` Vitest projects (vitest.config.ts).
 *
 * A story that renders but logs a console.error is a failing story: React
 * reports caught render errors, key warnings, invalid DOM nesting and
 * hydration-style mistakes through console.error, and none of those throw.
 *
 * A story that shows an error state on purpose (the mocked API returns 500)
 * makes the app log that error, which is correct. Such a story lists exactly
 * what it expects, so anything else still fails:
 *
 *   parameters: { allowedConsoleErrors: [/^\[API 500\]/] }
 *
 * Preview annotations (preview.tsx) are applied by @storybook/addon-vitest
 * itself (Storybook 10.3+), so this file must not apply them again.
 */
import { afterEach, beforeEach, expect, vi } from "vitest";

let errors: string[] = [];

beforeEach(() => {
  errors = [];
  const original = console.error;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(
      args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a))).join(" ")
    );
    original(...args);
  });
});

afterEach((context) => {
  vi.mocked(console.error).mockRestore();
  // @storybook/addon-vitest puts the composed story on the test context.
  const story = (context as unknown as { story?: { parameters?: Record<string, unknown> } }).story;
  const allowed = (story?.parameters?.allowedConsoleErrors as RegExp[] | undefined) ?? [];
  const unexpected = errors.filter((message) => !allowed.some((re) => re.test(message)));
  expect(unexpected, "console.error was called while the story rendered").toEqual([]);
});
