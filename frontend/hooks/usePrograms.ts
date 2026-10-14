"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { handleApiError } from "@/lib/api-utils";
import {
  fetchContentFacets,
  fetchPrograms,
  type ContentFacets,
  type ContentQuery,
  type Program,
} from "@/services/programs.service";

const EMPTY_FACETS: ContentFacets = { locations: [], equipment: [], authors: [], tags: [] };

type UseProgramsResult = {
  /** How many the bank holds *for the current filters*, not how many were fetched. */
  total: number | null;
  /** The current page. Never the whole bank — that is ten thousand rows. */
  programs: Program[] | null;
  /** Option lists for the sidebar, across the whole bank rather than this page. */
  facets: ContentFacets;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * One page of the bank.
 *
 * Filtering, sorting and paging all happen on the server. They used to happen
 * in the browser over a flat `limit=200`, which meant the bank quietly showed
 * 200 of 10.004 rows: page two of a filtered view was page two *of the first
 * 200*, and a filter matching nothing in that slice reported an empty bank.
 *
 * The previous page stays on screen while the next one loads. Blanking the
 * grid on every keystroke is how a list that is merely fetching comes to look
 * like a list that is empty.
 */
export default function usePrograms(
  workspaceId: string | null,
  options: { query?: ContentQuery; page?: number; pageSize?: number } = {}
): UseProgramsResult {
  const { getToken } = useAuth();
  const { query = {}, page = 1, pageSize = 24 } = options;

  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [facets, setFacets] = useState<ContentFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /* Serialised so the effect depends on the *contents* of the query, not on a
     fresh object identity every render. */
  const queryKey = JSON.stringify(query);

  /* A late response for a page the reader has already left must not overwrite
     the newer one. Requests are numbered and only the newest is allowed to
     land. The effect's request is also aborted when it is left behind. */
  const requestId = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      const stale = () => id !== requestId.current || signal?.aborted === true;
      setLoading(true);
      setError(null);
      try {
        const { items, total: count } = await fetchPrograms(workspaceId, getToken, {
          query: JSON.parse(queryKey) as ContentQuery,
          limit: pageSize,
          offset: Math.max(0, (page - 1) * pageSize),
          signal,
        });
        if (stale()) return;
        setPrograms(items);
        setTotal(count);
      } catch (err) {
        if (stale()) return;
        setError(new Error(handleApiError(err, "Failed to fetch programs")));
        setPrograms([]);
        setTotal(0);
      } finally {
        if (!stale()) setLoading(false);
      }
    },
    [workspaceId, getToken, queryKey, page, pageSize]
  );

  /* No debounce here. The first load and a page click start their request at
     once. The one input that changes on every keystroke, the search box,
     already debounces itself before the query moves; a second delay here made
     typed search wait twice and everything else wait once for nothing
     (sc-615). */
  useEffect(() => {
    /* Aborted by a newer page or query, an unmount, or StrictMode's rehearsal
       unmount in development. The real call awaits the token before it
       fetches, so a request abandoned in the same tick never reaches the
       network. */
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Not `load` itself: a retry button would hand it its click event.
  const refetch = useCallback(() => load(), [load]);

  /* Facets describe the bank, not the page, so they are fetched once per
     workspace rather than with every filter change. */
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchContentFacets(workspaceId, getToken)
      .then((f) => {
        if (!cancelled) setFacets(f);
      })
      // A missing facet list narrows the sidebar's suggestions; it must not
      // take the grid down with it.
      .catch(() => {
        if (!cancelled) setFacets(EMPTY_FACETS);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, getToken]);

  return { programs, total, facets, loading, error, refetch };
}

export type { Program };
