"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import type { ScoreEntry } from "@/lib/leikir-games";
import { safeSessionStorage } from "@/lib/safe-storage";

/**
 * Leaderboard state and score submission for one scored leikur.
 *
 * Every game talks to the same `/api/leikir/{slug}/scores` proxy and needs the
 * same three behaviours, so they live here rather than in each game's page:
 *
 *  1. Load the board on mount (non-critical — a failure must not break the game).
 *  2. Submit on game over, revealing the board with the fresh standings.
 *  3. Never silently lose a run.
 *
 * ## Parking, in one rule
 *
 * A score is *parked* in sessionStorage whenever it did not reach the server —
 * signed out (401), rate limited (429), a server error, or no network at all.
 * Parking always keeps the **larger** value, and every submission sends
 * `max(thisRun, parked)`. So a parked run is retried automatically on the
 * player's next game over, and a success can clear the park unconditionally
 * because the value that succeeded was never smaller than what was parked.
 *
 * This assumes a high-score game, where a bigger number is strictly better and
 * zero is not worth reporting. A game whose board ranks on *current holdings*
 * (Arnór-Clicker, see REPLACE_SCORE_GAMES on the backend) must not use this
 * hook as-is: there, a lower score is meaningful and must be able to send.
 */

/**
 * The proxy forwards the backend's status *and* body, so a failure arrives as
 * a JSON object (`{detail: …}` or `{error: …}`), not a list. Handing that to
 * `setScores` would crash the whole page on the first render that maps over it,
 * so every response is narrowed to an actual array before it is accepted.
 */
function asScoreEntries(data: unknown): ScoreEntry[] | null {
  return Array.isArray(data) ? (data as ScoreEntry[]) : null;
}

/**
 * A retryable status leaves the run parked; anything else is a real rejection.
 *
 * 403 is in here because it means "this run has no usable token" — the mint
 * call failed, was rate limited, or the key rotated under a parked run. The run
 * itself is perfectly good, and `startRun` adopts a fresh token for it, so the
 * next attempt can succeed. Treating it as permanent threw the run away.
 */
function isRetryable(status: number): boolean {
  return status === 401 || status === 403 || status === 425 || status === 429 || status >= 500;
}

/**
 * 409 means the backend already recorded this run and burned its token. That is
 * a success the client simply did not hear about the first time, so the parked
 * copy has to go — retrying would 409 for ever.
 */
function isAlreadyRecorded(status: number): boolean {
  return status === 409;
}

/**
 * 425 means the run token is not yet old enough to justify the score. Unlike a
 * 422 (a score the game cannot produce at all) this resolves itself: the same
 * run against the same token passes once enough time has elapsed, so it must
 * stay parked rather than be discarded.
 */
function isTooEarly(status: number): boolean {
  return status === 425;
}

