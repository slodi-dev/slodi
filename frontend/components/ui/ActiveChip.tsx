"use client";

import React from "react";
import { cn } from "@/lib/util";
import styles from "./primitives.module.css";

interface ActiveChipProps {
  label: string;
  /** Omit for a static, non-removable chip (a status label rather than a filter). */
  onRemove?: () => void;
  /**
   * What the chip means. The shape stays the same; the green changes (picked in
   * Lab/ActiveChip, 2026-10-19):
   * - `active` — an applied filter you can remove (the default).
   * - `selected` — the one picked from a set, e.g. ALLT / DAGSKRÁ / LEIKUR. Full strength.
   * - `suggested` — offered but not applied: "add this filter", an optional tag. Dashed.
   * - `status` — a fact about the item, not clickable: "Staðfest".
   * - `deep` — a category or færnimerki that should stand out.
   * - `hidden` — the muted, dashed, eye-slashed chip marking content a moderator
   *   has hidden. The icon and the label carry the meaning; the colour only supports them.
   */
  tone?: "active" | "selected" | "suggested" | "status" | "deep" | "hidden";
  /** A number in its own bubble, e.g. how many items match. */
  count?: number;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<ActiveChipProps["tone"]>, string | undefined> = {
  active: undefined,
  selected: styles.activeChipSelected,
  suggested: styles.activeChipSuggested,
  status: styles.activeChipStatus,
  deep: styles.activeChipDeep,
  hidden: styles.activeChipHidden,
};

/**
 * A chip. With `onRemove` it is a removable filter chip for the active filter
 * bar; without it, a static status label.
 */
export default function ActiveChip({
  label,
  onRemove,
  tone = "active",
  count,
  className,
}: ActiveChipProps) {
  return (
    <span className={cn(styles.activeChip, TONE_CLASS[tone], className)}>
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
      {count !== undefined && <span className={styles.activeChipCount}>{count}</span>}
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
