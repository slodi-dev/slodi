"use client";

import React, { useId, useState } from "react";
import styles from "./RangeLab.module.css";

export type RangeLayout = "stacked" | "inline" | "bubbles" | "presets";

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
  presets?: { label: string; min?: number; max?: number }[];
}

/**
 * Lab copy of `components/ui/RangeInput`: a two-handled slider plus number fields that stay in
 * step. A handle at the end of the track means "no limit", so the filter is off on that side.
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
  presets,
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
      {layout === "bubbles" && (
        <>
          <output className={styles.bubble} style={{ left: `${pct(lo)}%` }}>
            {minText}
          </output>
          <output className={styles.bubble} style={{ left: `${pct(hi)}%` }}>
            {maxText}
          </output>
        </>
      )}
    </div>
  );

  const field = (which: "lo" | "hi") => (
    <NumberField
      id={`${id}-${which}`}
      label={which === "lo" ? "Frá" : "Til"}
      ariaLabel={`${label}: ${which === "lo" ? "lágmark" : "hámark"}`}
      value={which === "lo" ? minValue : maxValue}
      placeholder={which === "lo" ? `${min}` : `${max}+`}
      unit={unit}
      min={min}
      max={max}
      step={step}
      onCommit={(v) => (which === "lo" ? onChange(v, maxValue) : onChange(minValue, v))}
    />
  );

  const scale = (
    <div className={styles.scale} aria-hidden="true">
      <span>{min}</span>
      <span>{max}+</span>
    </div>
  );

  return (
    <div className={`${styles.range} ${styles[layout]}`} role="group" aria-label={label}>
      {layout === "presets" && presets && (
        <div className={styles.presets}>
          {presets.map((p) => {
            const on = p.min === minValue && p.max === maxValue;
            return (
              <button
                key={p.label}
                type="button"
                className={styles.preset}
                aria-pressed={on}
                onClick={() => (on ? onChange(undefined, undefined) : onChange(p.min, p.max))}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
      {layout === "inline" ? (
        <div className={styles.inlineRow}>
          {field("lo")}
          {slider}
          {field("hi")}
        </div>
      ) : (
        <>
          {slider}
          {scale}
          {layout !== "bubbles" && (
            <div className={styles.fields}>
              {field("lo")}
              <span className={styles.dash} aria-hidden="true">
                –
              </span>
              {field("hi")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** A narrow number field that commits on blur or Enter, so typing "1" on the way to "15" doesn't jump the slider. */
function NumberField({
  id,
  label,
  ariaLabel,
  value,
  placeholder,
  unit,
  min,
  max,
  step,
  onCommit,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  value: number | undefined;
  placeholder: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    onCommit(draft.trim() === "" || Number.isNaN(n) ? undefined : Math.max(min, Math.min(max, n)));
    setDraft(null);
  };
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        id={id}
        className={styles.input}
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={draft ?? (value === undefined ? "" : String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {unit && <span className={styles.unit}>{unit}</span>}
    </label>
  );
}
