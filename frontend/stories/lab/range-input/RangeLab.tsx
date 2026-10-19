"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import styles from "./RangeLab.module.css";

/**
 * How a number is typed in by hand. The slider with values riding on the handles is the same in
 * all of them.
 * - `inline`: C1, the value on the handle is itself the input.
 * - `popover`: C2, the value is a button that opens a small field with −/+ and "Í lagi".
 * - `steppers`: C3, − and + flank each value (hold to repeat); the value can still be typed into.
 * - `fields`: C4, the values on the handles are for reading; two fields under the ends do the typing.
 * - `presets`: C5, the value opens a list of common values, plus "Annað…" for a number field.
 */
export type RangeEntry = "inline" | "popover" | "steppers" | "fields" | "presets";

export interface RangeLabProps {
  entry: RangeEntry;
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
  /** Common values offered by the `presets` entry. */
  presets?: number[];
}

type Side = "lo" | "hi";
type Lean = "left" | "center" | "right";

const SIDE_NAME: Record<Side, string> = { lo: "lágmark", hi: "hámark" };
const NO_LIMIT: Record<Side, string> = { lo: "Ekkert lágmark", hi: "Ekkert hámark" };
const DEFAULT_PRESETS = [15, 30, 45, 60, 90, 120];
/** When the handles are closer than this (percent of the track), their values lean apart. */
const LEAN_APART_BELOW = 22;

/**
 * Where a handle's centre is, as a CSS length. The thumbs are a full hit area wide and stop half
 * of it short of each end, so 0% is half a hit area in from the left.
 */
const alongTrack = (percent: number) =>
  `calc(var(--hit) / 2 + (100% - var(--hit)) * ${percent / 100})`;

/** Turns what was typed into a number: empty means no limit, anything unreadable is ignored. */
function parseTyped(text: string): number | undefined | null {
  if (text.trim() === "") return undefined;
  const n = Number(text);
  return Number.isNaN(n) ? null : n;
}

/**
 * Lab copy of `components/ui/RangeInput`: a two-handled slider whose values ride on the handles.
 * A handle at the end of the track means "no limit", so the filter is off on that side. `entry`
 * picks how a number is typed in by hand.
 */
