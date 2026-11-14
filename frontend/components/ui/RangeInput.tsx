"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./primitives.module.css";

interface RangeInputProps {
  /** `undefined` means no limit on that side. */
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  hint?: string;
  step?: number;
  /** Bottom of the scale. A minimum here means no limit. */
  min?: number;
  /** Top of the scale, shown as "180+". A maximum here means no limit. */
  max?: number;
  /** Short unit after numbers, e.g. "mín". */
  unit?: string;
  /** Accessible names of the two handles, e.g. "Lágmark: mínútur". */
  minLabel: string;
  maxLabel: string;
}

type Side = "lo" | "hi";
type Pair = Record<Side, number>;

/** At or below this width the editor opens as a bottom sheet (UX rule 7). */
const SHEET_QUERY = "(max-width: 620px)";
/** Width of the visible handle; the thumbs stop half of it short of each end. */
const THUMB_REM = 1.25;
/** When the handles are closer than this (fraction of the track), their values lean apart. */
const LEAN_APART_BELOW = 0.22;
const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 80;
const EDGE_GAP_PX = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** What was typed, as a number; empty means no limit. */
const parseDraft = (draft: string) => (draft === "" ? undefined : Number(draft));

/** A CSS length: where a handle's centre is, for a fraction (0–1) of the scale. */
const alongTrack = (fraction: number) =>
  `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${fraction})`;

/** One drag or tap on the track, from pointerdown to pointerup. */
interface Gesture {
  pointerId: number;
  /** `null` until the first move decides, when both handles are equally near. */
  side: Side | null;
  /** Started on a handle (no page scroll) rather than on the bare track. */
  onThumb: boolean;
  startValue: number;
  moved: boolean;
  values: Pair;
}

/**
 * A two-handled slider whose values ride on the handles. Drag a handle, or tap its value to type
 * a number in a small popover (a bottom sheet on phones) with −/+ and "Í lagi". A handle at the
 * end of the track means no limit on that side, and is reported as `undefined`.
 *
 * Changes are reported when they are finished: on "Í lagi", when a drag is released, and on each
 * arrow-key step. While dragging, only the handles move, so a filter doesn't refetch on every
 * pixel.
 */
