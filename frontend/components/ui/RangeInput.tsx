"use client";

import React from "react";
import styles from "./primitives.module.css";

interface RangeInputProps {
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  hint?: string;
  step?: number;
  min?: number;
  minLabel: string;
  maxLabel: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}

/**
 * A min/max numeric input pair with an optional live hint.
 * Empty input maps to undefined (not 0).
 */
export default function RangeInput({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  hint,
  step = 1,
  min = 0,
  minLabel,
  maxLabel,
  minPlaceholder,
  maxPlaceholder,
}: RangeInputProps) {
  const handleChange =
    (onChange: (value: number | undefined) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        onChange(undefined);
      } else {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }
    };

  return (
    <div className={styles.rangeInputWrapper}>
      <div className={styles.rangeInputRow}>
        <input
          type="number"
          className={styles.rangeInputField}
          value={minValue ?? ""}
          onChange={handleChange(onMinChange)}
          aria-label={minLabel}
          step={step}
          min={min}
          placeholder={minPlaceholder}
        />
        <span className={styles.rangeInputSeparator} aria-hidden="true">
          &ndash;
        </span>
        <input
          type="number"
          className={styles.rangeInputField}
          value={maxValue ?? ""}
          onChange={handleChange(onMaxChange)}
          aria-label={maxLabel}
          step={step}
          min={min}
          placeholder={maxPlaceholder}
        />
      </div>
      {hint != null && (
        <p className={styles.rangeInputHint} aria-live="polite" aria-atomic="true">
          {hint}
        </p>
      )}
    </div>
  );
}
