"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface AuthorFilterProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  defaultOpen?: boolean;
}

/**
 * Combobox/autocomplete filter for author (Höfundur).
 * Features keyboard navigation, debounced onChange, and ARIA combobox pattern.
 */
export default function AuthorFilter({
  value,
  onChange,
  suggestions,
  defaultOpen = false,
}: AuthorFilterProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const updateListPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setListStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (showList) {
      updateListPosition();
      window.addEventListener("scroll", updateListPosition, true);
      window.addEventListener("resize", updateListPosition);
      return () => {
        window.removeEventListener("scroll", updateListPosition, true);
        window.removeEventListener("resize", updateListPosition);
      };
    }
  }, [showList, updateListPosition]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter suggestions based on current input
  const filteredSuggestions = inputValue
    ? suggestions.filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
    : suggestions;

  const debouncedOnChange = useCallback(
    (newValue: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, 300);
    },
    [onChange]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowList(true);
    setActiveIndex(-1);
    debouncedOnChange(newValue);
  };

  const selectSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    setShowList(false);
    setActiveIndex(-1);
    // Immediately propagate on explicit selection
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || filteredSuggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setShowList(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
          selectSuggestion(filteredSuggestions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowList(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay closing to allow onMouseDown on suggestions to fire first
    blurTimeoutRef.current = setTimeout(() => {
      setShowList(false);
      setActiveIndex(-1);
    }, 150);
  };

  const handleFocus = () => {
    if (filteredSuggestions.length > 0) {
      setShowList(true);
    }
  };

  const activeDescendant = activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  const hasActiveCount = value.length > 0 ? 1 : 0;

  return (
    <CollapsibleSection label="Höfundur" activeCount={hasActiveCount} defaultOpen={defaultOpen}>
      <div className={styles.comboboxWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.comboboxInput}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={activeDescendant}
          aria-label="Höfundur"
          placeholder="Leita eftir höfundi..."
        />
        {showList &&
          filteredSuggestions.length > 0 &&
          createPortal(
            <ul
              id={listId}
              className={styles.suggestionList}
              style={listStyle}
              role="listbox"
              aria-label="Tillögur að höfundum"
            >
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  id={`${listId}-option-${index}`}
                  className={`${styles.suggestionItem} ${index === activeIndex ? styles.suggestionItemActive : ""}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>,
            document.body
          )}
      </div>
    </CollapsibleSection>
  );
}
