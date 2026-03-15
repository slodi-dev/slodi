"use client";

import { useState, useEffect, useId } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface AuthorFilterProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  defaultOpen?: boolean;
}

export default function AuthorFilter({
  value,
  onChange,
  suggestions,
  defaultOpen = false,
}: AuthorFilterProps) {
  const [inputValue, setInputValue] = useState(value);
  const listId = useId();

  // Sync when parent clears the value (e.g. "clear all filters")
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Propagate immediately on exact match (user picked from datalist) or clear
    const exact = suggestions.find((s) => s.toLowerCase() === val.toLowerCase());
    if (exact) onChange(exact);
    else if (val === "") onChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onChange(inputValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue("");
      onChange("");
    }
  };

  const handleClear = () => {
    setInputValue("");
    onChange("");
  };

  return (
    <CollapsibleSection
      label="Höfundur"
      activeCount={value.length > 0 ? 1 : 0}
      defaultOpen={defaultOpen}
    >
      <div className={styles.comboboxWrapper}>
        <input
          type="text"
          list={listId}
          className={`${styles.comboboxInput} ${styles.comboboxInputWithClear}`}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Höfundur"
          placeholder="Leita eftir höfundi..."
          autoComplete="off"
          spellCheck={false}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          className={styles.comboboxClearButton}
          onClick={handleClear}
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
