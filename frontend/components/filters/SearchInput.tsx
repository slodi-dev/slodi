"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./search.module.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
}

/**
 * Debounced search input with search icon, clear button, and
 * optional screen-reader result count announcement.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Leita í dagskrábanka",
  resultCount,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. "clear all" resets)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Stable onChange ref to avoid re-triggering debounce effect
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Debounce local value → parent onChange
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      onChangeRef.current(localValue);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [localValue]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChangeRef.current("");
    inputRef.current?.focus();
  }, []);

  const hasValue = localValue.length > 0;

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchWrapper}>
        {/* Search icon — always visible at the left */}
        <svg
          className={styles.searchIcon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          className={styles.searchInput}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Leita að dagskrá"
          autoComplete="off"
          spellCheck="false"
        />

        {/* Clear button — appears when input has content */}
        {hasValue && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            aria-label="Hreinsa leit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Screen-reader result count announcement */}
      {resultCount !== undefined && (
        <p aria-live="polite" className={styles.srOnly}>
          {resultCount} niðurstöður
        </p>
      )}
    </div>
  );
}
