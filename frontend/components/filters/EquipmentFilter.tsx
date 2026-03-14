"use client";

import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

interface EquipmentFilterProps {
  availableItems: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

/**
 * Checkbox group filter for equipment (Búnaður).
 * Uses OR logic — toggling adds/removes from the selected array.
 */
export default function EquipmentFilter({
  availableItems,
  selected,
  onChange,
  defaultOpen = false,
}: EquipmentFilterProps) {
  const handleToggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((i) => i !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <CollapsibleSection label="Búnaður" activeCount={selected.length} defaultOpen={defaultOpen}>
      <div className={styles.checkboxGroup} role="group" aria-label="Búnaður">
        {availableItems.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <label
              key={item}
              className={`${styles.checkboxLabel} ${isSelected ? styles.checkboxLabelSelected : ""}`}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={isSelected}
                onChange={() => handleToggle(item)}
              />
              {item}
            </label>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
