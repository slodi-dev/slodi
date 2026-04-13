"use client";

import styles from "./HeidursordlaGameOver.module.css";
import NextPuzzleCountdown from "./NextPuzzleCountdown";

type Props = {
  status: "won" | "lost";
  answer: string;
  guessesUsed: number;
  nextRoundAt: string | null;
  maxGuesses?: number;
};

export default function HeidursordlaGameOver({
  status,
  answer,
  guessesUsed,
  nextRoundAt,
  maxGuesses = 6,
}: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-live="polite">
      <div className={styles.card}>
        <h2 className={styles.title}>
          {status === "won" ? "Þú leystir þrautina!" : "Æ, þetta tókst ekki."}
        </h2>
        <p className={styles.score}>
          {guessesUsed}/{maxGuesses}
        </p>
        {status === "lost" && (
          <p className={styles.answer}>
            Svarið var <strong>{answer}</strong>
          </p>
        )}
        {nextRoundAt && <NextPuzzleCountdown targetIso={nextRoundAt} label="Næsta þraut eftir" />}
      </div>
    </div>
  );
}
