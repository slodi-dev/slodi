"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KIND_LABEL, STATUS_LABEL, type Fundur, type Lidur } from "@/services/plan.service";
import type { BenchIntent } from "./benchState";
import { clampMinutes } from "./benchState";
import { dragId } from "./dnd";
import styles from "./bench.module.css";

/**
 * One liður on the bench — sc-140 `BlockCard`, sc-153 `StatusPill`,
 * sc-152 `TimingField` and sc-157 `MoveControls` in their in-row form.
 *
 * ## Dragging is on a handle, not the whole row
 *
 * sc-160. The row holds a title, a duration control and four buttons; making
 * all of it draggable means a pointer-down anywhere is ambiguous — the browser
 * cannot tell "I am about to press ✕" from "I am about to drag". A dedicated
 * grip is unambiguous, it is a real focusable control with a label naming the
 * block, and it leaves text selectable.
 *
 * ## The row is as tall as the time it takes
 *
 * Duration is the thing leaders get wrong, and a list of equal-height rows hides
 * it: a 45-minute block and a 5-minute one look the same until you read the
 * numbers. Making height proportional means an over-stuffed fundur *looks*
 * over-stuffed. It is bounded at both ends so a 5-minute block stays clickable
 * and a útilega's 75-minute block does not push everything else off screen.
 */

/** Pixels per minute, with a floor and a ceiling. */
const MIN_ROW_PX = 52;
const MAX_ROW_PX = 132;
const PX_PER_MINUTE = 1.5;

function rowHeight(minutes: number): number {
  return Math.min(MAX_ROW_PX, Math.max(MIN_ROW_PX, Math.round(minutes * PX_PER_MINUTE)));
}

interface Props {
  fundur: Fundur;
  lidur: Lidur;
  /** Position within the whole fundur, which is what "move to" indexes. */
  index: number;
  /** Band edges, not fundur edges — a move never leaves its band. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  isEditing: boolean;
  startsAt: string | null;
  isSelected: boolean;
  isGrabbed: boolean;
  dispatch: (intent: BenchIntent) => void;
  /** Focus follows a block across a move — the row that owns focus asks for it. */
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  /** Hand focus to the neighbouring row, whatever the DOM between them. */
  focusSibling: (id: string, delta: -1 | 1) => void;
}

