"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HeidursordlaGrid from "./HeidursordlaGrid";
import HeidursordlaKeyboard, {
  ICELANDIC_LETTERS,
  letterStatesFromGuesses,
} from "./HeidursordlaKeyboard";
import HeidursordlaToast from "./HeidursordlaToast";
import HeidursordlaGameOver from "./HeidursordlaGameOver";
import styles from "./HeidursordlaPlayView.module.css";
import { useAuth } from "@/hooks/useAuth";
import {
  submitGuess,
  type GuessErrorCode,
  type GuessRow,
  type HeidursordlaAttemptStatus,
  type PuzzleStateOpen,
} from "@/services/heidursordla.service";

const MAX_GUESSES = 6;
const VALID_LETTERS = new Set<string>(ICELANDIC_LETTERS);

const ERROR_TOASTS: Partial<Record<GuessErrorCode, string>> = {
  not_in_dictionary: "Ekki í orðabók",
  puzzle_locked: "Þrautin er ekki opin enn",
  puzzle_finished: "Þessi þraut er ekki lengur opin",
  attempt_finished: "Þú hefur þegar lokið þessari þraut",
  event_ended: "Skátaþingsorðlu er lokið",
};

type Props = {
  initialState: PuzzleStateOpen;
  nextRoundAt: string | null;
};

export default function HeidursordlaPlayView({ initialState, nextRoundAt }: Props) {
  const { getToken } = useAuth();

  const wordLength = initialState.puzzle.word_length;
  const puzzleId = initialState.puzzle.id;

  const [guesses, setGuesses] = useState<GuessRow[]>(initialState.guesses);
  const [status, setStatus] = useState<HeidursordlaAttemptStatus>(initialState.status);
  const [answer, setAnswer] = useState<string | null>(initialState.answer);
  const [activeGuess, setActiveGuess] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isTerminal = status === "won" || status === "lost";

  const letterStates = useMemo(() => letterStatesFromGuesses(guesses), [guesses]);

  const triggerShake = useCallback(() => {
    setShake(true);
    // Match the 400ms CSS animation; clearing the flag lets it retrigger.
    setTimeout(() => setShake(false), 450);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isTerminal) return;

    if (activeGuess.length < wordLength) {
      triggerShake();
      setToast("Of stutt orð");
      return;
    }
    if (activeGuess.length > wordLength) {
      triggerShake();
      setToast("Of langt orð");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitGuess(puzzleId, activeGuess.toLowerCase(), getToken);
      if (!result.ok) {
        const message =
          result.error_code === "wrong_length"
            ? activeGuess.length < wordLength
              ? "Of stutt orð"
              : "Of langt orð"
            : (ERROR_TOASTS[result.error_code] ?? result.detail ?? "Villa kom upp");
        triggerShake();
        setToast(message);
        return;
      }

      const newRow: GuessRow = { word: activeGuess.toLowerCase(), colors: result.colors };
      setGuesses((prev) => [...prev, newRow]);
      setActiveGuess("");
      setStatus(result.status);
      if (result.answer) {
        setAnswer(result.answer);
      }
    } catch (err) {
      console.error("[heidursordla] submit failed", err);
      triggerShake();
      setToast("Netvilla — reyndu aftur");
    } finally {
      setSubmitting(false);
    }
  }, [activeGuess, getToken, isTerminal, puzzleId, submitting, triggerShake, wordLength]);

  const handleKey = useCallback(
    (letter: string) => {
      if (isTerminal || submitting) return;
      if (activeGuess.length >= wordLength) return;
      setActiveGuess((prev) => prev + letter.toUpperCase());
    },
    [activeGuess.length, isTerminal, submitting, wordLength]
  );

  const handleBackspace = useCallback(() => {
    if (isTerminal || submitting) return;
    setActiveGuess((prev) => prev.slice(0, -1));
  }, [isTerminal, submitting]);

  // Physical keyboard support — only when no game-over overlay is mounted.
  useEffect(() => {
    if (isTerminal) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSubmit();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
        return;
      }
      // Single-character key, possibly an Icelandic letter.
      if (e.key.length === 1) {
        const upper = e.key.toUpperCase();
        if (VALID_LETTERS.has(upper)) {
          e.preventDefault();
          handleKey(upper);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBackspace, handleKey, handleSubmit, isTerminal]);

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Heiðursorðla — Þraut #{initialState.puzzle.puzzle_number}</h1>
      <div className={styles.toastSlot}>
        <HeidursordlaToast message={toast} onDismiss={() => setToast(null)} />
      </div>
      <HeidursordlaGrid
        guesses={guesses}
        activeGuess={activeGuess}
        shake={shake}
        wordLength={wordLength}
        maxGuesses={MAX_GUESSES}
      />
      <HeidursordlaKeyboard
        onKey={handleKey}
        onEnter={() => void handleSubmit()}
        onBackspace={handleBackspace}
        letterStates={letterStates}
        disabled={isTerminal || submitting}
      />
      {isTerminal && (
        <HeidursordlaGameOver
          status={status === "won" ? "won" : "lost"}
          answer={answer ?? ""}
          guessesUsed={guesses.length}
          nextRoundAt={nextRoundAt}
          maxGuesses={MAX_GUESSES}
        />
      )}
    </div>
  );
}
