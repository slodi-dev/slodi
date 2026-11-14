"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useMockMode } from "@/lib/mock/mock-mode";
import { isMockSeasonId, mockGrid, mockSeasons } from "@/lib/mock/plan.mock";
import { mockBench } from "@/lib/mock/bench.mock";
import { LIBRARY, type LibraryBlock } from "@/lib/mock/library.mock";
import {
  compareSeasons,
  createSeason,
  getSeasonGrid,
  getSeasons,
  type Season,
  type SeasonCreate,
} from "@/services/plan.service";

/**
 * The single source the plan views read from (A1, sc-34).
 *
 * ADR-002 §2 is explicit that the grid, the per-flokkur timeline and the month
 * calendar are *projections of one dataset*, not separate tools. That only holds
 * if they share a fetch, so every A-cluster view is meant to hang off this hook
 * rather than call the service itself.
 *
 * Mock mode (lib/mock/mock-mode.ts) is wired in here rather than inside the
 * service, so the service stays a plain description of the API contract and the
 * fixtures never sit on the path a real request takes. Two consequences worth
 * knowing:
 *
 * - In `auto` the real query still runs, unchanged. Fixtures are substituted
 *   *after* it has failed, which is what makes the flip back automatic: as soon
 *   as the endpoint answers there is no error, so there is no substitution.
 * - Forced-on fixtures are cached under their own keys. Sharing a key with the
 *   real query would leave fixtures in the cache under a key the live fetch
 *   later trusts.
 *
 * Both hooks report `isMock` so the shell can label what it is showing. Nothing
 * renders fixtures without saying so.
 */

export const planKeys = {
  seasons: (workspaceId: string) => ["plan", "seasons", workspaceId] as const,
  grid: (seasonId: string) => ["plan", "grid", seasonId] as const,
  mockSeasons: ["plan", "seasons", "__mock__"] as const,
  mockGrid: (seasonId: string) => ["plan", "grid", "__mock__", seasonId] as const,
};

export function useSeasons(
  workspaceId: string | null,
  /**
   * Set when the workspace lookup itself has given up. The seasons query never
   * runs without a workspace, so it can never fail, so `auto` would otherwise
   * sit on a spinner rather than falling back.
   */
  options: { workspaceUnavailable?: boolean } = {}
) {
  const { getToken } = useAuth();
  const { mode, settled } = useMockMode();
  const forced = mode === "on";

  const query = useQuery({
    queryKey: forced ? planKeys.mockSeasons : planKeys.seasons(workspaceId ?? "none"),
    // Fixtures need no workspace, which is the point: the workspace lookup is
    // one more thing that can be down while you are trying to look at a view.
    // Nothing runs before the mode is known, or a forced-off run would still
    // fire the request it was told not to.
    enabled: settled && (forced || Boolean(workspaceId)),
    queryFn: () =>
      forced ? Promise.resolve(mockSeasons()) : getSeasons(workspaceId as string, getToken),
    // A missing endpoint is a deployment fact, not a blip — retrying just
    // delays the empty state the shell is going to show anyway.
    retry: 1,
  });

  const fellBack =
    mode === "auto" && (Boolean(query.error) || Boolean(options.workspaceUnavailable));
  const isMock = forced || fellBack;

  const seasons = useMemo(
    () => [...(fellBack ? mockSeasons() : (query.data ?? []))].sort(compareSeasons),
    // `fellBack` is a boolean and `query.data` a stable reference, so the
    // fixture array is built once rather than on every render — which matters
    // because the shell has an effect keyed on this list.
    [fellBack, query.data]
  );

  return {
    seasons,
    isMock,
    // `isPending`, not `isLoading`: v5 derives isLoading as isPending &&
    // isFetching, which is false on the single render where a query flips from
    // disabled to enabled — long enough to flash "you have no starfsár".
    isLoading: !settled || (query.isPending && !fellBack),
    // A handled failure is not a failure to report: in auto mode the fixtures
    // are the answer, and the banner already says they are not real.
    error: fellBack ? null : query.error,
    refetch: query.refetch,
  };
}

