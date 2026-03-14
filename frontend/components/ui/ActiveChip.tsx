"use client";

import React from "react";
import styles from "./primitives.module.css";

interface ActiveChipProps {
  label: string;
  onRemove: () => void;
}

/**
 * A removable filter chip for the active filter bar.
 * Displays a label and a close button to remove the filter.
 */
export default function ActiveChip({ label, onRemove }: ActiveChipProps) {
  return (
    <span className={styles.activeChip}>
      <span className={styles.activeChipLabel}>{label}</span>
      <button
        type="button"
        className={styles.activeChipRemove}
        aria-label={`Fjarlægja síu: ${label}`}
        onClick={onRemove}
      >
        <svg
          className={styles.activeChipRemoveIcon}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  );
}