export function useGameScores(slug: string) {
  const { user } = useUser();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [loginHref, setLoginHref] = useState<string | undefined>(undefined);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const pendingKey = `leikir_pending_score_${slug}`;

  /**
   * A parked run keeps the token that proves when it started, not just the
   * number — the server will not accept the score without it, and a run parked
   * across a login round trip has to present the very same one.
   */
  const readParked = useCallback((): { score: number; token: string | null } => {
    const raw = safeSessionStorage.getItem(pendingKey);
    if (!raw) return { score: 0, token: null };
    let score = 0;
    let token: string | null = null;
    try {
      const parsed: unknown = JSON.parse(raw);
      // A bare number is the pre-run-token format, and JSON.parse *succeeds* on
      // it — so this has to be a type check, not a catch. Sessions open across
      // the deploy would otherwise lose the run they had parked.
      if (typeof parsed === "number") {
        score = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as { score?: unknown; token?: unknown };
        score = Number(obj.score);
        token = typeof obj.token === "string" ? obj.token : null;
      }
    } catch {
      score = Number(raw); // not JSON at all
    }
    return Number.isFinite(score) && score > 0 ? { score, token } : { score: 0, token: null };
  }, [pendingKey]);

  const park = useCallback(
    (value: number, token: string | null) =>
      safeSessionStorage.setItem(pendingKey, JSON.stringify({ score: value, token })),
    [pendingKey]
  );

  const clearParked = useCallback(() => safeSessionStorage.removeItem(pendingKey), [pendingKey]);

  // Responses can land out of order — most importantly the mount GET can
  // resolve after a submission and overwrite the standings the player just
  // earned. Each request takes a ticket on issue, and a result is only applied
  // if no newer request has already been applied.
  const nextTicket = useRef(0);
  const appliedTicket = useRef(-1);

  const applyScores = useCallback((data: ScoreEntry[], ticket: number) => {
    if (ticket < appliedTicket.current) return;
    appliedTicket.current = ticket;
    setScores(data);
  }, []);

  // Which run the player is on. A submission that resolves after they have
  // already restarted must not slide the sheet back up over a live game —
  // on a phone the board covers most of the screen.
  const runGeneration = useRef(0);

  /** Token for the run currently being played, from POST /runs. */
  const runToken = useRef<string | null>(null);

  /**
   * Tell the server a run is starting. It stamps the moment and signs it, so
   * the score submitted later can be checked against how long the run actually
   * took. Failing is not fatal here — the submission reports the real problem.
   */
  const startRun = useCallback(() => {
    // Drop the previous run's token first: it has been spent, and submitting it
    // again would earn a 409 that the caller treats as a permanent rejection,
    // discarding a perfectly good score.
    runToken.current = null;
    fetch(`/api/leikir/${slug}/runs`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { run_token?: string } | null) => {
        if (!data?.run_token) return;
        runToken.current = data.run_token;
        // A run parked without a token cannot be proved and would be refused
        // for ever. Lend it this one: from here its elapsed time accrues, so
        // once enough has passed the score becomes provable and goes through.
        const held = readParked();
        if (held.score > 0 && !held.token) park(held.score, data.run_token);
      })
      .catch(() => {});
  }, [slug, readParked, park]);

  // Load the board on mount. A missing leaderboard is not worth an error state.
  useEffect(() => {
    let active = true;
    const ticket = nextTicket.current++;

    fetch(`/api/leikir/${slug}/scores`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const entries = asScoreEntries(data);
        if (active && entries) applyScores(entries, ticket);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [slug, applyScores]);

  const submit = useCallback(
    (finalScore: number, token: string | null) =>
      fetch(`/api/leikir/${slug}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          token ? { score: finalScore, run_token: token } : { score: finalScore }
        ),
      }),
    [slug]
  );

  // Post the score parked before a login redirect. Runs once per mount: the
  // ref guards against the effect re-firing when `user` settles.
  const pendingSubmitted = useRef(false);
  useEffect(() => {
    if (!user || pendingSubmitted.current) return;

    const parked = readParked();
    if (!parked.score) {
      // Present but unusable (someone hand-edited it, an old format) — drop it.
      if (safeSessionStorage.getItem(pendingKey) !== null) clearParked();
      return;
    }

    pendingSubmitted.current = true;
    const ticket = nextTicket.current++;
    // Same guard handleGameOver uses: the player may already be mid-run by the
    // time this resolves, and the board is a full-height sheet on mobile.
    const run = runGeneration.current;

    submit(parked.score, parked.token)
      .then((res) => {
        // Keep it parked on anything that might work later — a rate limit or a
        // server error must not destroy the run this mechanism exists to save.
        if (res.ok || isAlreadyRecorded(res.status)) {
          clearParked();
        } else if (!isRetryable(res.status)) {
          // The player logged in specifically to save this run. Dropping it
          // without a word is the one outcome worse than losing it loudly.
          clearParked();
          setScoreError("Ekki tókst að vista stigin úr síðustu umferð");
          if (runGeneration.current === run) setLeaderboardVisible(true);
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        const entries = asScoreEntries(data);
        if (entries) {
          applyScores(entries, ticket);
          if (runGeneration.current === run) setLeaderboardVisible(true);
        }
      })
      .catch(() => {
        // Network failure — leave it parked for the next attempt.
      });
  }, [user, pendingKey, submit, applyScores, readParked, clearParked]);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      // Carry any run that never reached the server, so it is retried now
      // rather than waiting for a page reload.
      const parked = readParked();
      // Carry the better of this run and anything still unsent, along with the
      // token that proves whichever one we are actually claiming.
      const value = Math.max(finalScore, parked.score);
      const token = value === finalScore ? runToken.current : parked.token;
      if (value <= 0) return;

      setScoreError(null);
      const ticket = nextTicket.current++;
      const run = runGeneration.current;
      /** Only surface the board if the player is still on the run that ended. */
      const revealIfStillOver = () => {
        if (runGeneration.current === run) setLeaderboardVisible(true);
      };

      let accepted = false;
      submit(value, token)
        .then((res) => {
          if (res.ok) {
            accepted = true;
            // Clear only if this request still covers what is parked. Runs end
            // seconds apart, so a slow POST can finish after a later one has
            // parked a higher score — clearing blindly would destroy it.
            if (readParked().score <= value) clearParked();
            // Retire only the token this request spent. A later run may already
            // have minted its own, and nulling that would leave it unable to
            // prove itself — its score would be refused and thrown away.
            if (runToken.current === token) runToken.current = null;
            return res.json();
          }

          if (isAlreadyRecorded(res.status)) {
            // The server has this run already — an earlier attempt landed but
            // its reply was lost. Clear the park and show the board rather than
            // reporting a failure for a score that is safely stored.
            clearParked();
            if (runToken.current === token) runToken.current = null;
            revealIfStillOver();
            return null;
          }

          if (!isRetryable(res.status)) {
            // Permanently rejected — a malformed value, an unknown slug. Parking
            // it would re-send the same doomed number on every later run, so the
            // player's real scores would never reach the board again for the
            // rest of the session.
            clearParked();
            setScoreError("Villa við að vista stig");
            revealIfStillOver();
            return null;
          }

          // A 403 means this token is unusable — expired, or signed with a key
          // that has since rotated. Park without it so the next run lends a
          // live one; keeping it would 403 on every future attempt.
          park(value, res.status === 403 ? null : token);
          if (res.status === 401) {
            setLoginHref(`/auth/login?returnTo=/leikir/${slug}`);
          } else if (res.status === 429) {
            setScoreError("Of margar sendingar í einu — reyndu aftur eftir smá");
          } else if (isTooEarly(res.status)) {
            setScoreError("Stigin bíða staðfestingar — reyndu aftur eftir næstu umferð");
          } else {
            setScoreError("Villa við að vista stig — reynt aftur eftir næstu umferð");
          }
          revealIfStillOver();
          return null;
        })
        .then((data) => {
          if (data === null) return; // already handled above
          const entries = asScoreEntries(data);
          if (!entries) throw new Error("unexpected score response");
          applyScores(entries, ticket);
          revealIfStillOver();
        })
        .catch(() => {
          if (accepted) {
            // The server stored this run; only reading the reply failed. Parking
            // it would resubmit a spent token next time and lose a valid score.
            setScoreError("Villa við að sækja stigatöfluna");
            revealIfStillOver();
            return;
          }
          // No network at all — park so the next run carries it.
          park(value, token);
          setScoreError("Villa við að vista stig — reynt aftur eftir næstu umferð");
          revealIfStillOver();
        });
    },
    [slug, submit, applyScores, readParked, park, clearParked]
  );

  /**
   * Dismissing the board retires the run too. Otherwise a submission still in
   * flight would slide the sheet straight back over a board the player just
   * closed to look at their score card.
   */
  const hideLeaderboard = useCallback(() => {
    runGeneration.current++;
    setLeaderboardVisible(false);
  }, []);

  const handleRestart = useCallback(() => {
    runGeneration.current++;
    setLeaderboardVisible(false);
    setLoginHref(undefined);
    setScoreError(null);
  }, []);

  return {
    scores,
    leaderboardVisible,
    loginHref,
    scoreError,
    startRun,
    handleGameOver,
    handleRestart,
    hideLeaderboard,
  };
}
