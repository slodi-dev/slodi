"use client";

import React, { useMemo, useRef, useState } from "react";
import styles from "./ContentCreateModal.module.css";
import { cn } from "@/lib/util";

/**
 * Pick merkimiðar from the vocabulary. Never add to it.
 *
 * The tag list is shared by the whole bank and managed by
 * Dagskrárstjórnarteymið, so a submitter chooses from it. That is a *picker*,
 * not a text box: a text box invites a word that does not exist, and the
 * create endpoint refuses the entire submission over one unknown tag — after
 * the whole form has been filled in.
 *
 * Search at the top, the list under it, chips for what has been chosen. The
 * list is always visible rather than opening on focus: with a vocabulary this
 * small, hiding it would hide the only thing that tells a leader what tags
 * even are.
 *
 * Keyboard is the full listbox contract — ↑/↓ to move, Enter or Space to
 * toggle, and the active option reported through `aria-activedescendant` so a
 * screen reader follows the arrows without focus leaving the search field.
 */
export default function TagPicker({
  available,
  selected,
  onToggle,
}: {
  available: string[];
  selected: string[];
  /** Emits the tag, not a new array.
   *
   *  Computing `[...selected, tag]` here read a `selected` captured at render
   *  time, so two picks in quick succession both started from the same array
   *  and the first was silently lost. The state lives in the form; the decision
   *  belongs there too. */
  onToggle: (tag: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Open by default: with a small vocabulary the list is the only thing that
  // tells a leader what merkimiðar even are. Collapsible because with a long
  // one it is most of the section.
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Icelandic: a plain `includes` is the honest match here. Collator-based
    // folding would make "utivist" find "Útivist", which sounds helpful until
    // it also makes "að" match half the list.
    return q ? available.filter((t) => t.toLowerCase().includes(q)) : available;
  }, [available, query]);

  const toggle = onToggle;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => {
        const next = event.key === "ArrowDown" ? i + 1 : i - 1;
        const clamped = Math.max(0, Math.min(next, shown.length - 1));
        // Keeping the active option in view is a courtesy; an environment
        // without scrollIntoView should lose the scroll, not the selection.
        const li = listRef.current?.querySelectorAll("li")[clamped];
        li?.scrollIntoView?.({ block: "nearest" });
        return clamped;
      });
    } else if (event.key === "Enter" || event.key === " ") {
      if (shown[active]) {
        // Enter must not reach the dialog, or picking a tag would submit.
        event.preventDefault();
        event.stopPropagation();
        toggle(shown[active]);
      }
    }
  }

  return (
    <div className={styles.fld}>
      <button
        type="button"
        className={cn(styles.pickerToggle, open && styles.pickerOpen)}
        aria-expanded={open}
        aria-controls="tag-picker"
        onClick={() => setOpen((o) => !o)}
      >
        Merkimiðar
        <span className={styles.pickerCount}>
          {selected.length > 0 ? `· ${selected.length} valdir` : `· ${available.length} í boði`}
        </span>
        <svg
          className={styles.pickerChev}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <p className={styles.help} id="tag-help">
          Veldu úr listanum. Dagskrárstjórnarteymið býr til nýja merkimiða.
        </p>
      )}
      <div className={styles.picker} id="tag-picker" hidden={!open}>
        <input
          id="tag-search"
          className={styles.pickerSearch}
          role="combobox"
          // Named explicitly: the visible heading is now the collapse toggle,
          // so there is no label element to point at.
          aria-label="Merkimiðar — leita og velja"
          aria-expanded="true"
          aria-controls="tag-list"
          aria-describedby="tag-help"
          aria-autocomplete="list"
          aria-activedescendant={shown[active] ? `tag-opt-${active}` : undefined}
          placeholder="Leita í merkimiðum…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {shown.length === 0 ? (
          <p className={styles.pickerEmpty}>Enginn merkimiði passar við „{query}“.</p>
        ) : (
          <ul
            className={styles.pickerList}
            id="tag-list"
            role="listbox"
            aria-label="Merkimiðar"
            ref={listRef}
          >
            {shown.map((tag, i) => {
              const on = selected.includes(tag);
              return (
                <li key={tag}>
                  <button
                    type="button"
                    id={`tag-opt-${i}`}
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    className={cn(styles.pickerOption, i === active && styles.pickerHere)}
                    onClick={() => toggle(tag)}
                  >
                    <span className={styles.pickerTick} aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {tag}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selected.length > 0 && (
        <ul className={styles.chips} aria-label="Valdir merkimiðar">
          {selected.map((tag) => (
            <li key={tag} className={styles.chip}>
              <span className={styles.chipText}>{tag}</span>
              <button
                type="button"
                className={styles.chipBtn}
                aria-label={`Fjarlægja ${tag}`}
                onClick={() => toggle(tag)}
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
