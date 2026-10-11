import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTokenSet, groupOf, isHslTriplet, parseRules } from "../parseTokens";

const css = fs.readFileSync(path.resolve(__dirname, "../../../../app/slodi-tokens.css"), "utf8");
const set = buildTokenSet(css);

describe("parseTokens on app/slodi-tokens.css", () => {
  it("finds the --sl-* tokens", () => {
    expect(set.names.length).toBeGreaterThan(500);
    expect(set.names).toContain("--sl-color-primary");
  });

  it("resolves var() chains to literal values", () => {
    expect(set.byTheme.light.get("--sl-color-primary")?.resolved).toBe("142 50% 32%");
    expect(set.byTheme.dark.get("--sl-color-primary")?.resolved).toBe("142 50% 55%");
  });

  it("applies the in-app dark block (class=dark), not the prefers-color-scheme one", () => {
    // Declared in :root, then overridden by the trailing `:root.dark` block.
    expect(set.byTheme.light.get("--sl-color-primary-text")?.declared).toBe(
      "var(--sl-primitive-green-800)"
    );
    expect(set.byTheme.dark.get("--sl-color-primary-text")?.declared).toBe(
      "var(--sl-primitive-green-200)"
    );
  });

  it("applies named themes via data-theme", () => {
    expect(set.byTheme["forest-night"].get("--sl-color-background")?.declared).toBe(
      "var(--sl-primitive-pine-900)"
    );
    expect(set.byTheme.campfire.get("--sl-color-background")?.resolved).toBe("35 30% 94%");
  });

  it("skips @media blocks", () => {
    const rules = parseRules("@media (x) { :root { --sl-a: 1; } } :root { --sl-b: 2; }");
    expect(rules.find((r) => r.media)?.decls[0].name).toBe("--sl-a");
    const tokens = buildTokenSet("@media (x) { :root { --sl-a: 1; } } :root { --sl-b: 2; }");
    expect(tokens.names).toEqual(["--sl-b"]);
  });

  it("reports undeclared references", () => {
    // token-check-ignore: an undeclared token is the fixture under test.
    const tokens = buildTokenSet(":root { --sl-a: var(--sl-nope); }");
    expect(tokens.byTheme.light.get("--sl-a")).toMatchObject({
      resolved: null,
      missing: ["--sl-nope"],
    });
  });

  it("groups tokens", () => {
    expect(groupOf("--sl-color-patrol-drekar", "28 90% 50%")).toBe("patrol");
    expect(groupOf("--sl-spacing-gap-md", "1rem")).toBe("spacing");
    expect(groupOf("--sl-z-modal", "50")).toBe("z-index");
    expect(isHslTriplet("142 50% 32% / 0.3")).toBe(true);
    expect(isHslTriplet("0 0 0 3px red")).toBe(false);
  });
});
