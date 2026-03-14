"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface EquipmentFilterProps {
  availableItems: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

/**
 * Multi-select autocomplete filter for equipment (Búnaður).
 * Selected items are shown with a checkmark in the dropdown and can be toggled off.
 */
export default function EquipmentFilter({
  availableItems,
  selected,
  onChange,
  defaultOpen = false,
}: EquipmentFilterProps) {
  const [inputValue, setInputValue] = useState("");
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
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

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const filteredSuggestions = availableItems.filter((item) =>
    item.toLowerCase().includes(inputValue.toLowerCase())
  );

  const toggleItem = (item: string) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    const isSelected = selected.includes(item);
    onChange(isSelected ? selected.filter((s) => s !== item) : [...selected, item]);
    setActiveIndex(-1);
    setShowList(true);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowList(true);
    setActiveIndex(-1);
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
          toggleItem(filteredSuggestions[activeIndex]);
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
    blurTimeoutRef.current = setTimeout(() => {
      setShowList(false);
      setActiveIndex(-1);
      setInputValue("");
    }, 150);
  };

  const handleFocus = () => {
    setShowList(true);
  };

  const activeDescendant = activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  return (
    <CollapsibleSection label="Búnaður" activeCount={selected.length} defaultOpen={defaultOpen}>
      {/* Autocomplete input */}
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
          aria-label="Leita að búnaði"
          placeholder="Leita að búnaði..."
        />
        {showList &&
          filteredSuggestions.length > 0 &&
          createPortal(
            <ul
              id={listId}
              className={styles.suggestionList}
              style={listStyle}
              role="listbox"
              aria-label="Tillögur að búnaði"
              aria-multiselectable="true"
            >
              {filteredSuggestions.map((item, index) => {
                const isSelected = selected.includes(item);
                return (
                  <li
                    key={item}
                    id={`${listId}-option-${index}`}
                    className={`${styles.suggestionItem} ${index === activeIndex ? styles.suggestionItemActive : ""} ${isSelected ? styles.suggestionItemSelected : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleItem(item);
                    }}
                  >
                    <span className={styles.suggestionItemCheck}>{isSelected ? "✓" : ""}</span>
                    {item}
                  </li>
                );
              })}
            </ul>,
            document.body
          )}
      </div>
    </CollapsibleSection>
  );
}
