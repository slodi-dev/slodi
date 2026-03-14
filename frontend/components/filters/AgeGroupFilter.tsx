"use client";

import CollapsibleSection from "@/components/ui/CollapsibleSection";
import styles from "./filters.module.css";

/**
 * All seven AgeGroup enum values from the backend.
 * Values match `backend/app/domain/enums.py` exactly.
 */
const AGE_GROUPS = [
  "Hrefnuskátar",
  "Drekaskátar",
  "Fálkaskátar",
  "Dróttskátar",
  "Rekkaskátar",
  "Róverskátar",
  "Vættaskátar",
] as const;

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
