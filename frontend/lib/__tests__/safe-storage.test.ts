import { describe, expect, it, afterEach, vi } from "vitest";

import { safeLocalStorage, safeSessionStorage, storageAvailable } from "../safe-storage";

// Safari with "Block All Cookies" blocks Web Storage too, and *accessing the
// property* raises a SecurityError — it does not merely return null. One
// unguarded read in a root-layout provider therefore throws during mount and
// React turns it into "Application error: a client-side exception has occurred",
// taking down every page rather than one feature. These tests reproduce that
// browser exactly.

const realLocal = Object.getOwnPropertyDescriptor(window, "localStorage");
const realSession = Object.getOwnPropertyDescriptor(window, "sessionStorage");

/** Make `window.localStorage` throw on access, as blocked Safari does. */
function blockStorage(prop: "localStorage" | "sessionStorage") {
  Object.defineProperty(window, prop, {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

/** Storage that exists but rejects writes, as a full quota does. */
function fullStorage(prop: "localStorage" | "sessionStorage") {
  Object.defineProperty(window, prop, {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceeded", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("QuotaExceeded", "QuotaExceededError");
      },
    },
  });
}

afterEach(() => {
  if (realLocal) Object.defineProperty(window, "localStorage", realLocal);
  if (realSession) Object.defineProperty(window, "sessionStorage", realSession);
  vi.restoreAllMocks();
});

describe("safeLocalStorage when storage works normally", () => {
  it("round-trips a value", () => {
    safeLocalStorage.setItem("k", "v");
    expect(safeLocalStorage.getItem("k")).toBe("v");
    safeLocalStorage.removeItem("k");
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("reports storage as available", () => {
    expect(storageAvailable()).toBe(true);
  });

  it("returns null for a key that was never set", () => {
    expect(safeLocalStorage.getItem("never-set")).toBeNull();
  });
});

describe("safeLocalStorage when the browser blocks storage (Safari, cookies off)", () => {
  it("does not throw on read — this is the crash that took the site down", () => {
    blockStorage("localStorage");
    expect(() => safeLocalStorage.getItem("slodi-theme-mode")).not.toThrow();
    expect(safeLocalStorage.getItem("slodi-theme-mode")).toBeNull();
  });

  it("does not throw on write", () => {
    blockStorage("localStorage");
    expect(() => safeLocalStorage.setItem("slodi-theme-mode", "dark")).not.toThrow();
  });

  it("does not throw on remove", () => {
    blockStorage("localStorage");
    expect(() => safeLocalStorage.removeItem("slodi-patrol")).not.toThrow();
  });

  it("reports storage as unavailable", () => {
    blockStorage("localStorage");
    expect(storageAvailable()).toBe(false);
  });
});

describe("safeLocalStorage when the quota is full", () => {
  it("drops the write rather than throwing", () => {
    fullStorage("localStorage");
    expect(() => safeLocalStorage.setItem("favorite-programs", "[]")).not.toThrow();
  });

  it("still reads without throwing", () => {
    fullStorage("localStorage");
    expect(safeLocalStorage.getItem("favorite-programs")).toBeNull();
  });
});

describe("safeSessionStorage", () => {
  it("round-trips normally", () => {
    safeSessionStorage.setItem("s", "1");
    expect(safeSessionStorage.getItem("s")).toBe("1");
    safeSessionStorage.removeItem("s");
    expect(safeSessionStorage.getItem("s")).toBeNull();
  });

  it("survives a browser that blocks it", () => {
    blockStorage("sessionStorage");
    expect(() => safeSessionStorage.getItem("leikir_pending_score_arnor-clicker")).not.toThrow();
    expect(() =>
      safeSessionStorage.setItem("leikir_pending_score_arnor-clicker", "5")
    ).not.toThrow();
    expect(() => safeSessionStorage.removeItem("leikir_pending_score_arnor-clicker")).not.toThrow();
  });

  it("is independent of localStorage being blocked", () => {
    blockStorage("localStorage");
    safeSessionStorage.setItem("still", "works");
    expect(safeSessionStorage.getItem("still")).toBe("works");
  });
});
