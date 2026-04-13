"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import HorpuhoppGame from "@/components/leikir/horpuhopp/HorpuhoppGame";
import HorpuhoppLeaderboard, {
  type ScoreEntry,
} from "@/components/leikir/horpuhopp/HorpuhoppLeaderboard";
import styles from "./horpuhopp.module.css";

const GAME = "horpuhopp";
const PENDING_KEY = `leikir_pending_score_${GAME}`;

export default function HorpuhoppPage() {
  const { user } = useUser();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [loginHref, setLoginHref] = useState<string | undefined>(undefined);
  const [scoreError, setScoreError] = useState<string | null>(null);

  // Fetch leaderboard on mount (non-critical; swallow errors)
  useEffect(() => {
    fetch(`/api/leikir/${GAME}/scores`)
      .then((r) => r.json())
      .then((data: ScoreEntry[]) => setScores(data))
      .catch(() => {});
  }, []);

  // Submit pending score saved before login redirect
  const pendingSubmitted = useRef(false);
  useEffect(() => {
    if (!user || pendingSubmitted.current) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_KEY);
    } catch {
      /* no storage */
    }
    if (!pending) return;

    const finalScore = parseInt(pending, 10);
    if (!finalScore || finalScore <= 0) {
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    pendingSubmitted.current = true;
    fetch(`/api/leikir/${GAME}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: finalScore }),
    })
      .then((res) => {
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
        if (!res.ok) return null;
        return res.json() as Promise<ScoreEntry[]>;
      })
      .then((data) => {
        if (data) {
          setScores(data);
          setLeaderboardVisible(true);
        }
      })
      .catch(() => {
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* ignore */
        }
      });
  }, [user]);

  const handleRestart = useCallback(() => {
    setLeaderboardVisible(false);
    setLoginHref(undefined);
    setScoreError(null);
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    if (finalScore <= 0) return;
    setScoreError(null);

    fetch(`/api/leikir/${GAME}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: finalScore }),
    })
      .then((res) => {
        if (res.status === 401) {
          try {
            sessionStorage.setItem(PENDING_KEY, String(finalScore));
          } catch {
            /* no storage */
          }
          setLoginHref(`/auth/login?returnTo=/leikir/${GAME}`);
          setLeaderboardVisible(true);
          return null;
        }
        if (!res.ok) throw new Error("score submission failed");
        return res.json() as Promise<ScoreEntry[]>;
      })
      .then((data) => {
        if (data) {
          setScores(data);
          setLeaderboardVisible(true);
        }
      })
      .catch(() => {
        setScoreError("Villa við að vista stig");
        setLeaderboardVisible(true);
      });
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.gameArea}>
        <HorpuhoppGame onGameOver={handleGameOver} onRestart={handleRestart} />
        <HorpuhoppLeaderboard
          entries={scores}
          visible={leaderboardVisible}
          onClose={() => setLeaderboardVisible(false)}
          loginHref={loginHref}
          errorMessage={scoreError}
        />
      </div>
    </div>
  );
}
