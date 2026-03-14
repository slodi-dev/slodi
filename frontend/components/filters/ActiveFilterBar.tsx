"use client";

import React from "react";
import ActiveChip from "@/components/ui/ActiveChip";
import type { ActiveChip as ActiveChipType } from "@/hooks/useProgramFilters";
import styles from "./ActiveFilterBar.module.css";

interface ActiveFilterBarProps {
  chips: ActiveChipType[];
  onClearAll: () => void;
}

/**
 * Displays active filter chips with a "Hreinsa allt" (Clear all) button.
 * Returns null when no filters are active.
 */
export default function ActiveFilterBar({ chips, onClearAll }: ActiveFilterBarProps) {
  if (chips.length === 0) return null;

  return (
    <div role="region" aria-label="Virkar síur" className={styles.bar}>
      {chips.map((chip) => (
        <ActiveChip key={chip.key} label={chip.label} onRemove={chip.remove} />
      ))}
      <button
        type="button"
        className={styles.clearAllButton}
        onClick={onClearAll}
        aria-label="Hreinsa allar síur"
      >
        Hreinsa allt
      </button>
    </div>
  );
}
