import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * What is worth pinning about mock mode is not that it works — a fixture that
 * fails to load is obvious the moment you open the page. It is the properties
 * whose failure is *silent*: that a production build cannot turn it on, that
 * the default flips itself back to real data, and that a forced choice dies
 * with the tab rather than following someone into tomorrow.
 *
 * These exercise `readMockMode` rather than the hook, because the production
 * case has to run under a production React build, where `act` does not exist
 * and nothing can be rendered at all. The hook is a thin wrapper; the last two
 * tests are what tie the two together.
 */

async function loadModule() {
  // The NODE_ENV gate is read into a module-level const, so each case needs a
  // fresh module rather than a fresh call.
  vi.resetModules();
  return import("../mock-mode");
}

function setSearch(search: string) {
  window.history.replaceState({}, "", `/builder${search}`);
}

describe("mock mode", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setSearch("");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { MOCK_AVAILABLE } = await loadModule();
    expect(MOCK_AVAILABLE).toBe(false);
  });

  it("is available outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { MOCK_AVAILABLE } = await loadModule();
    expect(MOCK_AVAILABLE).toBe(true);
  });

  it("stays off in production even with ?mock=1 in the URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setSearch("?mock=1");
    const { readMockMode } = await loadModule();

    expect(readMockMode()).toBe("off");
    // And it must not leave the flag behind for a later development session.
    expect(sessionStorage.getItem("slodi_mock_data")).toBeNull();
  });

  it("defaults to auto in development, so real data wins as soon as it exists", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { readMockMode } = await loadModule();
    expect(readMockMode()).toBe("auto");
  });

  it("forces fixtures on with ?mock=1, and remembers it across navigation", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setSearch("?mock=1");
    const { readMockMode } = await loadModule();

    expect(readMockMode()).toBe("on");

    setSearch("");
    expect(readMockMode()).toBe("on");
  });

  it("forces fixtures off with ?mock=0, and does not drift back to auto", async () => {
    // "off" has to be sticky in its own right: falling back to auto would
    // silently re-enable fixtures for someone deliberately working on the
    // error states.
    vi.stubEnv("NODE_ENV", "development");
    setSearch("?mock=0");
    const { readMockMode } = await loadModule();

    expect(readMockMode()).toBe("off");

    setSearch("");
    expect(readMockMode()).toBe("off");
  });

  it("uses sessionStorage, not localStorage, so a forced choice dies with the tab", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setSearch("?mock=1");
    const { readMockMode } = await loadModule();

    readMockMode();

    expect(sessionStorage.getItem("slodi_mock_data")).toBe("on");
    expect(localStorage.getItem("slodi_mock_data")).toBeNull();
  });

  it("useMockMode reports the mode once mounted", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setSearch("?mock=1");
    const { useMockMode } = await loadModule();

    const { result } = renderHook(() => useMockMode());
    expect(result.current).toEqual({ mode: "on", settled: true });
  });

  it("reports itself settled up front in production, where nothing can change", async () => {
    // Callers gate their real request on `settled`, so a production build that
    // waited a render to learn a mode it cannot change would delay every fetch
    // for nothing.
    vi.stubEnv("NODE_ENV", "production");
    const { useMockMode } = await loadModule();

    const seen: Array<{ mode: string; settled: boolean }> = [];
    renderHook(() => {
      const value = useMockMode();
      seen.push(value);
      return value;
    });

    expect(seen[0]).toEqual({ mode: "off", settled: true });
  });

  it("useMockMode renders off first, so server and client agree on hydration", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setSearch("?mock=1");
    const { useMockMode } = await loadModule();

    // Reading the URL during render instead of in an effect would make the
    // first client render disagree with the server's, and React would throw the
    // tree away. Recording every render is the only way to see that the first
    // one was off — by the time renderHook returns, the effect has run.
    const seen: Array<{ mode: string; settled: boolean }> = [];
    renderHook(() => {
      const value = useMockMode();
      seen.push(value);
      return value;
    });

    expect(seen[0]).toEqual({ mode: "off", settled: false });
    expect(seen[seen.length - 1]).toEqual({ mode: "on", settled: true });
  });
});
