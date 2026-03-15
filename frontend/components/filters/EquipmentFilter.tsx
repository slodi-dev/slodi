"use client";

import { useState, useEffect, useId, useRef } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface EquipmentFilterProps {
  availableItems: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

export default function EquipmentFilter({
  availableItems,
  selected,
  onChange,
  defaultOpen = false,
}: EquipmentFilterProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputKey > 0) inputRef.current?.focus();
  }, [inputKey]);

  const toggleItem = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);
    setInputValue("");
    setInputKey((k) => k + 1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Only auto-select when the user picks from the datalist dropdown
    if ((e.nativeEvent as InputEvent).inputType === "insertReplacementText") {
      const exact = availableItems.find((s) => s.toLowerCase() === val.toLowerCase());
      if (exact) toggleItem(exact);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const exact = availableItems.find((s) => s.toLowerCase() === inputValue.toLowerCase());
      if (exact) toggleItem(exact);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue("");
    }
  };

  return (
    <CollapsibleSection label="Búnaður" activeCount={selected.length} defaultOpen={defaultOpen}>
      <div className={styles.comboboxWrapper}>
        <input
          key={inputKey}
          ref={inputRef}
          type="text"
          list={listId}
          className={styles.comboboxInput}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Leita að búnaði"
          placeholder="Leita að búnaði..."
          autoComplete="off"
          spellCheck={false}
        />
        <datalist id={listId}>
          {availableItems.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
    </CollapsibleSection>
  );
}
