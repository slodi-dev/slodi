"use client";

import { useEffect, useState } from "react";
import type { ScoreEntry } from "@/lib/leikir-games";
import styles from "./GamePodium.module.css";

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; entries: ScoreEntry[] };

const numberFormatter = new Intl.NumberFormat("is-IS");

/**
 * Compact top-3 podium for a scored game, fed by the public
 * `/api/leikir/{slug}/scores` proxy. Silent on error — a missing board should
 * never break the hub card.
 */
export default function GamePodium({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch(`/api/leikir/${slug}/scores`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<ScoreEntry[]>;
      })
      .then((data) => {
        if (!active) return;
        const top = data.slice(0, 3);
        setState(top.length ? { status: "ready", entries: top } : { status: "empty" });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.status === "error") return null;

  return (
    <div className={styles.board}>
      {state.status === "loading" && (
        <ol className={styles.podium} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className={styles.row}>
              <span className={styles.medal}>{i + 1}</span>
              <span className={`${styles.name} ${styles.skeleton}`} />
              <span className={`${styles.score} ${styles.skeleton}`} />
            </li>
          ))}
        </ol>
      )}

      {state.status === "empty" && (
        <p className={styles.empty}>Engin stig enn — náðu fyrsta sætinu!</p>
      )}

      {state.status === "ready" && (
        <ol className={styles.podium}>
          {state.entries.map((entry, i) => (
            <li key={`${entry.user_name}-${i}`} className={`${styles.row} ${styles[`rank${i + 1}`]}`}>
              <span className={styles.medal}>{i + 1}</span>
              <span className={styles.name}>{entry.user_name}</span>
              <span className={styles.score}>{numberFormatter.format(entry.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
