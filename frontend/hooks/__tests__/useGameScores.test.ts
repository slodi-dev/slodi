import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameScores } from "../useGameScores";
import type { ScoreEntry } from "@/lib/leikir-games";

// ── Auth mock ────────────────────────────────────────────────────────────────

let mockUser: { sub: string } | null = null;
vi.mock("@auth0/nextjs-auth0", () => ({
  useUser: () => ({ user: mockUser, isLoading: false }),
}));

const SLUG = "laddi-bird";
const PENDING_KEY = `leikir_pending_score_${SLUG}`;

const BOARD: ScoreEntry[] = [
  { user_name: "Signý", score: 42 },
  { user_name: "Halldór", score: 17 },
] as ScoreEntry[];

/** A parked run, in the stored shape: the score plus the token that proves it. */
function parked(score: number, token: string | null = "tok"): string {
  return JSON.stringify({ score, token });
}

/** The score currently parked, whatever the stored encoding. */
function parkedScore(): number | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return Number(JSON.parse(raw).score);
  } catch {
    return Number(raw);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockUser = null;
  sessionStorage.clear();
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse(BOARD)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useGameScores", () => {
  it("loads the board for its own slug on mount", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));

    await waitFor(() => expect(result.current.scores).toEqual(BOARD));
    expect(fetchMock).toHaveBeenCalledWith(`/api/leikir/${SLUG}/scores`);
  });

  it("survives a leaderboard that fails to load", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useGameScores(SLUG));

    // A missing board is not an error the player should see — the game keeps
    // working with an empty list.
    await waitFor(() => expect(result.current.scores).toEqual([]));
    expect(result.current.scoreError).toBeNull();
  });

  it("ignores an error body instead of handing it to the list", async () => {
    // The proxy forwards the backend's status AND body, so a 500 arrives as an
    // object. Storing it would make the leaderboard call .map on a non-array
    // and take the whole game page down on the next render.
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));
    const { result } = renderHook(() => useGameScores(SLUG));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(Array.isArray(result.current.scores)).toBe(true);
    expect(result.current.scores).toEqual([]);
  });

  it("ignores a 200 whose body is not a list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Bad response from backend" }, 200));
    const { result } = renderHook(() => useGameScores(SLUG));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.scores).toEqual([]);
  });

  it("does not let a slow mount fetch overwrite a fresh submission", async () => {
    // The mount GET is issued first but may resolve last. If it won, the player
    // would watch their just-earned placing vanish.
    let resolveGet: (v: unknown) => void = () => {};
    const slowGet = new Promise((resolve) => {
      resolveGet = resolve;
    });
    fetchMock.mockImplementationOnce(() => slowGet);

    const { result } = renderHook(() => useGameScores(SLUG));

    const updated: ScoreEntry[] = [{ user_name: "Halldór", score: 99 }] as ScoreEntry[];
    fetchMock.mockResolvedValueOnce(jsonResponse(updated));
    act(() => result.current.handleGameOver(99));
    await waitFor(() => expect(result.current.scores).toEqual(updated));

    // Now let the stale GET land.
    await act(async () => {
      resolveGet(jsonResponse(BOARD));
      await slowGet;
    });

    expect(result.current.scores).toEqual(updated);
  });

  it("submits a score and reveals the refreshed board", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    const updated: ScoreEntry[] = [{ user_name: "Nýr", score: 99 }] as ScoreEntry[];
    fetchMock.mockResolvedValueOnce(jsonResponse(updated));

    act(() => result.current.handleGameOver(99));

    await waitFor(() => expect(result.current.leaderboardVisible).toBe(true));
    expect(result.current.scores).toEqual(updated);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/leikir/${SLUG}/scores`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ score: 99 }) })
    );
  });

  it("does not post a zero score", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));
    fetchMock.mockClear();

    act(() => result.current.handleGameOver(0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parks the score and offers a login when the player is signed out", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(55));

    await waitFor(() => expect(result.current.loginHref).toBeTruthy());
    // Losing a good run to a missing session is the thing this prevents.
    expect(parkedScore()).toBe(55);
    expect(result.current.loginHref).toBe(`/auth/login?returnTo=/leikir/${SLUG}`);
    expect(result.current.leaderboardVisible).toBe(true);
  });

  it("posts the parked score once the player returns signed in", async () => {
    sessionStorage.setItem(PENDING_KEY, parked(55));
    mockUser = { sub: "auth0|1" };

    const updated: ScoreEntry[] = [{ user_name: "Halldór", score: 55 }] as ScoreEntry[];
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(jsonResponse(init?.method === "POST" ? updated : BOARD))
    );

    const { result } = renderHook(() => useGameScores(SLUG));

    await waitFor(() => expect(result.current.scores).toEqual(updated));
    expect(result.current.leaderboardVisible).toBe(true);
    // Consumed, so a page refresh does not post it a second time.
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("carries a parked run into the next submission", async () => {
    // The parked value is retried on the player's very next game over, rather
    // than sitting until a page reload.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too many" }, 429));
    act(() => result.current.handleGameOver(120));
    await waitFor(() => expect(parkedScore()).toBe(120));

    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse(BOARD));
    act(() => result.current.handleGameOver(5)); // a much worse run

    // The 120 is what reaches the server — a worse run must not bury it.
    await waitFor(() => expect(sessionStorage.getItem(PENDING_KEY)).toBeNull());
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/leikir/${SLUG}/scores`,
      expect.objectContaining({ body: JSON.stringify({ score: 120 }) })
    );
  });

  it("parks the run when the server errors, instead of losing it", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));
    act(() => result.current.handleGameOver(77));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(parkedScore()).toBe(77);
  });

  it("parks the run when the network is down", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.handleGameOver(64));

    await waitFor(() => expect(parkedScore()).toBe(64));
  });

  it("keeps the parked score when the replay is rate limited", async () => {
    // A 429 on the post-login replay is retryable, not a rejection — deleting
    // the score here would destroy exactly what parking exists to protect.
    sessionStorage.setItem(PENDING_KEY, parked(55));
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST" ? jsonResponse({ detail: "Too many" }, 429) : jsonResponse(BOARD)
      )
    );

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    expect(parkedScore()).toBe(55);
  });

  it("keeps the parked score when the replay hits a server error", async () => {
    // Discarding here would destroy the run the parking mechanism exists to
    // protect, with nothing shown to the player.
    sessionStorage.setItem(PENDING_KEY, parked(55));
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST" ? jsonResponse({ detail: "boom" }, 500) : jsonResponse(BOARD)
      )
    );

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    expect(parkedScore()).toBe(55);
  });

  it("keeps the parked score when the replay is still unauthorised", async () => {
    sessionStorage.setItem(PENDING_KEY, parked(55));
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST" ? jsonResponse({ error: "Unauthorized" }, 401) : jsonResponse(BOARD)
      )
    );

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    expect(parkedScore()).toBe(55);
  });

  it("keeps the best run when a signed-out player plays again", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(40));
    await waitFor(() => expect(parkedScore()).toBe(40));

    // Player dismisses the prompt, plays a worse round.
    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(5));

    await waitFor(() => expect(result.current.loginHref).toBeTruthy());
    expect(parkedScore()).toBe(40);
  });

  it("parks the score and says so plainly when rate limited", async () => {
    // A 429 means "slow down", not "your run is gone" — reporting it as a save
    // failure would be both alarming and wrong.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too many requests" }, 429));
    act(() => result.current.handleGameOver(31));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(result.current.scoreError).not.toBe("Villa við að vista stig");
    expect(parkedScore()).toBe(31);
    expect(result.current.leaderboardVisible).toBe(true);
  });

  it("keeps the best run when rate limited more than once", async () => {
    // At 30/min with ~8s runs a mashing player will hit the cap repeatedly. A
    // later 1-point run must not overwrite the 120 waiting to be replayed.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too many" }, 429));
    act(() => result.current.handleGameOver(120));
    await waitFor(() => expect(parkedScore()).toBe(120));

    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too many" }, 429));
    act(() => result.current.handleGameOver(1));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(parkedScore()).toBe(120);
  });

  it("clears the parked score once a better run reaches the board", async () => {
    // Otherwise it is re-posted on the next page load, re-opening the board and
    // spending another slot of the rate budget on a run already represented.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too many" }, 429));
    act(() => result.current.handleGameOver(10));
    await waitFor(() => expect(parkedScore()).toBe(10));

    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse(BOARD));
    act(() => result.current.handleGameOver(12));

    await waitFor(() => expect(sessionStorage.getItem(PENDING_KEY)).toBeNull());
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/leikir/${SLUG}/scores`,
      expect.objectContaining({ body: JSON.stringify({ score: 12 }) })
    );
  });

  it("does not re-open the board over a run the player already restarted", async () => {
    // Laddí-bird restarts on the next tap, so a POST resolving ~300ms later
    // would slide the sheet up over most of a live game on a phone.
    let resolvePost: (v: unknown) => void = () => {};
    const slowPost = new Promise((resolve) => {
      resolvePost = resolve;
    });

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockImplementationOnce(() => slowPost);
    act(() => result.current.handleGameOver(9));
    act(() => result.current.handleRestart()); // player taps to play again

    await act(async () => {
      resolvePost(jsonResponse(BOARD));
      await slowPost;
    });

    expect(result.current.leaderboardVisible).toBe(false);
  });

  it("does not park a permanently rejected score", async () => {
    // Every submission sends max(thisRun, parked), so parking a value the
    // server will always reject would re-send it after every later run and lock
    // the player out of the board for the rest of the session.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "invalid" }, 422));
    act(() => result.current.handleGameOver(50));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();

    // The next ordinary run goes through untainted.
    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse(BOARD));
    act(() => result.current.handleGameOver(8));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({ body: JSON.stringify({ score: 8 }) })
      )
    );
  });

  it("does not re-open a board the player explicitly dismissed", async () => {
    let resolvePost: (v: unknown) => void = () => {};
    const slowPost = new Promise((resolve) => {
      resolvePost = resolve;
    });

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockImplementationOnce(() => slowPost);
    act(() => result.current.handleGameOver(9));
    act(() => result.current.hideLeaderboard()); // taps the handle to close it

    await act(async () => {
      resolvePost(jsonResponse(BOARD));
      await slowPost;
    });

    expect(result.current.leaderboardVisible).toBe(false);
  });

  it("does not re-open the board when the post-login replay resolves mid-run", async () => {
    // The player is returned to the game page after logging in, taps straight
    // into a run, and the replay POST lands a few hundred ms later.
    sessionStorage.setItem(PENDING_KEY, parked(55));
    mockUser = { sub: "auth0|1" };
    let resolvePost: (v: unknown) => void = () => {};
    const slowPost = new Promise((resolve) => {
      resolvePost = resolve;
    });
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST" ? slowPost : Promise.resolve(jsonResponse(BOARD))
    );

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    act(() => result.current.handleRestart()); // player starts flying

    await act(async () => {
      resolvePost(jsonResponse(BOARD));
      await slowPost;
    });

    expect(result.current.leaderboardVisible).toBe(false);
  });

  it("does not clear a higher score parked while an older submit was in flight", async () => {
    // Run A (20) stalls; run B (3) succeeds later. A then fails and parks 20.
    // B's success must not wipe a score the server never saw.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    let resolveB: (v: unknown) => void = () => {};
    const slowB = new Promise((resolve) => {
      resolveB = resolve;
    });
    fetchMock.mockImplementationOnce(() => slowB);
    act(() => result.current.handleGameOver(3));

    // Meanwhile the earlier, better run fails and parks itself.
    sessionStorage.setItem(PENDING_KEY, parked(20));

    await act(async () => {
      resolveB(jsonResponse(BOARD));
      await slowB;
    });

    expect(parkedScore()).toBe(20);
  });

  it("stamps the start of a run with the server before playing", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));
    fetchMock.mockClear();

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "signed-token" }));
    act(() => result.current.startRun());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/leikir/${SLUG}/runs`,
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("submits the run token it was issued", async () => {
    // Without it the backend refuses the score, which is what stops a bare
    // fetch in the console from posting an arbitrary number.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "signed-token" }));
    act(() => result.current.startRun());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fetchMock.mockResolvedValueOnce(jsonResponse(BOARD));
    act(() => result.current.handleGameOver(9));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({
          body: JSON.stringify({ score: 9, run_token: "signed-token" }),
        })
      )
    );
  });

  it("saves a signed-out run end to end, across the login round trip", async () => {
    // The flow finding 1 of the review found broken: /runs must work without a
    // session, or a signed-out player's run can never be saved at all.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/runs")) {
        // Anonymous mint — no session needed.
        return Promise.resolve(jsonResponse({ run_token: "anon-token" }));
      }
      if (init?.method === "POST") return Promise.resolve(jsonResponse({}, 401));
      return Promise.resolve(jsonResponse(BOARD));
    });

    const signedOut = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(signedOut.result.current.scores).toEqual(BOARD));

    act(() => signedOut.result.current.startRun());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    act(() => signedOut.result.current.handleGameOver(40));
    await waitFor(() => expect(signedOut.result.current.loginHref).toBeTruthy());

    // Parked with the token that proves when the run started.
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!)).toEqual({
      score: 40,
      token: "anon-token",
    });

    // Now the player logs in and comes back to the page.
    signedOut.unmount();
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(BOARD)));
    renderHook(() => useGameScores(SLUG));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({
          body: JSON.stringify({ score: 40, run_token: "anon-token" }),
        })
      )
    );
    await waitFor(() => expect(sessionStorage.getItem(PENDING_KEY)).toBeNull());
  });

  it("does not reuse a spent token on the next run", async () => {
    // Submitting a burned token earns a 409, which is permanent — it would
    // throw away a legitimate score.
    let minted = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/runs")) {
        minted += 1;
        return Promise.resolve(jsonResponse({ run_token: `tok-${minted}` }));
      }
      if (init?.method === "POST") return Promise.resolve(jsonResponse(BOARD));
      return Promise.resolve(jsonResponse(BOARD));
    });

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    act(() => result.current.startRun());
    await waitFor(() => expect(minted).toBe(1));
    act(() => result.current.handleGameOver(5));
    await waitFor(() => expect(result.current.leaderboardVisible).toBe(true));

    // Second run: its /runs call has not resolved yet when the player dies.
    act(() => result.current.handleRestart());
    fetchMock.mockImplementationOnce(() => new Promise(() => {})); // never resolves
    act(() => result.current.startRun());
    act(() => result.current.handleGameOver(6));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/leikir/${SLUG}/scores`,
        // No token at all is right here; tok-1 is spent and would 409.
        expect.objectContaining({ body: JSON.stringify({ score: 6 }) })
      )
    );
  });

  it("parks the run token alongside the score so it survives login", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "signed-token" }));
    act(() => result.current.startRun());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(40));

    await waitFor(() => expect(result.current.loginHref).toBeTruthy());
    const stored = JSON.parse(sessionStorage.getItem(PENDING_KEY)!);
    expect(stored).toEqual({ score: 40, token: "signed-token" });
  });

  it("replays a parked run with its original token", async () => {
    sessionStorage.setItem(PENDING_KEY, parked(40, "original-token"));
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(jsonResponse(init?.method === "POST" ? BOARD : BOARD))
    );

    renderHook(() => useGameScores(SLUG));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({
          body: JSON.stringify({ score: 40, run_token: "original-token" }),
        })
      )
    );
  });

  it("still reads a score parked before run tokens existed", async () => {
    // Sessions open across the deploy have a bare number in storage.
    sessionStorage.setItem(PENDING_KEY, "33");
    mockUser = { sub: "auth0|1" };
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(BOARD)));

    renderHook(() => useGameScores(SLUG));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({ body: JSON.stringify({ score: 33 }) })
      )
    );
  });

  it("treats an already-recorded run as saved, not failed", async () => {
    // A 409 means an earlier attempt reached the server and its reply was lost.
    // Retrying for ever, or reporting a failure, both lose a stored score.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "already recorded" }, 409));
    act(() => result.current.handleGameOver(11));

    await waitFor(() => expect(result.current.leaderboardVisible).toBe(true));
    expect(result.current.scoreError).toBeNull();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("keeps a run whose token was missing, rather than discarding it", async () => {
    // 403 means "unprovable", not "invalid" — the mint call failed or was rate
    // limited. The run is good and must survive to be proved later.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "requires a run token" }, 403));
    act(() => result.current.handleGameOver(18));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(parkedScore()).toBe(18);
  });

  it("lends the next minted token to a run parked without one", async () => {
    // Otherwise that run can never be proved and is refused for ever.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "no token" }, 403));
    act(() => result.current.handleGameOver(18));
    await waitFor(() => expect(parkedScore()).toBe(18));
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!).token).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "fresh" }));
    act(() => result.current.startRun());

    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!).token).toBe("fresh")
    );
    expect(parkedScore()).toBe(18);
  });

  it("does not retire a newer run's token when an older submit lands", async () => {
    // Run 1's POST can resolve after run 2 has already minted its token.
    // Nulling it there would leave run 2 unprovable.
    let resolveFirst: (v: unknown) => void = () => {};
    const slowFirst = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "tok-1" }));
    act(() => result.current.startRun());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fetchMock.mockImplementationOnce(() => slowFirst);
    act(() => result.current.handleGameOver(4)); // run 1 submits, stalls

    act(() => result.current.handleRestart());
    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "tok-2" }));
    act(() => result.current.startRun()); // run 2 mints its own
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    await act(async () => {
      resolveFirst(jsonResponse(BOARD)); // run 1 finally lands
      await slowFirst;
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(BOARD));
    act(() => result.current.handleGameOver(6));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/leikir/${SLUG}/scores`,
        expect.objectContaining({
          body: JSON.stringify({ score: 6, run_token: "tok-2" }),
        })
      )
    );
  });

  it("keeps a run whose token is not yet old enough to justify it", async () => {
    // The pace check is "not yet", not "never" — the same run against the same
    // token passes once enough time has elapsed. Round 3 of review found the
    // token-lending fix destroying runs here.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "too early" }, 425));
    act(() => result.current.handleGameOver(12));

    await waitFor(() => expect(result.current.scoreError).toBeTruthy());
    expect(parkedScore()).toBe(12);
  });

  it("drops a token the server rejected so the next run can lend a live one", async () => {
    // A token expired overnight or invalidated by a key rotation is dead. Keeping
    // it would 403 on every future attempt for the rest of the session.
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "stale" }));
    act(() => result.current.startRun());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "bad signature" }, 403));
    act(() => result.current.handleGameOver(40));

    await waitFor(() => expect(parkedScore()).toBe(40));
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!).token).toBeNull();

    // And the next run hands it a working one.
    fetchMock.mockResolvedValueOnce(jsonResponse({ run_token: "fresh" }));
    act(() => result.current.startRun());
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!).token).toBe("fresh")
    );
  });

  it("discards a parked score that is not a usable number", async () => {
    sessionStorage.setItem(PENDING_KEY, "not-a-score");
    mockUser = { sub: "auth0|1" };

    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows an error when submission fails outright", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    act(() => result.current.handleGameOver(12));

    await waitFor(() => expect(result.current.scoreError).toContain("Villa við að vista stig"));
    expect(result.current.leaderboardVisible).toBe(true);
    // A 500 is retryable, so the run is parked rather than dropped.
    expect(parkedScore()).toBe(12);
  });

  it("clears the login prompt and error when a new run starts", async () => {
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(55));
    await waitFor(() => expect(result.current.loginHref).toBeTruthy());

    act(() => result.current.handleRestart());

    expect(result.current.loginHref).toBeUndefined();
    expect(result.current.scoreError).toBeNull();
    expect(result.current.leaderboardVisible).toBe(false);
  });

  it("keeps each game's parked score separate", async () => {
    renderHook(() => useGameScores("horpuhopp"));
    const { result } = renderHook(() => useGameScores(SLUG));
    await waitFor(() => expect(result.current.scores).toEqual(BOARD));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401));
    act(() => result.current.handleGameOver(7));

    await waitFor(() => expect(parkedScore()).toBe(7));
    expect(sessionStorage.getItem("leikir_pending_score_horpuhopp")).toBeNull();
  });
});
