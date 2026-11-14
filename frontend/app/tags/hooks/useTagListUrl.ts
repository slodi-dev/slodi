"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** `/tags?q=út&page=2`, leaving out what is at its default. */
export function tagListUrl(pathname: string, query: string, page: number): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * The search text and page number, started from the URL so refresh and a
 * shared link open the same list (UX rule 10). A new search goes back to the
 * first page. `writeUrl` puts them back.
 */
export function useTagListUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQueryState] = useState(() => searchParams.get("q") ?? "");
  const [page, setPage] = useState(() => parsePage(searchParams.get("page")));

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    setPage(1);
  }, []);

  // The URL as last written, starting from the one the page opened on.
  const lastUrl = useRef<string | null>(null);
  lastUrl.current ??= tagListUrl(
    pathname,
    searchParams.get("q") ?? "",
    parsePage(searchParams.get("page"))
  );

  /** Writes the list state with `replace`, so it doesn't fill the Back history. */
  const writeUrl = useCallback(
    (shownQuery: string, shownPage: number) => {
      const url = tagListUrl(pathname, shownQuery, shownPage);
      if (url === lastUrl.current) return;
      lastUrl.current = url;
      router.replace(url, { scroll: false });
    },
    [pathname, router]
  );

  return { query, setQuery, page, setPage, writeUrl };
}

/** Calls `writeUrl` when the shown state changes, once `enabled` (the list has loaded). */
export function useWriteTagListUrl(
  writeUrl: (query: string, page: number) => void,
  query: string,
  page: number,
  enabled: boolean
) {
  useEffect(() => {
    if (enabled) writeUrl(query, page);
  }, [writeUrl, query, page, enabled]);
}
