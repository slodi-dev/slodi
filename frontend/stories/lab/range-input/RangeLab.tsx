"use client";

import React, { useId, useState } from "react";
import styles from "./RangeLab.module.css";

export type RangeLayout = "bubbles";

export interface RangeLabProps {
  layout: RangeLayout;
  /** Lowest and highest value the slider can reach. */
  min: number;
  max: number;
  step?: number;
  /** `undefined` means no limit on that side, as in RangeInput. */
  minValue: number | undefined;
  maxValue: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
  /** Short unit shown after numbers, e.g. "mín". */
  unit?: string;
  /** Accessible name of the whole control, e.g. "Lengd". */
  label: string;
}

/**
 * Lab copy of `components/ui/RangeInput`: a two-handled slider whose values ride on the handles
 * and can be typed into. A handle at the end of the track means "no limit", so the filter is off
 * on that side.
 */
export default function RangeLab({
  layout,
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  onChange,
  unit,
  label,
}: RangeLabProps) {
  const id = useId();
  const lo = minValue ?? min;
  const hi = maxValue ?? max;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const setLo = (v: number) => onChange(v <= min ? undefined : Math.min(v, hi), maxValue);
  const setHi = (v: number) => onChange(minValue, v >= max ? undefined : Math.max(v, lo));

  const show = (v: number | undefined, open: string) =>
    v === undefined ? open : `${v}${unit ? ` ${unit}` : ""}`;
  const minText = show(minValue, `${min}`);
  const maxText = show(maxValue, `${max}+`);

  const slider = (
    <div
      className={styles.slider}
      style={{ "--lo": `${pct(lo)}%`, "--hi": `${pct(hi)}%` } as React.CSSProperties}
    >
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} />
      </div>
      <input
        type="range"
        className={styles.thumb}
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => setLo(Number(e.target.value))}
        aria-label={`${label}: lágmark`}
        aria-valuetext={minValue === undefined ? "Ekkert lágmark" : minText}
      />
      <input
        type="range"
        className={styles.thumb}
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => setHi(Number(e.target.value))}
        aria-label={`${label}: hámark`}
        aria-valuetext={maxValue === undefined ? "Ekkert hámark" : maxText}
      />
      {/* When the handles are close, the two values lean apart instead of overlapping. */}
      <BubbleField
        id={`${id}-lo`}
        ariaLabel={`${label}: lágmark`}
        value={minValue}
        placeholder={`${min}`}
        unit={unit}
        min={min}
        max={max}
        step={step}
        left={pct(lo)}
        lean={pct(hi) - pct(lo) < 22 ? "left" : "center"}
        onCommit={(v) => onChange(v === undefined ? undefined : Math.min(v, hi), maxValue)}
      />
      <BubbleField
        id={`${id}-hi`}
        ariaLabel={`${label}: hámark`}
        value={maxValue}
        placeholder={`${max}+`}
        unit={unit}
        min={min}
        max={max}
        step={step}
        left={pct(hi)}
        lean={pct(hi) - pct(lo) < 22 ? "right" : "center"}
        onCommit={(v) => onChange(minValue, v === undefined ? undefined : Math.max(v, lo))}
      />
    </div>
  );

  const scale = (
    <div className={styles.scale} aria-hidden="true">
      <span>{min}</span>
      <span>{max}+</span>
    </div>
  );

  return (
    <div className={`${styles.range} ${styles[layout]}`} role="group" aria-label={label}>
      {slider}
      {scale}
    </div>
  );
}

/**
 * The value riding on a handle, editable in place: click (or Tab to) it and type. Commits on
 * blur or Enter, so typing "1" on the way to "15" doesn't jump the slider; Escape puts the old
 * value back. Empty means "no limit".
 */
function BubbleField({
  id,
  ariaLabel,
  value,
  placeholder,
  unit,
  min,
  max,
  step,
  left,
  lean,
  onCommit,
}: {
  id: string;
  ariaLabel: string;
  value: number | undefined;
  placeholder: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  left: number;
  lean: "left" | "center" | "right";
  onCommit: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : String(value));
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    onCommit(draft.trim() === "" || Number.isNaN(n) ? undefined : Math.max(min, Math.min(max, n)));
    setDraft(null);
  };
  return (
    <label
      className={`${styles.bubble} ${styles.bubbleField} ${styles[`lean-${lean}`]}`}
      style={{ left: `${left}%` }}
      htmlFor={id}
    >
      <input
        id={id}
        className={styles.bubbleInput}
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={shown}
        // Grow with the number, so "5" and "120" both sit snugly in the bubble.
        style={{ width: `${Math.max(shown.length || placeholder.length, 1) + 0.5}ch` }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      {unit && <span aria-hidden="true">{unit}</span>}
    </label>
  );
}