export default function LidurRow({
  fundur,
  lidur,
  index,
  canMoveUp,
  canMoveDown,
  isEditing,
  startsAt,
  isSelected,
  isGrabbed,
  dispatch,
  registerRow,
  focusSibling,
}: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  // No `attributes`. dnd-kit's are `role="button"` + `tabIndex=0` plus an
  // `aria-describedby` pointing at its keyboard instructions — and with no
  // KeyboardSensor registered, none of that is true of this grip: Space and
  // Enter do nothing on it, and the row's own handler ignores events that did
  // not originate on the row. It would be one dead tab stop per row announcing
  // a control that does not respond. The row is the keyboard surface; the grip
  // is a pointer affordance and says so by being hidden from the tree.
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: dragId.row(lidur.id),
      data: { kind: "row", fundurId: fundur.event_id, lidur },
    });

  const move = (to: number) => dispatch({ t: "move", fundurId: fundur.event_id, id: lidur.id, to });

  /**
   * The keyboard path, dispatching the same intents the buttons do.
   *
   * Space grabs and drops; while grabbed the arrows *move the block*, and while
   * not grabbed they move focus. That split is what makes arrow keys safe: a
   * leader tabbing through a fundur to read it never reorders it by accident.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    /**
     * Only the row's own keys, never its buttons'.
     *
     * The action buttons sit inside the row, so their keydowns bubble here.
     * Without this guard, Space on "Fjarlægja" was preventDefault-ed into a
     * grab and Enter into opening the editor — the buttons were unusable from
     * the keyboard in a component whose entire point is keyboard parity.
     */
    if (event.target !== event.currentTarget) return;

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      dispatch({ t: "grab", id: isGrabbed ? null : lidur.id });
      return;
    }
    if (event.key === "Escape" && isGrabbed) {
      event.preventDefault();
      dispatch({ t: "grab", id: null });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id });
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const delta = event.key === "ArrowUp" ? -1 : 1;
      event.preventDefault();
      if (isGrabbed) {
        move(index + delta);
      } else {
        // Plain navigation. Asked of the bench rather than walked through the
        // DOM from here: rows are not siblings — each is keyed and an open
        // editor sits between them — so `nextElementSibling` finds nothing.
        focusSibling(lidur.id, delta);
      }
      return;
    }
    if (event.key === "Enter") {
      // Enter opens the editor rather than merely selecting: on a row that is
      // already the focused thing, "select" is a no-op the leader cannot see.
      event.preventDefault();
      dispatch({ t: "edit", id: isEditing ? null : lidur.id });
    }
  };

  const nudgeMinutes = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    dispatch({
      t: "duration",
      fundurId: fundur.event_id,
      id: lidur.id,
      minutes: clampMinutes(lidur.minutes + (event.key === "ArrowUp" ? -5 : 5)),
    });
  };

  return (
    <div
      ref={(node) => {
        rowRef.current = node;
        registerRow(lidur.id, node);
        setNodeRef(node);
      }}
      role="listitem"
      tabIndex={0}
      data-lidur-row={lidur.id}
      className={styles.row}
      style={{
        minHeight: `${rowHeight(lidur.minutes)}px`,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-dragging={isDragging || undefined}
      data-kind={lidur.kind}
      data-grabbed={isGrabbed}
      // `aria-current`, not `aria-selected`: selection is not a supported state
      // on `listitem`, and the spec (§3) requires real list semantics rather
      // than a listbox pretending to be one.
      aria-current={isSelected || undefined}
      onKeyDown={onKeyDown}
    >
      {/* sc-160 DragHandle — the only draggable part of the row. */}
      <span ref={setActivatorNodeRef} className={styles.grip} aria-hidden="true" {...listeners}>
        ⠿
      </span>

      <div className={styles.rowClock}>
        <span className={styles.rowAt}>{startsAt ?? "—"}</span>
        <button
          type="button"
          className={styles.rowDur}
          // Up shortens, down lengthens — the row's height is the block's
          // duration, so the arrow moves the bottom edge the way it points.
          // Stated outright because it is the opposite of a spinbutton.
          aria-label={`Lengd: ${lidur.minutes} mínútur. Upp-ör styttir um 5, niður-ör lengir um 5. Smelltu til að opna ritil.`}
          onKeyDown={nudgeMinutes}
          onClick={(e) => {
            // A pointer path for the one control that had none: the arrows work
            // from the keyboard, and a click opens the editor, where the same
            // value has a real − / + field.
            e.stopPropagation();
            dispatch({ t: "edit", id: isEditing ? null : lidur.id });
          }}
        >
          {lidur.minutes} mín
        </button>
      </div>

      <button
        type="button"
        className={styles.rowMain}
        onClick={() => {
          dispatch({ t: "activate", fundurId: fundur.event_id });
          dispatch({ t: "select", id: lidur.id });
        }}
      >
        <span className={styles.rowKind} aria-hidden="true" />
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{lidur.name}</span>
          <span className={styles.rowSub}>
            <span className={`${styles.st} ${styles[`st_${lidur.status}`]}`}>
              {STATUS_LABEL[lidur.status]}
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.srOnly}>{KIND_LABEL[lidur.kind]}.</span>
            {/* The context the block brought with it (B3), stated plainly.
                There is no "outside the theme" to mark it against. */}
            {lidur.theme && <span>{lidur.theme}</span>}
            {lidur.endurmat && (
              <>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.endurmat} title={lidur.endurmat}>
                  Endurmat frá síðast
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      <div className={styles.rowActs}>
        <button
          type="button"
          className={styles.ib}
          aria-label={`Færa ${lidur.name} upp`}
          disabled={!canMoveUp}
          onClick={() => move(index - 1)}
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.ib}
          aria-label={`Færa ${lidur.name} niður`}
          disabled={!canMoveDown}
          onClick={() => move(index + 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className={styles.ib}
          aria-label={`${isEditing ? "Loka ritli fyrir" : "Breyta"} ${lidur.name}`}
          aria-expanded={isEditing}
          onClick={() => dispatch({ t: "edit", id: isEditing ? null : lidur.id })}
        >
          ✎
        </button>
        <button
          type="button"
          className={styles.ib}
          aria-label={`Fjarlægja ${lidur.name}`}
          onClick={() => dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id })}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
