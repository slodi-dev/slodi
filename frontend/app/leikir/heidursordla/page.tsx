"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./heidursordla.module.css";
import tileStyles from "../leikir.module.css";
import NextPuzzleCountdown from "@/components/leikir/heidursordla/NextPuzzleCountdown";
import { useAuth } from "@/hooks/useAuth";
import { fetchToday, type TodayResponse } from "@/services/heidursordla.service";

export default function HeidursordlaIndexPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchToday(getToken);
      setData(res);
    } catch (err) {
      console.error("[heidursordla] today failed", err);
      setError(err instanceof Error ? err.message : "Villa kom upp");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

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

  // ── Archive: event has ended ──────────────────────────────────────────
  if (data.event_ended) {
    return (
      <div className={styles.indexRoot}>
        <h1 className={styles.archiveTitle}>Skátaþingsorðlu er lokið</h1>
        <div className={styles.archiveList}>
          {data.puzzles.map((p) => (
            <div key={p.id} className={styles.archiveCard}>
              <div className={styles.archiveNumber}>Þraut #{p.puzzle_number}</div>
              <div className={styles.archiveAnswer}>{p.answer}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Waiting: no live puzzle right now ─────────────────────────────────
  if (data.puzzle === null) {
    return (
      <div className={styles.indexRoot}>
        <div className={styles.indexCenter}>
          <NextPuzzleCountdown
            targetIso={data.next_round_at}
            label="Næsta þraut eftir"
            onExpire={load}
          />
        </div>
      </div>
    );
  }

  // ── Active: a live puzzle is open ─────────────────────────────────────
  return (
    <div className={styles.indexRoot}>
      <h1 className={styles.archiveTitle}>Heiðursorðla</h1>
      <Link
        href={`/leikir/heidursordla/${data.puzzle.id}`}
        className={`${tileStyles.tile} ${tileStyles.tileActive}`}
      >
        <span className={tileStyles.tileTitle}>Þraut #{data.puzzle.puzzle_number}</span>
        <span className={tileStyles.tileSubtitle}>Spila núna</span>
      </Link>
    </div>
  );
}