export default function RangeLab({
  entry,
  min,
  max,
  step = 1,
  minValue,
  maxValue,
  onChange,
  unit,
  label,
  presets = DEFAULT_PRESETS,
}: RangeLabProps) {
  const id = useId();
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const triggers = useRef<Record<Side, HTMLButtonElement | null>>({ lo: null, hi: null });

  const lo = minValue ?? min;
  const hi = maxValue ?? max;
  const limit: Record<Side, number | undefined> = { lo: minValue, hi: maxValue };
  const position: Record<Side, number> = { lo, hi };
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const handlesClose = pct(hi) - pct(lo) < LEAN_APART_BELOW;
  const leanOf = (side: Side): Lean =>
    handlesClose ? (side === "lo" ? "left" : "right") : "center";

  /** What the handle shows: the number, or "0" / "180+" when that side has no limit. */
  const shownNumber = (side: Side, v: number | undefined) =>
    v === undefined ? (side === "lo" ? `${min}` : `${max}+`) : `${v}`;
  const withUnit = (text: string) => (unit ? `${text} ${unit}` : text);
  const spoken = (side: Side, v: number | undefined) =>
    v === undefined ? NO_LIMIT[side] : withUnit(`${v}`);

  /**
   * Clamps into the scale, snaps to the step and keeps min ≤ max. A value at the end of the
   * track becomes `undefined`: no limit on that side.
   */
  const settle = (side: Side, v: number | undefined) => {
    if (v === undefined) return undefined;
    const snapped = Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
    if (side === "lo") {
      const ordered = Math.min(snapped, hi);
      return ordered <= min ? undefined : ordered;
    }
    const ordered = Math.max(snapped, lo);
    return ordered >= max ? undefined : ordered;
  };

  /**
   * Sets one side. Changes made from outside the slider are spoken through the status region,
   * because focus is on a field or button then, not on the slider whose aria-valuetext changed.
   */
  const setSide = (side: Side, v: number | undefined, announce = true) => {
    const next = settle(side, v);
    if (side === "lo") onChange(next, maxValue);
    else onChange(minValue, next);
    if (announce) {
      const said =
        next === undefined
          ? `ekkert ${SIDE_NAME[side]}`
          : `${SIDE_NAME[side]} ${withUnit(`${next}`)}`;
      setAnnouncement(`${label}: ${said}`);
    }
  };

  const closePopover = (returnFocus: boolean) => {
    const side = openSide;
    setOpenSide(null);
    if (returnFocus && side) triggers.current[side]?.focus();
  };
  const commitFromPopover = (side: Side, v: number | undefined) => {
    setSide(side, v);
    closePopover(true);
  };

  const sliderInput = (side: Side) => (
    <input
      type="range"
      className={styles.thumb}
      min={min}
      max={max}
      step={step}
      value={position[side]}
      onChange={(e) => setSide(side, Number(e.target.value), false)}
      aria-label={`${label}: ${SIDE_NAME[side]}`}
      aria-valuetext={spoken(side, limit[side])}
    />
  );

  /** The look of a value on a handle: a dark pill with the number and a small unit. */
  const face = (side: Side) => (
    <>
      <span>{shownNumber(side, limit[side])}</span>
      {unit && <span className={styles.unit}>{unit}</span>}
    </>
  );

  const ridingValue = (side: Side) => {
    const at = { left: alongTrack(pct(position[side])) };
    const placement = `${styles.bubble} ${styles.face} ${styles[`lean-${leanOf(side)}`]}`;
    const fieldId = `${id}-${side}`;

    if (entry === "inline") {
      return (
        <label key={side} className={`${placement} ${styles.hitUp}`} style={at} htmlFor={fieldId}>
          <NumberField
            id={fieldId}
            className={styles.faceInput}
            grow
            aria-label={`${label}: ${SIDE_NAME[side]}`}
            value={limit[side]}
            placeholder={shownNumber(side, undefined)}
            min={min}
            max={max}
            step={step}
            onCommit={(v) => setSide(side, v)}
          />
          {unit && (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          )}
        </label>
      );
    }

    if (entry === "popover" || entry === "presets") {
      const popoverId = `${id}-${side}-popover`;
      const isOpen = openSide === side;
      return (
        <React.Fragment key={side}>
          <button
            type="button"
            ref={(el) => {
              triggers.current[side] = el;
            }}
            className={`${placement} ${styles.hitUp} ${styles.faceButton}`}
            style={at}
            aria-label={`${label}: ${SIDE_NAME[side]}, ${withUnit(shownNumber(side, limit[side]))}`}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={isOpen ? popoverId : undefined}
            onClick={() => setOpenSide(isOpen ? null : side)}
          >
            {face(side)}
          </button>
          {isOpen && (
            <Popover
              id={popoverId}
              title={side === "lo" ? "Lágmark" : "Hámark"}
              ariaLabel={`${label}: ${SIDE_NAME[side]}`}
              anchor={pct(position[side])}
              getTrigger={() => triggers.current[side]}
              onCancel={closePopover}
            >
              {entry === "popover" ? (
                <NumberForm
                  initial={limit[side]}
                  emptyMeans={side === "lo" ? min : max}
                  placeholder={shownNumber(side, undefined)}
                  fieldLabel={`${label}: ${SIDE_NAME[side]}`}
                  min={min}
                  max={max}
                  step={step}
                  unit={unit}
                  steppers
                  onSubmit={(v) => commitFromPopover(side, v)}
                />
              ) : (
                <PresetPanel
                  side={side}
                  current={limit[side]}
                  options={presets.filter((p) =>
                    side === "lo" ? p > min && p <= hi && p < max : p < max && p >= lo && p > min
                  )}
                  withUnit={withUnit}
                  form={
                    <NumberForm
                      initial={limit[side]}
                      emptyMeans={side === "lo" ? min : max}
                      placeholder={shownNumber(side, undefined)}
                      fieldLabel={`${label}: ${SIDE_NAME[side]}`}
                      min={min}
                      max={max}
                      step={step}
                      unit={unit}
                      onSubmit={(v) => commitFromPopover(side, v)}
                    />
                  }
                  onPick={(v) => commitFromPopover(side, v)}
                />
              )}
            </Popover>
          )}
        </React.Fragment>
      );
    }

    if (entry === "steppers") {
      const p = pct(position[side]);
      const current = position[side];
      return (
        // The minimum's cluster rides above the track and the maximum's below, so the two
        // never collide however close the handles are. Each is anchored so it stays inside.
        <div
          key={side}
          className={`${styles.cluster} ${side === "lo" ? styles.clusterAbove : styles.clusterBelow}`}
          style={{ left: alongTrack(p), transform: `translateX(-${p}%)` }}
        >
          <HoldButton
            label={`${label}: lækka ${SIDE_NAME[side]}`}
            onStep={() => setSide(side, current - step)}
          >
            −
          </HoldButton>
          <label className={styles.face} htmlFor={fieldId}>
            <NumberField
              id={fieldId}
              className={styles.faceInput}
              grow
              aria-label={`${label}: ${SIDE_NAME[side]}`}
              value={limit[side]}
              placeholder={shownNumber(side, undefined)}
              min={min}
              max={max}
              step={step}
              onCommit={(v) => setSide(side, v)}
            />
            {unit && (
              <span className={styles.unit} aria-hidden="true">
                {unit}
              </span>
            )}
          </label>
          <HoldButton
            label={`${label}: hækka ${SIDE_NAME[side]}`}
            onStep={() => setSide(side, current + step)}
          >
            +
          </HoldButton>
        </div>
      );
    }

    // `fields`: the values on the handles are for reading only; the fields below do the typing,
    // and the slider already speaks its value, so this copy is hidden from screen readers.
    return (
      <span key={side} className={placement} style={at} aria-hidden="true">
        {face(side)}
      </span>
    );
  };

  const endField = (side: Side) => (
    <label className={styles.endField} key={side}>
      <span>{side === "lo" ? "Frá" : "Til"}</span>
      <NumberField
        className={styles.field}
        aria-label={`${label}: ${side === "lo" ? "frá" : "til"}`}
        value={limit[side]}
        placeholder={shownNumber(side, undefined)}
        min={min}
        max={max}
        step={step}
        onCommit={(v) => setSide(side, v)}
      />
      {unit && <span aria-hidden="true">{unit}</span>}
    </label>
  );

  return (
    <div className={styles.range} data-entry={entry} role="group" aria-label={label}>
      <div
        className={styles.slider}
        style={{ "--lo": pct(lo) / 100, "--hi": pct(hi) / 100 } as React.CSSProperties}
      >
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} />
        </div>
        {sliderInput("lo")}
        {sliderInput("hi")}
        {ridingValue("lo")}
        {ridingValue("hi")}
      </div>
      {entry === "fields" ? (
        <div className={styles.ends}>
          {endField("lo")}
          {endField("hi")}
        </div>
      ) : (
        <div className={styles.scale} aria-hidden="true">
          <span>{min}</span>
          <span>{max}+</span>
        </div>
      )}
      <span className={styles.srOnly} role="status">
        {announcement}
      </span>
    </div>
  );
}

