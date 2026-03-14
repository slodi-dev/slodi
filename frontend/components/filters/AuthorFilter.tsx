"use client";

import { useRef, useEffect, useCallback } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface AuthorFilterProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  defaultOpen?: boolean;
}

/**
 * Inline-autocomplete filter for author (Höfundur).
 * Completes the best startsWith match in-place as the user types.
 * Tab / ArrowRight / Enter accepts; Backspace deletes the last typed char.
 * onChange only fires on explicit accept or clear — never on partial input.
 */
export default function AuthorFilter({
  value,
  onChange,
  suggestions,
  defaultOpen = false,
}: AuthorFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef(value);

  const findMatch = useCallback(
    (typed: string) =>
      suggestions.find((s) => s.toLowerCase().startsWith(typed.toLowerCase())) ?? null,
    [suggestions]
  );

  // Sync when value changes externally (e.g. "clear all filters").
  // Skip when it already matches what the user typed (avoids overwriting the input).
  useEffect(() => {
    if (value !== typedRef.current && inputRef.current) {
      typedRef.current = value;
      inputRef.current.value = value;
    }
  }, [value]);

  const accept = useCallback(() => {
    const input = inputRef.current!;
    const accepted = input.value;
    typedRef.current = accepted;
    input.setSelectionRange(accepted.length, accepted.length);
    onChange(accepted);
  }, [onChange]);

  const clear = useCallback(() => {
    const input = inputRef.current!;
    input.value = "";
    typedRef.current = "";
    onChange("");
    input.focus();
  }, [onChange]);

  const handleInputChange = () => {
    const input = inputRef.current!;
    const typed = input.value;
    typedRef.current = typed;

    const match = findMatch(typed);
    if (match && typed.length > 0) {
      input.value = match;
      input.setSelectionRange(typed.length, match.length);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = inputRef.current!;
    const hasCompletion = input.value.length > typedRef.current.length;

    switch (e.key) {
      case "Backspace":
        if (hasCompletion) {
          e.preventDefault();
          const newTyped = typedRef.current.slice(0, -1);
          typedRef.current = newTyped;
          const match = newTyped.length > 0 ? findMatch(newTyped) : null;
          if (match) {
            input.value = match;
            input.setSelectionRange(newTyped.length, match.length);
          } else {
            input.value = newTyped;
          }
        }
        break;
      case "Tab":
      case "ArrowRight":
        if (hasCompletion) {
          e.preventDefault();
          accept();
        }
        break;
      case "Enter":
        if (hasCompletion) {
          e.preventDefault();
          accept();
        }
        break;
      case "Escape":
        e.preventDefault();
        input.value = "";
        typedRef.current = "";
        onChange("");
        break;
    }
  };

  return (
    <CollapsibleSection
      label="Höfundur"
      activeCount={value.length > 0 ? 1 : 0}
      defaultOpen={defaultOpen}
    >
      <div className={styles.comboboxWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={`${styles.comboboxInput} ${styles.comboboxInputWithClear}`}
          defaultValue={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Höfundur"
          aria-autocomplete="inline"
          placeholder="Leita eftir höfundi..."
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.comboboxClearButton}
          onClick={clear}
          aria-label="Hreinsa höfund"
          tabIndex={-1}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </CollapsibleSection>
  );
}
