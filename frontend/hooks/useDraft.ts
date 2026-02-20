"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useDraft — persists form draft state to localStorage.
 *
 * Cookie-based persistence was considered, but the instructions field allows
 * up to 5 000 characters, which exceeds the 4 KB per-cookie browser limit.
 * localStorage (5 MB limit) is used instead, keeping the same semantics:
 * the draft survives page refreshes and browser restarts.
 *
 * @param key     Unique storage key (use a workspace-scoped key to avoid collisions)
 * @param initial Default value used when no draft exists
 * @returns       [draft, updateDraft, clearDraft]
 *                - draft:       current draft value
 *                - updateDraft: merge a partial patch or pass an updater function
 *                - clearDraft:  wipe the stored draft and reset to `initial`
 */
export function useDraft<T extends object>(
  key: string,
  initial: T
): {
  draft: T;
  updateDraft: (patch: Partial<T> | ((prev: T) => T)) => void;
  clearDraft: () => void;
  hasDraft: boolean;
} {
  // Initialise state from storage on first render (client-side only).
  const [draft, setDraft] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initial;
      return { ...initial, ...(JSON.parse(stored) as Partial<T>) };
    } catch {
      return initial;
    }
  });

  // Track whether a persisted draft actually existed on mount.
  const hasDraft = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(key);
      hasDraft.current = stored !== null;
    } catch {
      // ignore
    }
    // Only run on mount — key is assumed stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage whenever the draft changes, debounced 400 ms.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // Quota exceeded or private-browsing restriction — fail silently.
      }
    }, 400);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [key, draft]);

  const updateDraft = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      setDraft((prev) =>
        typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
      );
    },
    []
  );

  const clearDraft = useCallback(() => {
    setDraft(initial);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    // `initial` is intentionally excluded — it's a stable reference passed at
    // hook creation and we don't want stale-closure issues from dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { draft, updateDraft, clearDraft, hasDraft: hasDraft.current };
}
