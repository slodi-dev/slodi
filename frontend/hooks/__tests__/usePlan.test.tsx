import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSeasons, usePlanGrid } from "../usePlan";
import { MOCK_SEASON_ID } from "@/lib/mock/plan.mock";
import * as planService from "@/services/plan.service";
import type { Season } from "@/services/plan.service";

/**
 * The point of auto mode is that nobody has to turn it off. That is a claim
 * about a transition — fixtures now, real data the moment the endpoint exists —
 * and a test that only ever checks one of the two states cannot tell whether
 * the transition happens at all. "flips back to real data" below is the one
 * that matters; the rest pin the edges around it.
 */

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken: async () => "test-token" }),
}));

vi.mock("@/services/plan.service", async (importOriginal) => {
  const actual = await importOriginal<typeof planService>();
  return { ...actual, getSeasons: vi.fn(), getSeasonGrid: vi.fn() };
});

const getSeasons = vi.mocked(planService.getSeasons);
const getSeasonGrid = vi.mocked(planService.getSeasonGrid);

const WORKSPACE = "ws-1";

const REAL_SEASON: Season = {
  id: "real-1",
  workspace_id: WORKSPACE,
  name: "Starfsárið 2026–27",
  kind: "starfsar",
  starts_on: "2026-09-07",
  ends_on: "2027-05-31",
  created_at: "2026-08-01T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  // `retry: false` at the client level does not override the hooks' own
  // `retry: 1`, so failures still take one backoff — hence the waitFor
  // timeouts below rather than bare assertions.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setSearch(search: string) {
  window.history.replaceState({}, "", `/builder${search}`);
}

describe("useSeasons", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setSearch("");
    vi.clearAllMocks();
  });

  it("stands in with fixtures when the endpoint is missing", async () => {
    getSeasons.mockRejectedValue(new Error("404 Not Found"));

    const { result } = renderHook(() => useSeasons(WORKSPACE), { wrapper });

    await waitFor(() => expect(result.current.isMock).toBe(true), { timeout: 4000 });
    expect(result.current.seasons.length).toBeGreaterThan(0);
    expect(result.current.seasons[0].name).toContain("GERVIGÖGN");
    // A handled failure is not a failure to report.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("uses the real data and never labels it as mock when the endpoint works", async () => {
    getSeasons.mockResolvedValue([REAL_SEASON]);

    const { result } = renderHook(() => useSeasons(WORKSPACE), { wrapper });

    await waitFor(() => expect(result.current.seasons).toHaveLength(1));
    expect(result.current.isMock).toBe(false);
    expect(result.current.seasons[0].name).toBe("Starfsárið 2026–27");
  });

  it("flips back to real data on its own once the endpoint answers", async () => {
    getSeasons.mockRejectedValue(new Error("404 Not Found"));

    const { result } = renderHook(() => useSeasons(WORKSPACE), { wrapper });
    await waitFor(() => expect(result.current.isMock).toBe(true), { timeout: 4000 });

    // The backend ships.
    getSeasons.mockResolvedValue([REAL_SEASON]);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.isMock).toBe(false));
    expect(result.current.seasons).toHaveLength(1);
    expect(result.current.seasons[0].id).toBe("real-1");
  });

  it("stands in when the workspace itself never resolves", async () => {
    // The query is disabled without a workspace, so it can never fail — auto
    // mode has to be told, or it waits for ever.
    const { result } = renderHook(() => useSeasons(null, { workspaceUnavailable: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isMock).toBe(true));
    expect(getSeasons).not.toHaveBeenCalled();
  });

  it("surfaces the failure instead of hiding it under ?mock=0", async () => {
    setSearch("?mock=0");
    getSeasons.mockRejectedValue(new Error("404 Not Found"));

    const { result } = renderHook(() => useSeasons(WORKSPACE), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 4000 });
    expect(result.current.isMock).toBe(false);
    expect(result.current.seasons).toHaveLength(0);
  });

  it("uses fixtures under ?mock=1 without asking the API at all", async () => {
    setSearch("?mock=1");
    getSeasons.mockResolvedValue([REAL_SEASON]);

    const { result } = renderHook(() => useSeasons(WORKSPACE), { wrapper });

    await waitFor(() => expect(result.current.isMock).toBe(true));
    expect(getSeasons).not.toHaveBeenCalled();
  });
});

describe("usePlanGrid", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setSearch("");
    vi.clearAllMocks();
  });

  it("never asks the API for a season only the fixtures know about", async () => {
    const { result } = renderHook(() => usePlanGrid(MOCK_SEASON_ID), { wrapper });

    await waitFor(() => expect(result.current.grid).not.toBeNull());
    expect(result.current.isMock).toBe(true);
    expect(getSeasonGrid).not.toHaveBeenCalled();
  });

  it("falls back on its own when seasons are real but the grid endpoint is not", async () => {
    getSeasonGrid.mockRejectedValue(new Error("404 Not Found"));

    const { result } = renderHook(() => usePlanGrid("real-1"), { wrapper });

    await waitFor(() => expect(result.current.isMock).toBe(true), { timeout: 4000 });
    expect(getSeasonGrid).toHaveBeenCalled();
    expect(result.current.grid?.patrols.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it("uses the real grid when it is there", async () => {
    getSeasonGrid.mockResolvedValue({
      season_id: "real-1",
      patrols: [{ id: "p1", name: "Refir" }],
      weeks: [{ index: 1, starts_on: "2026-09-07", label: "Vika 1" }],
      bands: [],
      cells: [],
    });

    const { result } = renderHook(() => usePlanGrid("real-1"), { wrapper });

    await waitFor(() => expect(result.current.grid).not.toBeNull());
    expect(result.current.isMock).toBe(false);
    expect(result.current.grid?.patrols).toHaveLength(1);
  });
});
