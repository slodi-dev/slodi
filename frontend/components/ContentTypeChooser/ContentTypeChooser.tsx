"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ContentTypeChooser.module.css";
import { cn } from "@/lib/util";

export type BankContentType = "task" | "event" | "program";

/**
 * The four kinds of thing the bank holds — see `docs/content-model.md`.
 *
 * The difference between them is what they *contain*: a Verkefni is one
 * dagskrárliður and contains nothing; a Fundur is a collection of verkefni; a
 * Dagskrárhringur is a selection of fundir; a Viðburður is also a collection of
 * verkefni, but spread across several days rather than one evening.
 *
 * **Only Verkefni can be created in the September release.** The other three
 * are shown and disabled rather than hidden: a chooser with one option says the
 * bank only ever does one thing, and a leader needs to see that it will hold
 * their fundur eventually. They are off for one shared reason — they are
 * collections, and nothing can be put into a collection yet, so creating one
 * makes an empty container its author cannot fill and a reviewer cannot judge.
 */
type Option = {
  /** Stable key. Not all four map to a `content_type` yet. */
  key: string;
  /** What this files as on the wire, or null while it cannot be created. */
  creates: BankContentType | null;
  name: string;
  /** The name alone does not say what it means — a leikur is a Verkefni, not a
   *  Dagskrá — so the hint line is the design, not decoration. */
  hint: string;
  accent: string;
  icon: React.ReactNode;
};

const OPTIONS: Option[] = [
  {
    key: "task",
    creates: "task",
    name: "Verkefni",
    hint: "Einn dagskrárliður. Leikur, setning, slit, eða aðrir stakir liðir.",
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
    key: "fundur",
    creates: null,
    name: "Fundur",
    hint: "Samansafn af verkefnum fyrir einn skátafund.",
    accent: styles.typeFundur,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="3" y="5" width="18" height="4" rx="1" />
        <rect x="3" y="11" width="18" height="4" rx="1" />
        <rect x="3" y="17" width="18" height="3" rx="1" />
      </svg>
    ),
  },
  {
    key: "hringur",
    creates: null,
    name: "Dagskrárhringur",
    hint: "Safn af fundum og verkefnum sem spanna einn dagskrárhring.",
    accent: styles.typeHringur,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 5h7v6H4z" />
        <path d="M13 13h7v6h-7z" />
        <path d="M11 8h4a2 2 0 0 1 2 2v3" />
      </svg>
    ),
  },
  {
    key: "event",
    creates: null,
    name: "Viðburður",
    hint: "Safn af verkefnum fyrir útilegur, dagsferðir og önnur ævintýri.",
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
];

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
            {OPTIONS.map((option, i) => {
              const unavailable = option.creates === null;
              return (
                <button
                  key={option.key}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={open ? 0 : -1}
                  // aria-disabled, not `disabled`: a screen-reader user should
                  // still meet all four and learn the bank will hold them. A
                  // removed option teaches nothing, and a skipped one teaches
                  // nothing either.
                  aria-disabled={unavailable}
                  className={cn(styles.opt, option.accent, unavailable && styles.optSoon)}
                  onClick={() => {
                    if (unavailable || option.creates === null) return;
                    close(false);
                    onChoose(option.creates);
                  }}
                >
                  <span className={styles.optIcon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.optBody}>
                    <span className={styles.optName}>{option.name}</span>
                    <span className={styles.optHint}>{option.hint}</span>
                  </span>
                  {unavailable && <span className={styles.soon}>Kemur síðar</span>}
                </button>
              );
            })}
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
