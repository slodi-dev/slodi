"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./ProgramSearch.module.css";

interface ProgramSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  resultCount?: number;
  debounceMs?: number;
  disabled?: boolean;
}

export default function ProgramSearch({
  value,
  onChange,
  onSearch,
  placeholder = "Leita í dagskrám...",
  resultCount,
  debounceMs = 300,
  disabled = false,
}: ProgramSearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const trimmed = localValue.trim();
      onChange(trimmed);
      onSearch?.(trimmed);
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [localValue, debounceMs, onChange, onSearch]);

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  const isActive = localValue.length > 0;
  const showResultCount = resultCount !== undefined && isActive;

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchWrapper}>
        {/* Search Icon */}
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

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          className={`${styles.searchInput} ${isActive ? styles.active : ""}`}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Leita í dagskrám"
          aria-describedby={showResultCount ? "search-results-count" : undefined}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Clear Button */}
        {isActive && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            aria-label="Hreinsa leit"
            title="Hreinsa leit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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

      {/* Result Count */}
      {showResultCount && (
        <div
          id="search-results-count"
          className={styles.resultCount}
          role="status"
          aria-live="polite"
        >
          {resultCount === 0 ? (
            <span className={styles.noResults}>Engar niðurstöður fundust</span>
          ) : resultCount === 1 ? (
            <span>1 dagskrá fannst</span>
          ) : (
            <span>{resultCount} dagskrár fundust</span>
          )}
        </div>
      )}
    </div>
  );
}
