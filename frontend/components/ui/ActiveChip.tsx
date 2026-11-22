"use client";

import React from "react";
import { cn } from "@/lib/util";
import styles from "./primitives.module.css";

interface ActiveChipProps {
  label: string;
  /** Omit for a static, non-removable chip (a status label rather than a filter). */
  onRemove?: () => void;
  /**
   * `hidden` is the muted, dashed, eye-slashed status chip used to mark content
   * a moderator has hidden. The icon and the label carry the meaning; the
   * colour only supports them.
   */
  tone?: "active" | "hidden";
  className?: string;
}

/**
 * A chip. With `onRemove` it is a removable filter chip for the active filter
 * bar; without it, a static status label.
 */
export default function ActiveChip({
  label,
  onRemove,
  tone = "active",
  className,
}: ActiveChipProps) {
  return (
    <span
      className={cn(styles.activeChip, tone === "hidden" && styles.activeChipHidden, className)}
    >
      {tone === "hidden" && (
        <svg
          className={styles.activeChipIcon}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      )}
      <span className={styles.activeChipLabel}>{label}</span>
      {onRemove && (
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
      )}
    </span>
  );
}
