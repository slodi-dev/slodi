"use client";

import React, { useRef, useState } from "react";
import styles from "./ContentCreateModal.module.css";
import { cn } from "@/lib/util";

/**
 * A list of things, one chip each — not a comma-separated sentence.
 *
 * „Kaðall, karabínur, hjálmar" in a single text box is three pieces of
 * equipment the database stores as one string: unsearchable, unfilterable, and
 * impossible to correct one item at a time.
 *
 * Each chip carries two actions. The **×** removes it. The **pencil** removes
 * it *and puts its text back in the input*, which is what editing a one-word
 * item actually is — retyping it from a head start beats an inline text field
 * that needs its own save and cancel.
 *
 * Both actions are in the DOM at all times and only *fade* in on hover, so a
 * keyboard user never meets a control that exists solely under a pointer.
 */
export default function ChipList({
  label,
  addLabel,
  placeholder,
  items,
  onAdd,
  onRemove,
  known,
  onlyKnown,
}: {
  label: string;
  /** The accessible name of the add button — "Bæta búnaði á lista". */
  addLabel: string;
  placeholder: string;
  items: string[];
  /** Emit the value, not a new array — see the note in TagPicker. Two quick
   *  adds computing `[...items, v]` from the same render both start from the
   *  same array and one is lost. */
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  /** Existing values worth suggesting, e.g. tags others have already used. */
  known?: string[];
  /** When true, only a value in `known` may be added.
   *
   *  The tag vocabulary is shared by the whole bank and managed by
   *  Dagskrárstjórnarteymið, so a submitter picks from it rather than adding to
   *  it. Enforced *here* rather than left to the API: the create endpoint
   *  refuses the whole submission over one unknown tag, and discovering that
   *  after filling in the entire form is the worst possible moment. */
  onlyKnown?: boolean;
}) {
  const [text, setText] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = `chips-${label}`;
  const listId = known?.length ? `${id}-known` : undefined;

  function add() {
    const typed = text.trim();
    if (!typed) return;
    setRefused(null);

    // Match the known vocabulary case-insensitively and store *its* casing.
    // "útivist" and "Útivist" are one tag, and the canonical spelling is the
    // one already in the database.
    const canonical = known?.find((k) => k.toLowerCase() === typed.toLowerCase());
    if (onlyKnown && !canonical) {
      setRefused(
        `„${typed}“ er ekki til. Veldu úr listanum — Dagskrárstjórnarteymið býr til nýja merkimiða.`
      );
      return;
    }
    const value = canonical ?? typed;

    // Case-insensitive here too: "Kaðall" and "kaðall" are one piece of kit.
    if (!items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      onAdd(value);
    }
    setText("");
    inputRef.current?.focus();
  }

  function edit(item: string) {
    onRemove(item);
    setText(item);
    inputRef.current?.focus();
  }

  return (
    <div className={styles.fld}>
      <label className={styles.lab} htmlFor={id}>
        {label}
      </label>
      <div className={styles.chipRow}>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          placeholder={placeholder}
          value={text}
          list={listId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds. It must not reach the dialog, or a half-typed item
            // would submit the whole form.
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              add();
            }
          }}
        />
        {listId && (
          <datalist id={listId}>
            {known?.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        )}
        <button
          type="button"
          className={cn(styles.btn, styles.btnGhost)}
          aria-label={addLabel}
          onClick={add}
        >
          Bæta við
        </button>
      </div>
      {refused && (
        <p className={styles.err} role="alert">
          {refused}
        </p>
      )}
      {items.length > 0 && (
        <ul className={styles.chips} aria-label={label}>
          {items.map((item) => (
            <li key={item} className={styles.chip}>
              <span className={styles.chipText}>{item}</span>
              <button
                type="button"
                className={styles.chipBtn}
                aria-label={`Breyta ${item}`}
                onClick={() => edit(item)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.chipBtn}
                aria-label={`Fjarlægja ${item}`}
                onClick={() => onRemove(item)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
