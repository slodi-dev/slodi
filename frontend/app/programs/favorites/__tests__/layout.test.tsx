/**
 * Favourites are hidden behind FAVOURITES_ENABLED (UX-01): the page is a 404
 * until they have a backend.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/feature-flags");
});

async function loadLayout(enabled: boolean) {
  vi.doMock("@/lib/feature-flags", () => ({ FAVOURITES_ENABLED: enabled }));
  return (await import("../layout")).default;
}

describe("Favourites feature flag", () => {
  it("is off", async () => {
    const { FAVOURITES_ENABLED } = await import("@/lib/feature-flags");
    expect(FAVOURITES_ENABLED).toBe(false);
  });

  it("when off, /programs/favorites is a 404", async () => {
    const Layout = await loadLayout(false);
    expect(() => Layout({ children: "page" })).toThrow(
      expect.objectContaining({ digest: expect.stringContaining("404") })
    );
  });

  it("when on, the page renders", async () => {
    const Layout = await loadLayout(true);
    expect(Layout({ children: "page" })).toBe("page");
  });
});
