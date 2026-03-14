"use client";

import { useRef, useCallback } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface EquipmentFilterProps {
  availableItems: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

/**
 * Multi-select inline-autocomplete filter for equipment (Búnaður).
 * Tab / ArrowRight / Enter toggles the matched item and clears the input.
 */
export default function EquipmentFilter({
  availableItems,
  selected,
  onChange,
  defaultOpen = false,
}: EquipmentFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef("");

  const findMatch = useCallback(
    (typed: string) =>
      availableItems.find((s) => s.toLowerCase().startsWith(typed.toLowerCase())) ?? null,
    [availableItems]
  );

  const toggleItem = useCallback(
    (item: string) => {
      onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);
      if (inputRef.current) inputRef.current.value = "";
      typedRef.current = "";
    },
    [selected, onChange]
  );

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
          toggleItem(input.value);
        }
        break;
      case "Enter": {
        const exact =
          !hasCompletion &&
          availableItems.find((s) => s.toLowerCase() === typedRef.current.toLowerCase());
        if (hasCompletion || exact) {
          e.preventDefault();
          toggleItem(hasCompletion ? input.value : (exact as string));
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        input.value = "";
        typedRef.current = "";
        break;
    }
  };

  return (
    <CollapsibleSection label="Búnaður" activeCount={selected.length} defaultOpen={defaultOpen}>
      <div className={styles.comboboxWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.comboboxInput}
          defaultValue=""
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Leita að búnaði"
          aria-autocomplete="inline"
          placeholder="Leita að búnaði..."
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </CollapsibleSection>
  );
}
