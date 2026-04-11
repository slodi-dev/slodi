"use client";

import styles from "./HeidursordlaKeyboard.module.css";
import type { GuessColor } from "@/services/heidursordla.service";

export type LetterState = "correct" | "present" | "absent" | undefined;

type Props = {
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  letterStates: Record<string, LetterState>;
  disabled?: boolean;
};

// 32-letter Icelandic alphabet, no C/Q/W/Z. Distinct keys for accented forms.
// Layout is 11 / 11 / 10 so every row fits inside a 375px portrait viewport
// with at least ~31px per key. The bottom row is bracketed by Enter (↵) and
// Backspace (⌫) at render time, both sized equal to letter keys so row 3
// doesn't become the cramped one.
const LETTER_ROWS: ReadonlyArray<readonly string[]> = [
  ["E", "É", "R", "T", "Y", "Ý", "U", "Ú", "I", "Í", "O"],
  ["Ó", "P", "A", "Á", "S", "D", "F", "G", "H", "J", "K"],
  ["L", "Þ", "Æ", "Ö", "Ð", "X", "V", "B", "N", "M"],
] as const;

// All 32 Icelandic letters used by the puzzle, kept here so callers can
// derive per-letter colour state without re-listing them. Order matters
// only for tests.
export const ICELANDIC_LETTERS = [
  "A",
  "Á",
  "B",
  "D",
  "Ð",
  "E",
  "É",
  "F",
  "G",
  "H",
  "I",
  "Í",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ó",
  "P",
  "R",
  "S",
  "T",
  "U",
  "Ú",
  "V",
  "X",
  "Y",
  "Ý",
  "Þ",
  "Æ",
  "Ö",
] as const;

export function letterStatesFromGuesses(
  guesses: Array<{ word: string; colors: GuessColor[] }>
): Record<string, LetterState> {
  const map: Record<string, LetterState> = {};
  // Priority: correct > present > absent. Iterate in order and only upgrade.
  const rank: Record<NonNullable<LetterState>, number> = {
    absent: 1,
    present: 2,
    correct: 3,
  };
  for (const row of guesses) {
    for (let i = 0; i < row.word.length; i += 1) {
      const letter = row.word[i].toUpperCase();
      const c = row.colors[i];
      const next: LetterState = c === "green" ? "correct" : c === "yellow" ? "present" : "absent";
      const prev = map[letter];
      if (!prev || (next && rank[next] > rank[prev])) {
        map[letter] = next;
      }
    }
  }
  return map;
}

/**
 * On-screen Icelandic keyboard. 32 letters across three rows. The bottom row
 * is bracketed by Enter (`↵`) and Backspace (`⌫`).
 */
export default function HeidursordlaKeyboard({
  onKey,
  onEnter,
  onBackspace,
  letterStates,
  disabled = false,
}: Props) {
  return (
    <div className={styles.root} aria-label="Íslenskt lyklaborð">
      {LETTER_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className={styles.row}>
          {rowIdx === LETTER_ROWS.length - 1 && (
            <button
              type="button"
              className={`${styles.key} ${styles.keyWide}`}
              onClick={onEnter}
              disabled={disabled}
              aria-label="Staðfesta"
            >
              ↵
            </button>
          )}
          {row.map((letter) => {
            const state = letterStates[letter];
            const colorClass =
              state === "correct"
                ? styles.keyCorrect
                : state === "present"
                  ? styles.keyPresent
                  : state === "absent"
                    ? styles.keyAbsent
                    : "";
            return (
              <button
                key={letter}
                type="button"
                className={`${styles.key} ${colorClass}`.trim()}
                onClick={() => onKey(letter)}
                disabled={disabled}
                data-letter={letter}
                aria-label={letter}
              >
                {letter}
              </button>
            );
          })}
          {rowIdx === LETTER_ROWS.length - 1 && (
            <button
              type="button"
              className={`${styles.key} ${styles.keyWide}`}
              onClick={onBackspace}
              disabled={disabled}
              aria-label="Eyða"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
