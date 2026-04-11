"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "../../skatathing.module.css";
import NextPuzzleCountdown from "@/components/skatathing/heidursordla/NextPuzzleCountdown";
import HeidursordlaPlayView from "@/components/skatathing/heidursordla/HeidursordlaPlayView";
import { useAuth } from "@/hooks/useAuth";
import { fetchPuzzleState, type PuzzleStateResponse } from "@/services/heidursordla.service";

export default function HeidursordlaPuzzlePage() {
  const params = useParams<{ puzzleId: string }>();
  const puzzleId = params?.puzzleId;
  const { getToken } = useAuth();

  const [data, setData] = useState<PuzzleStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!puzzleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPuzzleState(puzzleId, getToken);
      setData(res);
    } catch (err) {
      console.error("[heidursordla] puzzle state failed", err);
      setError(err instanceof Error ? err.message : "Villa kom upp");
    } finally {
      setLoading(false);
    }
  }, [getToken, puzzleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.indexRoot}>
        <p className={styles.loading}>Sæki…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.indexRoot}>
        <div className={styles.errorBox}>{error ?? "Villa kom upp"}</div>
      </div>
    );
  }

  if (!data.is_unlocked) {
    return (
      <div className={styles.indexRoot}>
        <div className={styles.indexCenter}>
          <NextPuzzleCountdown
            targetIso={data.puzzle.unlocks_at}
            label="Næsta þraut opnast eftir"
            onExpire={load}
          />
        </div>
      </div>
    );
  }

  return <HeidursordlaPlayView initialState={data} nextRoundAt={data.puzzle.locks_at} />;
}
