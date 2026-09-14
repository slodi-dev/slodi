"use client";

import type { ScoreEntry } from "@/lib/leikir-games";
import styles from "./GameLeaderboard.module.css";

export type { ScoreEntry };

interface Props {
  entries: ScoreEntry[];
  /** Whether the leaderboard is expanded (bottom sheet on mobile). */
  visible: boolean;
  onClose: () => void;
  /** If set, shows a login link instead of the score list header. */
  loginHref?: string;
  /** If set, shows an error message below the list. */
  errorMessage?: string | null;
}

/**
 * In-game score panel shared by every scored leikur — a sidebar on desktop, a
 * bottom sheet on mobile. Purely presentational: `useGameScores` owns fetching
 * and submission, so a new game only has to render this with its own state.
 */
export default function GameLeaderboard({
  entries,
  visible,
  onClose,
  loginHref,
  errorMessage,
}: Props) {
  return (
    <aside className={`${styles.leaderboard} ${visible ? styles.active : ""}`}>
      {/* Dismiss handle — mobile only. A real button rather than a div with
          role="button": on a touch device this is the only way to close the
          sheet, so a keyboard or switch-control user would otherwise be stuck
          with it covering the game until they restarted the run. */}
      <button type="button" className={styles.handle} onClick={onClose}>
        <span className={styles.srOnly}>Loka stigatöflu</span>
      </button>

      <h2 className={styles.title}>Stigatafla</h2>

      {entries.length === 0 ? (
        <p className={styles.empty}>Engar færslur</p>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry, i) => (
            <li key={i} className={styles.row}>
              <span className={styles.rank}>{i + 1}.</span>
              <span className={styles.name}>{entry.user_name}</span>
              <span className={styles.score}>{entry.score}</span>
            </li>
          ))}
        </ol>
      )}

      {loginHref && (
        <p className={styles.loginPrompt}>
          <a href={loginHref}>Skráðu þig inn</a> til að vista stig
        </p>
      )}
      {errorMessage && <p className={styles.errorPrompt}>{errorMessage}</p>}
    </aside>
  );
}
