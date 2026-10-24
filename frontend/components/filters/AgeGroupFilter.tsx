"use client";

import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { AGE_GROUPS, getAgeGroupPatrol } from "@/lib/format";
import styles from "./filters.module.css";

interface AgeGroupFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultOpen?: boolean;
}

/**
 * Checkbox group filter for age groups (Aldurshópar).
 * Displays all seven AgeGroup enum values with OR toggle logic.
 */
export default function AgeGroupFilter({
  selected,
  onChange,
  defaultOpen = false,
}: AgeGroupFilterProps) {
  const handleToggle = (ageGroup: string) => {
    if (selected.includes(ageGroup)) {
      onChange(selected.filter((a) => a !== ageGroup));
    } else {
      onChange([...selected, ageGroup]);
    }
  };

  return (
    <CollapsibleSection label="Aldurshópur" activeCount={selected.length} defaultOpen={defaultOpen}>
      <div className={styles.checkboxGroup} role="group" aria-label="Aldurshópar">
        {AGE_GROUPS.map((ageGroup) => {
          const isSelected = selected.includes(ageGroup);
          return (
            <label
              key={ageGroup}
              className={`${styles.checkboxLabel} ${isSelected ? styles.checkboxLabelSelected : ""}`}
              // Ticks in the band's own colour, as in the create form.
              style={
                {
                  "--patrol": `var(--sl-color-patrol-${getAgeGroupPatrol(ageGroup) ?? "adrir"})`,
                } as React.CSSProperties
              }
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={isSelected}
                onChange={() => handleToggle(ageGroup)}
              />
              {ageGroup}
            </label>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
