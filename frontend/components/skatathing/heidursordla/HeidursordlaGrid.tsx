"use client";

import styles from "./HeidursordlaGrid.module.css";
import type { GuessRow } from "@/services/heidursordla.service";

type Props = {
  guesses: GuessRow[];
  activeGuess: string;
  shake: boolean;
  wordLength?: number;
  maxGuesses?: number;
};

const DEFAULT_WORD_LENGTH = 5;
const DEFAULT_MAX_GUESSES = 6;

/**
 * The classic 6×5 letter grid. Filled rows render their per-letter colour
 * vector; the active row (in-progress guess) renders un-coloured cells with
 * the typed letters; remaining rows are empty placeholders.
 *
 * `shake` flips true → the active row plays a brief shake animation.
 */
export default function HeidursordlaGrid({
  guesses,
  activeGuess,
  shake,
  wordLength = DEFAULT_WORD_LENGTH,
  maxGuesses = DEFAULT_MAX_GUESSES,
}: Props) {
  const rows: React.ReactNode[] = [];
  const activeRowIndex = guesses.length;

  for (let r = 0; r < maxGuesses; r += 1) {
    const cells: React.ReactNode[] = [];
    const completed = guesses[r];
    const isActiveRow = !completed && r === activeRowIndex;

    for (let c = 0; c < wordLength; c += 1) {
      let letter = "";
      let colorClass = "";
      let filledClass = "";

      if (completed) {
        letter = (completed.word[c] ?? "").toUpperCase();
        const color = completed.colors[c];
        colorClass =
          color === "green"
            ? styles.cellCorrect
            : color === "yellow"
              ? styles.cellPresent
              : styles.cellAbsent;
        filledClass = styles.cellRevealed;
      } else if (isActiveRow) {
        letter = (activeGuess[c] ?? "").toUpperCase();
        if (letter) {
          filledClass = styles.cellFilled;
        }
      }

      cells.push(
        <div
          key={`${r}-${c}`}
          className={`${styles.cell} ${filledClass} ${colorClass}`.trim()}
          data-testid={`cell-${r}-${c}`}
        >
          {letter}
        </div>
      );
    }

    const rowClass = `${styles.row} ${isActiveRow && shake ? styles.rowShake : ""}`.trim();
    rows.push(
      <div key={r} className={rowClass} data-testid={`row-${r}`}>
        {cells}
      </div>
    );
  }

  return (
    <div className={styles.grid} aria-label="Heiðursorðla giskunarrist">
      {rows}
    </div>
  );
}
