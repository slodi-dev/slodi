/**
 * Typed wrapper around the Heiðursorðla backend endpoints.
 *
 * The schemas mirror `backend/app/schemas/heidursordla.py` (Phase 1).
 *
 * NOTE on `submitGuess`: it intentionally does NOT use `fetchWithAuth`
 * because that helper flattens 4xx error bodies into a string, destroying
 * the typed `{error_code, detail}` shape. We do a raw fetch here and inspect
 * the status code so the caller can pattern-match on `error_code`.
 */

import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────
// Types — mirror backend/app/schemas/heidursordla.py
// ─────────────────────────────────────────────────────────────────────────

export type GuessColor = "green" | "yellow" | "gray";

export type HeidursordlaAttemptStatus = "in_progress" | "won" | "lost";

export type GuessRow = {
  word: string;
  colors: GuessColor[];
};

export type PuzzleSummary = {
  id: string;
  puzzle_number: number;
  word_length: number;
  unlocks_at: string;
  locks_at: string;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  user_name: string;
  guesses_used: number;
  finished_at: string;
  guess_colors: GuessColor[][];
};

export type ArchivePuzzle = {
  id: string;
  puzzle_number: number;
  word_length: number;
  unlocks_at: string;
  locks_at: string;
  answer: string;
  leaderboard: LeaderboardEntry[];
};

// ── GET /today — discriminated union ─────────────────────────────────────

export type TodayActive = {
  event_ended: false;
  puzzle: PuzzleSummary;
  next_round_at: string | null;
};

export type TodayWaiting = {
  event_ended: false;
  puzzle: null;
  next_round_at: string;
};

export type TodayEnded = {
  event_ended: true;
  puzzles: ArchivePuzzle[];
};

export type TodayResponse = TodayActive | TodayWaiting | TodayEnded;

// ── GET /{puzzle_id} — discriminated on is_unlocked ──────────────────────

export type PuzzleStateLocked = {
  is_unlocked: false;
  puzzle: PuzzleSummary;
};

export type PuzzleStateOpen = {
  is_unlocked: true;
  puzzle: PuzzleSummary;
  status: HeidursordlaAttemptStatus;
  guesses: GuessRow[];
  guesses_used: number;
  guesses_remaining: number;
  answer: string | null;
};

export type PuzzleStateResponse = PuzzleStateLocked | PuzzleStateOpen;

// ── POST /{puzzle_id}/guess ──────────────────────────────────────────────

export type GuessErrorCode =
  | "not_in_dictionary"
  | "wrong_length"
  | "puzzle_locked"
  | "puzzle_finished"
  | "attempt_finished"
  | "event_ended";

export type GuessSuccess = {
  ok: true;
  colors: GuessColor[];
  status: HeidursordlaAttemptStatus;
  guesses_used: number;
  guesses_remaining: number;
  answer: string | null;
};

export type GuessFailure = {
  ok: false;
  error_code: GuessErrorCode;
  detail: string;
};

export type GuessResult = GuessSuccess | GuessFailure;

// ─────────────────────────────────────────────────────────────────────────
// Endpoint helpers
// ─────────────────────────────────────────────────────────────────────────

const BASE = "/leikir/heidursordla";

export async function fetchToday(getToken: () => Promise<string | null>): Promise<TodayResponse> {
  const url = buildApiUrl(`${BASE}/today`);
  return fetchWithAuth<TodayResponse>(url, { method: "GET" }, getToken);
}

export async function fetchPuzzleState(
  puzzleId: string,
  getToken: () => Promise<string | null>
): Promise<PuzzleStateResponse> {
  const url = buildApiUrl(`${BASE}/${puzzleId}`);
  return fetchWithAuth<PuzzleStateResponse>(url, { method: "GET" }, getToken);
}

/**
 * Submit a guess. Bypasses `fetchWithAuth` so the typed `{error_code, detail}`
 * body on 400/410 responses survives intact.
 *
 * On 401 we mirror `fetchWithAuth`'s redirect-to-login behaviour.
 */
export async function submitGuess(
  puzzleId: string,
  word: string,
  getToken: () => Promise<string | null>
): Promise<GuessResult> {
  const token = await getToken();
  if (!token) {
    throw new Error("Innskráning vantar");
  }

  const url = buildApiUrl(`${BASE}/${puzzleId}/guess`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify({ word }),
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth/login?returnTo=${returnTo}`;
    }
    throw new Error("Innskráning vantar");
  }

  if (response.status === 400 || response.status === 410) {
    // FastAPI wraps `HTTPException(detail=GuessError(...))` as
    // `{"detail": {"error_code": "...", "detail": "..."}}`.
    const body = (await response.json().catch(() => ({}))) as {
      detail?: { error_code?: GuessErrorCode; detail?: string } | string;
    };
    if (body.detail && typeof body.detail === "object" && body.detail.error_code) {
      return {
        ok: false,
        error_code: body.detail.error_code,
        detail: body.detail.detail ?? "",
      };
    }
    // Fallback: backend returned an unexpected shape.
    return {
      ok: false,
      error_code: "puzzle_locked",
      detail: typeof body.detail === "string" ? body.detail : "Villa kom upp",
    };
  }

  if (!response.ok) {
    throw new Error(`Villa kom upp við að senda giskun (${response.status})`);
  }

  const data = (await response.json()) as Omit<GuessSuccess, "ok">;
  return { ok: true, ...data };
}
