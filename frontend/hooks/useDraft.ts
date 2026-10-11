"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeLocalStorage } from "@/lib/safe-storage";

/** Read and parse a stored draft; anything unreadable counts as no draft. */
function readStored<T>(key: string): Partial<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = safeLocalStorage.getItem(key);
    return stored ? (JSON.parse(stored) as Partial<T>) : null;
  } catch {
    return null;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * useDraft — persists form draft state to safeLocalStorage.
 *
 * Cookie-based persistence was considered, but the instructions field allows
 * up to 5 000 characters, which exceeds the 4 KB per-cookie browser limit.
 * localStorage (5 MB limit) is used instead, keeping the same semantics:
 * the draft survives page refreshes and browser restarts.
 *
 * Only a draft that differs from `initial` is written. Opening a form and
 * closing it again leaves nothing behind — before this, merely opening an
 * edit form stored a snapshot of it, and a snapshot taken from incomplete data
 * later overrode the real item (sc-530).
 *
 * @param key     Unique storage key (use a workspace-scoped key to avoid collisions)
 * @param initial Default value used when no draft exists
 * @param options `restore: "ask"` leaves a stored draft out of `draft` and
 *                hands it back as `pending` instead, for the caller to offer;
 *                `restoreDraft()` applies it. The default, `"auto"`, merges it
 *                in on mount.
 * @returns       - draft:        current draft value
 *                - updateDraft:  merge a partial patch or pass an updater function
 *                - clearDraft:   wipe the stored draft and reset to `initial`
 *                - pending:      the stored draft not yet applied (`"ask"` only)
 *                - restoreDraft: apply `pending`
 */
export function useDraft<T extends object>(
  key: string,
  initial: T,
  options: { restore?: "auto" | "ask" } = {}
): {
  draft: T;
  updateDraft: (patch: Partial<T> | ((prev: T) => T)) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  pending: T | null;
  restoreDraft: () => void;
} {
  const ask = options.restore === "ask";

  // Initialise state from storage on first render (client-side only).
  const [draft, setDraft] = useState<T>(() => {
    const stored = ask ? null : readStored<T>(key);
    return stored ? { ...initial, ...stored } : initial;
  });

  // In "ask" mode the stored draft waits here until the caller applies or
  // discards it. A stored draft identical to `initial` is nothing to offer.
  const [pending, setPending] = useState<T | null>(() => {
    if (!ask) return null;
    const stored = readStored<T>(key);
    if (!stored) return null;
    const merged = { ...initial, ...stored };
    return same(merged, initial) ? null : merged;
  });

  // Track whether a persisted draft actually existed on mount.
  const hasDraft = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = safeLocalStorage.getItem(key);
      hasDraft.current = stored !== null;
    } catch {
      // ignore
    }
    // Only run on mount — key is assumed stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `initial` is read through a ref so the write effect below does not re-run
  // (and re-write) whenever the caller passes a new object.
  const initialRef = useRef(initial);
  initialRef.current = initial;
  // Set once the user has changed something. Until then the stored draft —
  // possibly still pending — is left exactly as it was.
  const touched = useRef(false);

  // Persist to localStorage whenever the draft changes, debounced 400 ms.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        if (!same(draft, initialRef.current)) {
          safeLocalStorage.setItem(key, JSON.stringify(draft));
        } else if (touched.current) {
          // Edited back to where it started: there is no draft any more.
          safeLocalStorage.removeItem(key);
        }
      } catch {
        // Quota exceeded or private-browsing restriction — fail silently.
      }
    }, 400);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [key, draft]);

  const updateDraft = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    touched.current = true;
    setDraft((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const clearDraft = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    setDraft(initialRef.current);
    setPending(null);
    if (typeof window !== "undefined") {
      try {
        safeLocalStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }, [key]);

  const restoreDraft = useCallback(() => {
    if (!pending) return;
    touched.current = true;
    setDraft(pending);
    setPending(null);
  }, [pending]);

  return { draft, updateDraft, clearDraft, hasDraft: hasDraft.current, pending, restoreDraft };
}
