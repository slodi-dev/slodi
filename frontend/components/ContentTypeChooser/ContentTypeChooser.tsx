"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ContentTypeChooser.module.css";
import { cn } from "@/lib/util";

export type BankContentType = "task" | "event" | "program";

/**
 * Whether the bank offers "Dagskrá" as something you can create.
 *
 * **Off, deliberately.** A Dagskrá is a *collection* of liðir and viðburðir, and
 * there is no UI anywhere that adds a child to one — no screen calls
 * `POST /programs/{id}/events`. So choosing it produces an empty collection its
 * author cannot fill and a reviewer cannot judge.
 *
 * The option is written and styled below rather than deleted: when the child
 * picker lands, this flips to `true` and the menu is the three-option one the
 * design specifies. Until then, offering it would be offering a dead end.
 */
export const OFFER_PROGRAM = false;

type Option = {
  type: BankContentType;
  name: string;
  /** The name alone does not say what it means — a leikur is a Verkefni, not a
   *  Dagskrá — so the hint line is the design, not decoration. */
  hint: string;
  accent: string;
  icon: React.ReactNode;
};

const ALL_OPTIONS: Option[] = [
  {
    type: "task",
    name: "Verkefni",
    hint: "Einn dagskrárliður — leikur, setning, eitt verkefni",
    accent: styles.typeTask,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="3" y="9" width="18" height="6" rx="2" />
      </svg>
    ),
  },
  {
    type: "event",
    name: "Viðburður",
    hint: "Eitthvað sem gerist á tilteknum tíma — útilega, mót, dagsferð",
    accent: styles.typeEvent,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 3v18" />
        <path d="M7 4.5h10l-2.6 4 2.6 4H7z" />
      </svg>
    ),
  },
  {
    type: "program",
    name: "Dagskrá",
    hint: "Safn af liðum og viðburðum — dagskrárhringur",
    accent: styles.typeProgram,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    ),
  },
];

/** Fixed order — Verkefni · Viðburður · Dagskrá. There is no slot context in the
 *  bank to reorder them by, and a menu that reorders itself cannot be learned. */
const OPTIONS = ALL_OPTIONS.filter((o) => o.type !== "program" || OFFER_PROGRAM);

/**
 * The bank's create launcher.
 *
 * Asks *what are you making?* before it asks anything else, because the answer
 * decides which of three tables the submission lands in — and until this
 * existed every public submission was filed as a Dagskrá regardless of what it
 * actually was.
 *
 * One object in three sizes: at rest a 56px ball, stretched open under the
 * pointer to show its label, and on press unrolling the options out of its own
 * top edge. Nothing floats in from outside — what you reach for is what opens.
 */
export default function ContentTypeChooser({
  onChoose,
  disabled = false,
  disabledReason,
}: {
  onChoose: (type: BankContentType) => void;
  disabled?: boolean;
  /** Why it cannot be used — shown rather than hiding the control, so a
   *  suspended leader reads an explanation instead of finding a missing button. */
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) fabRef.current?.focus();
  }, []);

  const focusOption = useCallback((i: number) => {
    const n = OPTIONS.length;
    // Wraps, so ↓ from the last lands on the first rather than dead-ending.
    optionRefs.current[((i % n) + n) % n]?.focus();
  }, []);

  // Focus moves into the sheet on open. Without this the menu is announced and
  // then abandoned — the reader is told it opened but their focus is still on
  // the button behind it.
  useEffect(() => {
    if (open) focusOption(0);
  }, [open, focusOption]);

  const currentIndex = () => optionRefs.current.findIndex((el) => el === document.activeElement);

  function onSheetKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      focusOption(currentIndex() + 1);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      focusOption(currentIndex() - 1);
    } else if (key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (key === "End") {
      event.preventDefault();
      focusOption(OPTIONS.length - 1);
    } else if (key === "Tab") {
      // Trapped: Tab cycles the options rather than escaping to the page
      // behind the scrim, which is not reachable while this is open.
      event.preventDefault();
      focusOption(currentIndex() + (event.shiftKey ? -1 : 1));
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Loka valmynd"
          onClick={() => close(true)}
        />
      )}
      <div className={cn(styles.launcher, open && styles.open)} onKeyDown={onSheetKeyDown}>
        <div className={styles.sheetwrap}>
          <div
            className={styles.sheet}
            role="menu"
            aria-label="Hvað viltu búa til?"
            // Hidden from the reading order when rolled up, so a screen-reader
            // user does not meet three options that are not on screen.
            aria-hidden={!open}
          >
            <p className={styles.sheetTitle} aria-hidden="true">
              Hvað viltu búa til?
            </p>
            {OPTIONS.map((option, i) => (
              <button
                key={option.type}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={open ? 0 : -1}
                className={cn(styles.opt, option.accent)}
                onClick={() => {
                  close(false);
                  onChoose(option.type);
                }}
              >
                <span className={styles.optIcon} aria-hidden="true">
                  {option.icon}
                </span>
                <span className={styles.optBody}>
                  <span className={styles.optName}>{option.name}</span>
                  <span className={styles.optHint}>{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.seam} aria-hidden="true" />
        <button
          ref={fabRef}
          type="button"
          className={styles.fab}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          onClick={() => (open ? close(false) : setOpen(true))}
          onKeyDown={(event) => {
            // ↑/↓ open the menu from the button, the standard menu-button idiom.
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <svg
            className={styles.plus}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {/* In the DOM at all times, so the accessible name never depends on
              the animation that reveals it. */}
          <span className={styles.label}>
            {disabled && disabledReason ? disabledReason : "Bæta við í bankann"}
          </span>
        </button>
      </div>
    </>
  );
}
