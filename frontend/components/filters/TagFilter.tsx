"use client";

import { useMemo } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface TagFilterProps {
  availableTags: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

/**
 * Checkbox group filter for tags (Flokkar).
 * Tags are sorted alphabetically regardless of selection state.
 */
export default function TagFilter({
  availableTags,
  selected,
  onChange,
  defaultOpen = false,
}: TagFilterProps) {
  const sortedTags = useMemo(() => {
    return [...availableTags].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [availableTags]);

  const handleToggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <CollapsibleSection label="Flokkar" activeCount={selected.length} defaultOpen={defaultOpen}>
      <div className={styles.checkboxGroup} role="group" aria-label="Flokkar">
        {sortedTags.map((tag) => {
          const isSelected = selected.includes(tag);
          return (
            <label
              key={tag}
              className={`${styles.checkboxLabel} ${isSelected ? styles.checkboxLabelSelected : ""}`}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={isSelected}
                onChange={() => handleToggle(tag)}
              />
              {tag}
            </label>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
