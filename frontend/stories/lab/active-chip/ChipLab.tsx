import React from "react";
import { X } from "lucide-react";
import styles from "./ChipLab.module.css";

export type ChipTone = "filter" | "selected" | "suggested" | "status" | "deep";

export interface ChipLabProps {
  label: string;
  tone: ChipTone;
  /** A number shown in its own bubble, e.g. how many items match. */
  count?: number;
  onRemove?: () => void;
}

/** Lab copy of `components/ui/ActiveChip` with a range of greens. */
export default function ChipLab({ label, tone, count, onRemove }: ChipLabProps) {
  return (
    <span className={`${styles.chip} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Fjarlægja síu: ${label}`}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
