/**
 * Web Storage that cannot crash the page.
 *
 * `localStorage` is not always reachable, and the failure is not the gentle
 * "returns null" people expect — *touching the property throws*:
 *
 * - Safari with "Block All Cookies" blocks Web Storage too, and every access
 *   raises a SecurityError. This is the case that took slodi.is down for an
 *   iPhone user: she blocked cookies to get past a 400 from the reverse proxy,
 *   which then put her into a storage-blocked browser, and the first unguarded
 *   `localStorage.getItem` in a root-layout provider threw during mount — which
 *   React surfaces as "Application error: a client-side exception has occurred".
 * - Safari private browsing has historically thrown QuotaExceededError on write.
 * - Any browser throws QuotaExceededError once the origin's quota is full.
 * - Server-side rendering has no `window` at all.
 *
 * Because a provider in the root layout runs on *every* page, one unguarded
 * access takes down the whole site rather than one feature. These helpers
 * degrade to "no storage available" instead: reads give null, writes are
 * dropped. Anything persisted is a convenience — theme, favourites, a game
 * save — so losing it is always better than losing the page.
 */

function storage(): Storage | null {
  try {
    // Access alone can throw, so it has to be inside the try.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Is Web Storage usable at all? Useful for hiding features that need it. */
export function storageAvailable(): boolean {
  return storage() !== null;
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      storage()?.setItem(key, value);
    } catch {
      /* storage blocked or full — the value is a convenience, not a record */
    }
  },
  removeItem(key: string): void {
    try {
      storage()?.removeItem(key);
    } catch {
      /* nothing to do — see setItem */
    }
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      return sessionStorageOrNull()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      sessionStorageOrNull()?.setItem(key, value);
    } catch {
      /* see safeLocalStorage.setItem */
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorageOrNull()?.removeItem(key);
    } catch {
      /* see safeLocalStorage.setItem */
    }
  },
};
