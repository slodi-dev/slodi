"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { listStateUrl, readListState, type ListState, type PermissionFilter } from "./userRules";

/**
 * The search, filter, page and selected user, started from the URL so a refresh
 * or a shared link opens the same view (UX rule 10). A new search or filter goes
 * back to the first page.
 */
export function useUserListUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<ListState>(() => readListState(searchParams));

  const setQuery = useCallback((query: string) => setState((s) => ({ ...s, query, page: 1 })), []);
  const setPermission = useCallback(
    (permission: PermissionFilter) => setState((s) => ({ ...s, permission, page: 1 })),
    []
  );
  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), []);
  const setSelectedId = useCallback(
    (selectedId: string | null) => setState((s) => ({ ...s, selectedId })),
    []
  );
  const resetFilters = useCallback(
    () => setState((s) => ({ ...s, query: "", permission: "all", page: 1 })),
    []
  );

  // The URL as last written, starting from the one the page opened on.
  const lastUrl = useRef<string | null>(null);
  lastUrl.current ??= listStateUrl(pathname, readListState(searchParams));

  /** Writes the shown state with `replace`, so it doesn't fill the Back history. */
  const writeUrl = useCallback(
    (shown: ListState) => {
      const url = listStateUrl(pathname, shown);
      if (url === lastUrl.current) return;
      lastUrl.current = url;
      router.replace(url, { scroll: false });
    },
    [pathname, router]
  );

  return { ...state, setQuery, setPermission, setPage, setSelectedId, resetFilters, writeUrl };
}

/** Calls `writeUrl` when the shown state changes, once `enabled` (the list has loaded). */
export function useWriteUserListUrl(
  writeUrl: (shown: ListState) => void,
  shown: ListState,
  enabled: boolean
) {
  const { query, permission, page, selectedId } = shown;
  useEffect(() => {
    if (enabled) writeUrl({ query, permission, page, selectedId });
  }, [writeUrl, query, permission, page, selectedId, enabled]);
}