/**
 * A number input that commits on blur or Enter, so typing "1" on the way to "15" doesn't jump
 * the slider. Escape puts the old value back. Empty means "no limit". Follows `value` whenever
 * it isn't being edited, so a dragged handle shows up here straight away.
 */
function NumberField({
  value,
  placeholder,
  grow = false,
  onCommit,
  ...input
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | undefined;
  placeholder: string;
  /** Size to the number, for the pill on a handle. */
  grow?: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : String(value));
  const commit = () => {
    if (draft === null) return;
    const typed = parseTyped(draft);
    if (typed !== null) onCommit(typed);
    setDraft(null);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      value={shown}
      style={
        grow ? { width: `${Math.max(shown.length || placeholder.length, 1) + 0.5}ch` } : undefined
      }
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // Never submits a surrounding filter form (UX rule 6).
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape" && draft !== null) {
          e.stopPropagation();
          setDraft(null);
        }
      }}
      {...input}
    />
  );
}

/**
 * A small non-modal dialog anchored under a handle. Escape, a click outside or tabbing out of it
 * cancels. It is anchored the way the handle's value is, so it never spills past the track.
 */
function Popover({
  id,
  title,
  ariaLabel,
  anchor,
  getTrigger,
  onCancel,
  children,
}: {
  id: string;
  title: string;
  ariaLabel: string;
  /** Position of the handle, percent of the track. */
  anchor: number;
  getTrigger: () => HTMLElement | null;
  onCancel: (returnFocus: boolean) => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // The latest callbacks, so the document listener is added once per opening.
  const cancel = useRef(onCancel);
  const trigger = useRef(getTrigger);
  useEffect(() => {
    cancel.current = onCancel;
    trigger.current = getTrigger;
  });
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The trigger toggles the popover itself, on click.
      if (panel.current?.contains(target) || trigger.current()?.contains(target)) return;
      // After this event, not inside it: the press may be on the other value, which then opens.
      window.setTimeout(() => cancel.current(false));
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div
      ref={panel}
      id={id}
      role="dialog"
      aria-label={ariaLabel}
      className={styles.popover}
      style={{ left: alongTrack(anchor), transform: `translateX(-${anchor}%)` }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          cancel.current(true);
        }
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !panel.current?.contains(next)) cancel.current(false);
      }}
    >
      <p className={styles.popoverTitle} aria-hidden="true">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * A number field with "Í lagi", for inside a popover. Nothing reaches the slider until "Í lagi"
 * or Enter. The optional −/+ change the draft by one step.
 */