export function useCreateSeason(workspaceId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<SeasonCreate, "workspace_id">) => {
      // The workspace id resolves asynchronously, and it is interpolated
      // straight into the URL — without this a call made too early POSTs to
      // /workspaces/null/seasons and 404s for a reason nobody can read.
      if (!workspaceId) {
        return Promise.reject(new Error("Workspace is not resolved yet"));
      }
      return createSeason({ ...payload, workspace_id: workspaceId }, getToken);
    },
    onSuccess: (created: Season) => {
      queryClient.setQueryData<Season[]>(planKeys.seasons(created.workspace_id), (previous) =>
        previous ? [...previous, created] : [created]
      );
    },
  });
}

/**
 * The week×flokkur matrix for a season (A2, sc-37).
 *
 * Keyed by season, so switching seasons in the shell swaps the whole grid
 * without the views needing to know that happened.
 */
export function usePlanGrid(seasonId: string | null) {
  const { getToken } = useAuth();
  const { mode, settled } = useMockMode();
  // A fixture season can only be served by fixtures, whatever the mode: the API
  // has never heard of this id.
  const fixtureSeason = seasonId !== null && isMockSeasonId(seasonId);
  const forced = mode === "on" || fixtureSeason;

  const query = useQuery({
    queryKey: forced ? planKeys.mockGrid(seasonId ?? "none") : planKeys.grid(seasonId ?? "none"),
    enabled: settled && Boolean(seasonId),
    queryFn: () =>
      forced
        ? Promise.resolve(mockGrid(seasonId as string))
        : getSeasonGrid(seasonId as string, getToken),
    retry: 1,
  });

  // The seasons endpoint can exist before the grid one does, so this falls back
  // on its own rather than inheriting the seasons hook's verdict.
  const fellBack = mode === "auto" && !forced && Boolean(query.error) && seasonId !== null;

  const grid = useMemo(
    () => (fellBack ? mockGrid(seasonId as string) : (query.data ?? null)),
    [fellBack, seasonId, query.data]
  );

  return {
    grid,
    isMock: forced || fellBack,
    isLoading: !settled || (query.isPending && !fellBack),
    error: fellBack ? null : query.error,
  };
}

/**
 * The bench's fundir for a season (B-cluster).
 *
 * Fixtures only, and deliberately so: unlike the grid there is not even a
 * *contract* path for the assembly of a fundur yet, so there is nothing to fall
 * back from. When that endpoint is designed this becomes a real query with the
 * same auto-fallback shape as `usePlanGrid`, and the only thing that should have
 * to change here is the queryFn.
 *
 * `?mock=0` therefore leaves the bench empty rather than pretending — which is
 * the honest answer to "what does the backend give me today".
 */
export function usePlanBench(seasonId: string | null) {
  const { mode, settled } = useMockMode();
  const useFixture = settled && seasonId !== null && mode !== "off";

  const data = useMemo(
    () => (useFixture ? mockBench(seasonId as string) : null),
    [useFixture, seasonId]
  );

  return { data, isMock: useFixture, isLoading: !settled };
}

/**
 * The dagskrárbankinn the left rail lists.
 *
 * Fixtures only, like the bench, and gated exactly the same way — a rail that
 * rendered its fixtures unconditionally would put a fully populated fake
 * programme bank in front of a real leader with no banner over it, because
 * production forces the mode to "off" and so `showingMock` would be false.
 * That is precisely the failure lib/mock/mock-mode.ts exists to rule out.
 */
export function useBlockLibrary(): {
  blocks: LibraryBlock[];
  isMock: boolean;
  isLoading: boolean;
} {
  const { mode, settled } = useMockMode();
  const useFixture = settled && mode !== "off";

  return {
    blocks: useFixture ? LIBRARY : [],
    isMock: useFixture,
    isLoading: !settled,
  };
}