export default function RangeInput({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  hint,
  step = 1,
  min = 0,
  max = 100,
  unit,
  minLabel,
  maxLabel,
}: RangeInputProps) {
  const [dragging, setDragging] = useState<Pair | null>(null);
  const [editing, setEditing] = useState<Side | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const strip = useRef<HTMLDivElement>(null);
  const sliders = useRef<Record<Side, HTMLInputElement | null>>({ lo: null, hi: null });
  const triggers = useRef<Record<Side, HTMLButtonElement | null>>({ lo: null, hi: null });
  const gesture = useRef<Gesture | null>(null);

  const label: Record<Side, string> = { lo: minLabel, hi: maxLabel };
  const limits: Record<Side, number | undefined> = { lo: minValue, hi: maxValue };
  const committed: Pair = {
    lo: clamp(minValue ?? min, min, max),
    hi: clamp(maxValue ?? max, min, max),
  };
  const shown = dragging ?? committed;
  const fraction = (v: number) => (max > min ? (v - min) / (max - min) : 0);
  const snap = (v: number) => clamp(min + Math.round((v - min) / step) * step, min, max);
  /** A value at the end of its side's track means no limit. */
  const asLimit = (side: Side, v: number) =>
    side === "lo" ? (v <= min ? undefined : v) : v >= max ? undefined : v;

  const numberText = (side: Side, v: number | undefined) =>
    v === undefined ? (side === "lo" ? `${min}` : `${max}+`) : `${v}`;
  const withUnit = (text: string) => (unit ? `${text} ${unit}` : text);
  const spoken = (side: Side, v: number | undefined) =>
    v === undefined ? (side === "lo" ? "Ekkert lágmark" : "Ekkert hámark") : withUnit(`${v}`);

  /** Reports one side, clamped to the scale, snapped to the step and kept in order. */
  const commit = (side: Side, v: number | undefined, announce = false) => {
    const ordered =
      v === undefined
        ? undefined
        : side === "lo"
          ? Math.min(snap(v), committed.hi)
          : Math.max(snap(v), committed.lo);
    const next = ordered === undefined ? undefined : asLimit(side, ordered);
    if (next !== limits[side]) (side === "lo" ? onMinChange : onMaxChange)(next);
    // Focus is in the editor, not on the slider, so its aria-valuetext isn't read out. A filter's
    // hint is a live region already; without one, say it here.
    if (announce && hint == null) setAnnouncement(`${label[side]}: ${spoken(side, next)}`);
  };

  // ── Dragging ──
  // The native range inputs are only for the keyboard and screen readers; pointers are handled
  // here, so two handles at the same value can both be grabbed (the drag direction decides) and
  // a swipe that starts on the bare track still scrolls the page.

  const valueAt = (clientX: number) => {
    const rect = strip.current!.getBoundingClientRect();
    const thumb = THUMB_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const f = (clientX - rect.left - thumb / 2) / Math.max(1, rect.width - thumb);
    return snap(min + clamp(f, 0, 1) * (max - min));
  };
  const nearestSide = (v: number, values: Pair): Side | null => {
    const toLo = Math.abs(v - values.lo);
    const toHi = Math.abs(v - values.hi);
    return toLo === toHi ? null : toLo < toHi ? "lo" : "hi";
  };
  const moveTo = (g: Gesture, side: Side, v: number) => {
    g.values =
      side === "lo"
        ? { ...g.values, lo: Math.min(v, g.values.hi) }
        : { ...g.values, hi: Math.max(v, g.values.lo) };
    setDragging(g.values);
  };
  const finish = (keep: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(null);
    if (!g || !keep || !g.side) return;
    const next = asLimit(g.side, g.values[g.side]);
    if (next !== limits[g.side]) (g.side === "lo" ? onMinChange : onMaxChange)(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gesture.current) return;
    const v = valueAt(e.clientX);
    const grabbed = (e.target as HTMLElement).dataset.thumb as Side | undefined;
    const values = { ...committed };
    const side = values.lo === values.hi ? null : (grabbed ?? nearestSide(v, values));
    const g: Gesture = {
      pointerId: e.pointerId,
      side,
      onThumb: !!grabbed,
      startValue: v,
      moved: false,
      values,
    };
    gesture.current = g;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the strip still sees its events.
    }
    if (side) sliders.current[side]?.focus({ preventScroll: true });
    // A mouse jumps the nearest handle at once; a finger waits, as it may be scrolling.
    if (!g.onThumb && side && e.pointerType === "mouse") moveTo(g, side, v);
    if (e.pointerType === "mouse") e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const v = valueAt(e.clientX);
    if (v === g.startValue && !g.moved) return;
    g.moved = true;
    if (!g.side) {
      g.side = v < g.startValue ? "lo" : v > g.startValue ? "hi" : null;
      if (!g.side) return;
      sliders.current[g.side]?.focus({ preventScroll: true });
    }
    moveTo(g, g.side, v);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    // A tap on the bare track moves the nearest handle there.
    if (!g.moved && !g.onThumb && g.side) moveTo(g, g.side, valueAt(e.clientX));
    finish(true);
  };
  // The browser took the touch over to scroll: keep a drag that started on a handle, drop a tap.
  const onPointerCancel = () => finish(!!gesture.current?.onThumb && !!gesture.current?.moved);

  const slider = (side: Side) => (
    <input
      ref={(el) => {
        sliders.current[side] = el;
      }}
      type="range"
      className={styles.rangeInputSlider}
      min={min}
      max={max}
      step={step}
      value={shown[side]}
      // Keyboard and assistive tech only; each step is reported straight away.
      onChange={(e) => commit(side, Number(e.target.value))}
      aria-label={label[side]}
      aria-valuetext={spoken(side, dragging ? asLimit(side, dragging[side]) : limits[side])}
    />
  );

  const handlesClose = fraction(shown.hi) - fraction(shown.lo) < LEAN_APART_BELOW;
  const valueButton = (side: Side) => {
    const value = dragging ? asLimit(side, dragging[side]) : limits[side];
    const lean = handlesClose
      ? side === "lo"
        ? styles.rangeInputLeanLeft
        : styles.rangeInputLeanRight
      : "";
    return (
      <button
        type="button"
        ref={(el) => {
          triggers.current[side] = el;
        }}
        className={`${styles.rangeInputValue} ${lean}`}
        style={{ left: alongTrack(fraction(shown[side])) }}
        aria-label={`${label[side]}: ${withUnit(numberText(side, value))}`}
        aria-haspopup="dialog"
        aria-expanded={editing === side}
        onClick={() => setEditing(editing === side ? null : side)}
      >
        <span>{numberText(side, value)}</span>
        {unit && <span className={styles.rangeInputUnit}>{unit}</span>}
      </button>
    );
  };

  const closeEditor = (returnFocus: boolean) => {
    const side = editing;
    setEditing(null);
    if (returnFocus && side) triggers.current[side]?.focus({ preventScroll: true });
  };

  return (
    <div
      className={styles.rangeInputWrapper}
      style={
        {
          "--lo": fraction(shown.lo),
          "--hi": fraction(shown.hi),
          "--thumb": `${THUMB_REM}rem`,
        } as React.CSSProperties
      }
    >
      <div className={styles.rangeInputValues}>
        {valueButton("lo")}
        {valueButton("hi")}
      </div>
      <div
        ref={strip}
        className={styles.rangeInputStrip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className={styles.rangeInputTrack} aria-hidden="true">
          <div className={styles.rangeInputFill} />
        </div>
        {slider("lo")}
        {slider("hi")}
        {(["lo", "hi"] as const).map((side) => (
          <span
            key={side}
            data-thumb={side}
            className={styles.rangeInputGrab}
            style={{ left: alongTrack(fraction(shown[side])) }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className={styles.rangeInputScale} aria-hidden="true">
        <span>{min}</span>
        <span>{max}+</span>
      </div>
      {hint != null && (
        <p className={styles.rangeInputHint} aria-live="polite" aria-atomic="true">
          {hint}
        </p>
      )}
      <span className={styles.rangeInputStatus} role="status">
        {announcement}
      </span>
      {editing && (
        <ValueEditor
          key={editing}
          title={editing === "lo" ? "Lágmark" : "Hámark"}
          label={label[editing]}
          getAnchor={() => triggers.current[editing]}
          initial={limits[editing]}
          emptyMeans={editing === "lo" ? min : max}
          placeholder={numberText(editing, undefined)}
          min={min}
          max={max}
          step={step}
          unit={unit}
          onSubmit={(v) => {
            commit(editing, v, true);
            closeEditor(true);
          }}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}

/**
 * Where a value is typed: a popover under the value, or a bottom sheet on phones that rides
 * above the on-screen keyboard. The field opens focused with its value selected, so typing
 * replaces it. Nothing is reported until "Í lagi" or Enter; Escape, ✕ and a tap outside cancel.
 */
function ValueEditor({
  title,
  label,
  getAnchor,
  initial,
  emptyMeans,
  placeholder,
  min,
  max,
  step,
  unit,
  onSubmit,
  onCancel,
}: {
  title: string;
  label: string;
  getAnchor: () => HTMLElement | null;
  initial: number | undefined;
  /** What an empty field stands for (the end of the track), so −/+ start from there. */
  emptyMeans: number;
  placeholder: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onSubmit: (v: number | undefined) => void;
  onCancel: (returnFocus: boolean) => void;
}) {
  const [sheet] = useState(() => window.matchMedia(SHEET_QUERY).matches);
  const [draft, setDraft] = useState(initial === undefined ? "" : String(initial));
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // The latest callbacks, so listeners are added once per opening.
  const latest = useRef({ getAnchor, onCancel });
  useEffect(() => {
    latest.current = { getAnchor, onCancel };
  });

  // Placed and focused before the first paint, inside the tap that opened it, so iOS opens the
  // keyboard. Re-placed whenever the visual viewport changes (the keyboard opening, scrolling).
  useLayoutEffect(() => {
    const el = panel.current!;
    const place = () => {
      const vv = window.visualViewport;
      const viewport = {
        top: vv?.offsetTop ?? 0,
        left: vv?.offsetLeft ?? 0,
        width: vv?.width ?? window.innerWidth,
        height: vv?.height ?? window.innerHeight,
      };
      if (sheet) {
        // Sit on top of the keyboard: the part of the layout viewport the keyboard covers.
        const covered = window.innerHeight - viewport.height - viewport.top;
        el.style.bottom = `${Math.max(0, covered)}px`;
        return;
      }
      const anchor = latest.current.getAnchor()?.getBoundingClientRect();
      if (!anchor) return;
      const { offsetWidth: w, offsetHeight: h } = el;
      const left = clamp(
        anchor.left + anchor.width / 2 - w / 2,
        viewport.left + EDGE_GAP_PX,
        viewport.left + viewport.width - w - EDGE_GAP_PX
      );
      let top = anchor.bottom + EDGE_GAP_PX;
      // No room below: flip above the value.
      if (top + h > viewport.top + viewport.height - EDGE_GAP_PX) {
        top = Math.max(viewport.top + EDGE_GAP_PX, anchor.top - h - EDGE_GAP_PX);
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    place();
    field.current?.focus({ preventScroll: true });
    field.current?.select();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", place);
    vv?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      vv?.removeEventListener("resize", place);
      vv?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [sheet]);

  // The popover closes on a press anywhere else. The sheet has a backdrop for that instead.
  useEffect(() => {
    if (sheet) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || latest.current.getAnchor()?.contains(target)) return;
      // After this event, not inside it: the press may be on the other value, which then opens.
      window.setTimeout(() => latest.current.onCancel(false));
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sheet]);

  const nudge = (direction: 1 | -1) =>
    setDraft((d) => String(clamp((parseDraft(d) ?? emptyMeans) + direction * step, min, max)));
  const submit = () => onSubmit(parseDraft(draft));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Only this layer closes, not a drawer around the filters (UX rule 7).
      e.stopPropagation();
      onCancel(true);
    }
    if (e.key === "Tab") {
      // Focus stays inside until the editor is closed.
      const focusable = panel.current!.querySelectorAll<HTMLElement>("button, input");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const content = (
    <div
      ref={panel}
      role="dialog"
      aria-modal={sheet || undefined}
      aria-label={label}
      className={sheet ? styles.rangeInputSheet : styles.rangeInputPopover}
      onKeyDown={onKeyDown}
    >
      <div className={styles.rangeInputEditorHead}>
        <span aria-hidden="true">{title}</span>
        <button
          type="button"
          className={styles.rangeInputClose}
          aria-label="Loka"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onCancel(true)}
        >
          ✕
        </button>
      </div>
      <div className={styles.rangeInputEditorRow}>
        <HoldButton label={`Lækka um ${step}`} onStep={() => nudge(-1)}>
          −
        </HoldButton>
        <input
          ref={field}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          className={styles.rangeInputField}
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Never submits a surrounding form (UX rule 6).
              e.preventDefault();
              submit();
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              nudge(e.key === "ArrowUp" ? 1 : -1);
            }
          }}
        />
        {unit && <span aria-hidden="true">{unit}</span>}
        <HoldButton label={`Hækka um ${step}`} onStep={() => nudge(1)}>
          +
        </HoldButton>
      </div>
      <button type="button" className={styles.rangeInputOk} onClick={submit}>
        Í lagi
      </button>
    </div>
  );

  // In a portal, so a transformed ancestor (the filter drawer) can't trap the fixed position.
  return createPortal(
    sheet ? (
      <>
        <div
          className={styles.rangeInputBackdrop}
          aria-hidden="true"
          // Keep the keyboard up until the tap ends, and close on click so the tap can't land
          // on whatever is under the sheet once it's gone.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onCancel(true)}
        />
        {content}
      </>
    ) : (
      content
    ),
    document.body
  );
}

/**
 * A − or + that steps once on press and keeps stepping only after being held for 400ms. It
 * doesn't take focus, so the keyboard stays open and typing carries on in the field.
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
      className={styles.rangeInputStepper}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        stop();
        step.current();
        delay.current = window.setTimeout(() => {
          repeat.current = window.setInterval(() => step.current(), HOLD_REPEAT_MS);
        }, HOLD_DELAY_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard presses arrive as clicks with no pointer; pointer presses stepped already.
      onClick={(e) => {
        if (e.detail === 0) step.current();
      }}
    >
      {children}
    </button>
  );
}