function NumberForm({
  initial,
  emptyMeans,
  placeholder,
  fieldLabel,
  min,
  max,
  step,
  unit,
  steppers = false,
  onSubmit,
}: {
  initial: number | undefined;
  /** What an empty field stands for (the end of the track), so −/+ start from there. */
  emptyMeans: number;
  placeholder: string;
  fieldLabel: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  steppers?: boolean;
  onSubmit: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(initial === undefined ? "" : String(initial));
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const nudge = (direction: 1 | -1) => {
    const from = parseTyped(draft) ?? emptyMeans;
    setDraft(String(Math.min(max, Math.max(min, from + direction * step))));
  };
  const submit = () => {
    const typed = parseTyped(draft);
    if (typed !== null) onSubmit(typed);
  };

  return (
    <div className={styles.form}>
      <div className={styles.formRow}>
        {steppers && (
          <button
            type="button"
            className={styles.stepper}
            aria-label={`Lækka um ${step}`}
            onClick={() => nudge(-1)}
          >
            −
          </button>
        )}
        <input
          ref={field}
          type="number"
          inputMode="numeric"
          className={styles.field}
          aria-label={fieldLabel}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        {unit && <span aria-hidden="true">{unit}</span>}
        {steppers && (
          <button
            type="button"
            className={styles.stepper}
            aria-label={`Hækka um ${step}`}
            onClick={() => nudge(1)}
          >
            +
          </button>
        )}
      </div>
      <button type="button" className={styles.ok} onClick={submit}>
        Í lagi
      </button>
    </div>
  );
}

/**
 * Common values as one-tap buttons, plus "no limit" and "Annað…", which reveals a number field.
 * Only values that keep min ≤ max are offered. Focus starts on the current value.
 */
function PresetPanel({
  side,
  current,
  options,
  withUnit,
  form,
  onPick,
}: {
  side: Side;
  current: number | undefined;
  options: number[];
  withUnit: (text: string) => string;
  form: React.ReactNode;
  onPick: (v: number | undefined) => void;
}) {
  const [custom, setCustom] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button");
    const pressed = list.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (pressed ?? buttons?.[0])?.focus();
  }, []);

  return (
    <>
      <div className={styles.presets} ref={list}>
        <button
          type="button"
          className={`${styles.preset} ${styles.presetWide}`}
          aria-pressed={current === undefined}
          onClick={() => onPick(undefined)}
        >
          {NO_LIMIT[side]}
        </button>
        {options.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.preset}
            aria-pressed={current === p}
            onClick={() => onPick(p)}
          >
            {withUnit(`${p}`)}
          </button>
        ))}
        {!custom && (
          <button
            type="button"
            className={`${styles.preset} ${styles.presetWide}`}
            onClick={() => setCustom(true)}
          >
            Annað…
          </button>
        )}
      </div>
      {custom && form}
    </>
  );
}

/**
 * A − or + that steps once on press and keeps stepping while held. Keyboard presses (a click
 * with no pointer) step once each, and Enter held down repeats through key repeat.
 */
function HoldButton({
  label,
  onStep,
  children,
}: {
  label: string;
  onStep: () => void;
  children: React.ReactNode;
}) {
  // The latest step, so each repeat sees the value the previous one produced.
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });
  const delay = useRef<number | undefined>(undefined);
  const repeat = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(delay.current);
    window.clearInterval(repeat.current);
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      className={styles.stepper}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        stop();
        step.current();
        delay.current = window.setTimeout(() => {
          repeat.current = window.setInterval(() => step.current(), 80);
        }, 400);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.detail === 0) step.current();
      }}
    >
      {children}
    </button>
  );
}
