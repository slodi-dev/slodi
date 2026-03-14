"use client";

import { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import CollapsibleSection from "../ui/CollapsibleSection";
import styles from "./search.module.css";

interface LocationFilterProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  defaultOpen?: boolean;
}

/**
 * Location filter with ARIA combobox pattern and autocomplete suggestions.
 * Wrapped in a CollapsibleSection labelled "Staðsetning".
 */
export default function LocationFilter({
  value,
  onChange,
  suggestions,
  defaultOpen = false,
}: LocationFilterProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const blurTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const listId = `location-listbox-${generatedId}`;

  // Stable onChange ref to avoid re-triggering debounce
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync external value changes (e.g. "clear all" resets)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

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

  // Cleanup blur timer on unmount
  useEffect(() => {
    return () => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
      }
    };
  }, []);

  // Filter suggestions: case-insensitive includes match, only when input has content
  const filtered = useMemo(
    () =>
      localValue.length >= 1
        ? suggestions.filter((s) => s.toLowerCase().includes(localValue.toLowerCase()))
        : [],
    [localValue, suggestions]
  );

  const activeId =
    activeIndex >= 0 && activeIndex < filtered.length ? `${listId}-${activeIndex}` : undefined;

  const openList = useCallback(() => {
    setShowList(true);
    setActiveIndex(-1);
  }, []);

  const closeList = useCallback(() => {
    setShowList(false);
    setActiveIndex(-1);
  }, []);

  const selectSuggestion = useCallback(
    (suggestion: string) => {
      setLocalValue(suggestion);
      onChangeRef.current(suggestion);
      // Clear any pending debounce since we're setting immediately
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      closeList();
    },
    [closeList]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      if (newValue.length >= 1) {
        setShowList(true);
        setActiveIndex(-1);
      } else {
        closeList();
      }
    },
    [closeList]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (!showList && filtered.length > 0) {
            openList();
            setActiveIndex(0);
          } else if (showList && filtered.length > 0) {
            setActiveIndex((prev) => (prev >= filtered.length - 1 ? 0 : prev + 1));
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (showList && filtered.length > 0) {
            setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
          }
          break;
        }
        case "Enter": {
          if (showList && activeIndex >= 0 && activeIndex < filtered.length) {
            e.preventDefault();
            selectSuggestion(filtered[activeIndex]);
          }
          break;
        }
        case "Escape": {
          if (showList) {
            e.preventDefault();
            closeList();
          }
          break;
        }
      }
    },
    [showList, filtered, activeIndex, openList, closeList, selectSuggestion]
  );

  const handleFocus = useCallback(() => {
    // Cancel any pending blur close
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
    }
    if (localValue.length >= 1 && filtered.length > 0) {
      openList();
    }
  }, [localValue, filtered.length, openList]);

  const handleBlur = useCallback(() => {
    // Delay closing so onMouseDown on suggestions can fire first
    blurTimer.current = setTimeout(() => {
      closeList();
    }, 150);
  }, [closeList]);

  const handleSuggestionMouseDown = useCallback(
    (suggestion: string) => {
      // Using onMouseDown instead of onClick — critical for blur timing
      selectSuggestion(suggestion);
    },
    [selectSuggestion]
  );

  return (
    <CollapsibleSection label="Staðsetning" defaultOpen={defaultOpen}>
      <div className={styles.locationWrapper}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className={styles.locationInput}
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Sláðu inn staðsetningu..."
          aria-expanded={showList && filtered.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId || undefined}
          aria-label="Staðsetning"
          autoComplete="off"
          spellCheck="false"
        />

        {showList && filtered.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Staðsetningartillögur"
            className={styles.suggestionList}
          >
            {filtered.map((suggestion, index) => {
              const isActive = index === activeIndex;
              return (
                <li
                  key={suggestion}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.suggestionItem} ${isActive ? styles.suggestionItemActive : ""}`}
                  onMouseDown={() => handleSuggestionMouseDown(suggestion)}
                >
                  {suggestion}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  );
}
