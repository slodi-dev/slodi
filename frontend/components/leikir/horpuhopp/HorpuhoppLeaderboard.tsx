"use client";

import styles from "./HorpuhoppLeaderboard.module.css";

export interface ScoreEntry {
  user_name: string;
  score: number;
}

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

export default function HorpuhoppLeaderboard({
  entries,
  visible,
  onClose,
  loginHref,
  errorMessage,
}: Props) {
  return (
    <aside className={`${styles.leaderboard} ${visible ? styles.active : ""}`}>
      {/* drag handle — mobile only */}
      <div className={styles.handle} onClick={onClose} role="button" aria-label="Loka stigatöflu" />

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
