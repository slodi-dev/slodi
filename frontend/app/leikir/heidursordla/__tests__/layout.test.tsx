/**
 * Heiðursorðla is hidden behind HEIDURSORDLA_ENABLED (user decision
 * 2026-10-11): no card on the hub, and both its routes are a 404.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/feature-flags");
});

async function load(enabled: boolean) {
  vi.doMock("@/lib/feature-flags", () => ({ HEIDURSORDLA_ENABLED: enabled }));
  const { default: Layout } = await import("../layout");
  const { GAMES, ALL_GAMES } = await import("@/lib/leikir-games");
  return { Layout, GAMES, ALL_GAMES };
}

describe("Heiðursorðla feature flag", () => {
  it("is off", async () => {
    const { HEIDURSORDLA_ENABLED } = await import("@/lib/feature-flags");
    expect(HEIDURSORDLA_ENABLED).toBe(false);
  });

  it("when off, the hub leaves it out and its routes are 404", async () => {
    const { Layout, GAMES, ALL_GAMES } = await load(false);
    expect(GAMES.map((g) => g.slug)).not.toContain("heidursordla");
    expect(ALL_GAMES.map((g) => g.slug)).toContain("heidursordla");
    expect(() => Layout({ children: "page" })).toThrow(
      expect.objectContaining({ digest: expect.stringContaining("404") })
    );
  });

  it("when on, the hub lists it and its routes render", async () => {
    const { Layout, GAMES } = await load(true);
    expect(GAMES.map((g) => g.slug)).toContain("heidursordla");
    expect(Layout({ children: "page" })).toBe("page");
  });
});
