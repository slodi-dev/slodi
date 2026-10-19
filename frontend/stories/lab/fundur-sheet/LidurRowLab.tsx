"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical, Minus, Pencil, Plus, X } from "lucide-react";
import {
  KIND_LABEL,
  STATUS_LABEL,
  type Fundur,
  type Lidur,
  type PlanStatus,
} from "@/services/plan.service";
import { clampMinutes, type BenchIntent } from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import {
  STATUS_ORDER,
  offsetLabel,
  sheetFacts,
  startOffsets,
  type FundurSheetLook,
} from "./sheetModel";
import styles from "./FundurSheetLab.module.css";

/**
 * LidurRow, four ways. Lab copy: see Lab → FundurSheet → About.
 *
 * The behaviour is the real row's, line for line: the row is the keyboard
 * surface (Space grabs, ↑↓ move while grabbed and move focus otherwise, Enter
 * opens the editor, Delete removes), the grip is the pointer drag handle, and
 * every change is a `BenchIntent` into the bench's reducer, so the reducer's
 * announcements still reach the live region. Only the arrangement and the type
 * change per look.
 */

export interface LidurRowLabProps {
  look: FundurSheetLook;
  fundur: Fundur;
  lidur: Lidur;
  /** Position within the whole fundur, which is what "move" indexes. */
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isEditing: boolean;
  /** `HH:MM`, or null on an undated fundur (the row then shows `+0:40`). */
  startsAt: string | null;
  isSelected: boolean;
  isGrabbed: boolean;
  dispatch: (intent: BenchIntent) => void;
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  focusSibling: (id: string, delta: -1 | 1) => void;
}

/** A glyph per status, so colour is never the only carrier (WCAG 1.4.1). */
const STATUS_GLYPH: Record<PlanStatus, string> = {
  confirmed: "✓",
  draft: "✎",
  tentative: "~",
  unknown: "?",
};

export default function LidurRowLab(props: LidurRowLabProps) {
  const {
    look,
    fundur,
    lidur,
    index,
    isEditing,
    startsAt,
    isSelected,
    isGrabbed,
    dispatch,
    registerRow,
    focusSibling,
  } = props;

  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: dragId.row(lidur.id),
      data: { kind: "row", fundurId: fundur.event_id, lidur },
    });

  const move = (to: number) => dispatch({ t: "move", fundurId: fundur.event_id, id: lidur.id, to });
  const toggleEditor = () => dispatch({ t: "edit", id: isEditing ? null : lidur.id });

  /** The real row's keyboard path, unchanged (LidurRow.tsx explains each branch). */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      dispatch({ t: "grab", id: isGrabbed ? null : lidur.id });
    } else if (event.key === "Escape" && isGrabbed) {
      event.preventDefault();
      dispatch({ t: "grab", id: null });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id });
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const delta = event.key === "ArrowUp" ? -1 : 1;
      event.preventDefault();
      if (isGrabbed) move(index + delta);
      else focusSibling(lidur.id, delta);
    } else if (event.key === "Enter") {
      event.preventDefault();
      toggleEditor();
    }
  };

  const offset = startOffsets(fundur)[index] ?? 0;
  const clock = (
    <span className={styles.clock} data-clock>
      {startsAt ?? offsetLabel(offset)}
    </span>
  );
  const grip = (
    <span ref={setActivatorNodeRef} className={styles.grip} aria-hidden="true" {...listeners}>
      <GripVertical />
    </span>
  );
  /** `srStatus`: say the status inside the button, for looks that don't draw it there. */
  const main = (children: ReactNode, srStatus = false) => (
    <button
      type="button"
      className={styles.main}
      onClick={() => {
        dispatch({ t: "activate", fundurId: fundur.event_id });
        dispatch({ t: "select", id: lidur.id });
      }}
    >
      {children}
      <span className={styles.srOnly}>
        . {KIND_LABEL[lidur.kind]}.{srStatus ? ` ${STATUS_LABEL[lidur.status]}.` : ""}
      </span>
    </button>
  );
  const actions = (
    <RowActions
      name={lidur.name}
      canMoveUp={props.canMoveUp}
      canMoveDown={props.canMoveDown}
      isEditing={isEditing}
      onUp={() => move(index - 1)}
      onDown={() => move(index + 1)}
      onEdit={toggleEditor}
      onRemove={() => dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id })}
    />
  );
  const statusSelect = (
    <StatusSelect
      name={lidur.name}
      status={lidur.status}
      onChange={(status) =>
        dispatch({ t: "patch", fundurId: fundur.event_id, id: lidur.id, patch: { status } })
      }
    />
  );

  let body: ReactNode;
  switch (look) {
    case "dagskra":
      body = (
        <>
          {grip}
          <span className={styles.clockCol}>
            {clock}
            <span className={styles.dur}>{lidur.minutes} mín</span>
          </span>
          {main(
            <>
              <span className={styles.title}>{lidur.name}</span>
              {(lidur.status !== "confirmed" || lidur.endurmat) && (
                <span className={styles.sub}>
                  {/* Confirmed is the expected state at the meeting, so only the
                      exceptions are drawn; the screen reader hears all four. */}
                  {lidur.status !== "confirmed" && <StatusTag status={lidur.status} />}
                </span>
              )}
            </>,
            lidur.status === "confirmed"
          )}
          {actions}
          {lidur.endurmat && <EndurmatNote text={lidur.endurmat} />}
        </>
      );
      break;

    case "timalina": {
      const { scale, planned } = sheetFacts(fundur);
      const end = offset + lidur.minutes;
      const inTime = Math.max(0, Math.min(end, planned) - offset);
      const overStart = Math.max(offset, planned);
      body = (
        <>
          {grip}
          {clock}
          {main(
            <>
              <span className={styles.title}>{lidur.name}</span>
              <span className={styles.sub}>
                <StatusTag status={lidur.status} />
                {lidur.endurmat && <EndurmatFlag text={lidur.endurmat} />}
              </span>
            </>
          )}
          <span className={styles.dur}>{lidur.minutes} mín</span>
          {actions}
          <span className={styles.track} aria-hidden="true">
            {inTime > 0 && (
              <span
                className={styles.bar}
                data-status={lidur.status}
                style={{ left: pct(offset, scale), width: pct(inTime, scale) }}
              />
            )}
            {end > planned && (
              <span
                className={`${styles.bar} ${styles.barOver}`}
                data-status={lidur.status}
                style={{ left: pct(overStart, scale), width: pct(end - overStart, scale) }}
              />
            )}
            <span className={styles.limit} style={{ left: pct(planned, scale) }} />
          </span>
        </>
      );
      break;
    }

    case "gatlisti":
      body = (
        <>
          {grip}
          {statusSelect}
          {main(
            <>
              <span className={styles.title}>{lidur.name}</span>
              <span className={styles.sub}>
                {clock}
                <span>{lidur.minutes} mín</span>
              </span>
            </>
          )}
          {actions}
          {lidur.endurmat && <EndurmatNote text={lidur.endurmat} />}
        </>
      );
      break;

    case "thett":
      body = (
        <>
          {grip}
          {clock}
          <Stepper
            name={lidur.name}
            minutes={lidur.minutes}
            onChange={(minutes) =>
              dispatch({ t: "duration", fundurId: fundur.event_id, id: lidur.id, minutes })
            }
          />
          {main(
            <>
              <span className={styles.title}>{lidur.name}</span>
              {lidur.endurmat && <EndurmatFlag text={lidur.endurmat} />}
            </>
          )}
          {statusSelect}
          {actions}
        </>
      );
      break;
  }

  return (
    <div
      ref={(node) => {
        registerRow(lidur.id, node);
        setNodeRef(node);
      }}
      role="listitem"
      tabIndex={0}
      data-lidur-row={lidur.id}
      data-look={look}
      data-kind={lidur.kind}
      data-status={lidur.status}
      data-grabbed={isGrabbed}
      data-dragging={isDragging || undefined}
      aria-current={isSelected || undefined}
      className={styles.row}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onKeyDown={onKeyDown}
    >
      {body}
    </div>
  );
}

function pct(minutes: number, scale: number): string {
  return `${(minutes / scale) * 100}%`;
}

/* ── Pieces the looks share ─────────────────────────────────────────────── */

export function StatusTag({ status }: { status: PlanStatus }) {
  return (
    <span className={styles.tag} data-status={status}>
      <span aria-hidden="true" className={styles.glyph}>
        {STATUS_GLYPH[status]}
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatusSelect({
  name,
  status,
  onChange,
}: {
  name: string;
  status: PlanStatus;
  onChange: (status: PlanStatus) => void;
}) {
  return (
    <span className={styles.statusPick} data-status={status}>
      <span aria-hidden="true" className={styles.glyph}>
        {STATUS_GLYPH[status]}
      </span>
      <select
        className={styles.statusSelect}
        aria-label={`Staða: ${name}`}
        value={status}
        onChange={(event) => onChange(event.target.value as PlanStatus)}
      >
        {STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABEL[value]}
          </option>
        ))}
      </select>
    </span>
  );
}

function Stepper({
  name,
  minutes,
  onChange,
}: {
  name: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.act}
        aria-label={`Stytta ${name} um 5 mínútur`}
        disabled={clampMinutes(minutes - 5) === minutes}
        onClick={() => onChange(clampMinutes(minutes - 5))}
      >
        <Minus />
      </button>
      <span className={styles.stepValue}>{minutes}</span>
      <button
        type="button"
        className={styles.act}
        aria-label={`Lengja ${name} um 5 mínútur`}
        disabled={clampMinutes(minutes + 5) === minutes}
        onClick={() => onChange(clampMinutes(minutes + 5))}
      >
        <Plus />
      </button>
    </span>
  );
}

function EndurmatNote({ text }: { text: string }) {
  return (
    <p className={styles.endurmat}>
      <b>Endurmat frá síðast:</b> {text}
    </p>
  );
}

function EndurmatFlag({ text }: { text: string }) {
  return (
    <span className={styles.endurmatFlag} title={text}>
      Endurmat
      <span className={styles.srOnly}>: {text}</span>
    </span>
  );
}

function RowActions({
  name,
  canMoveUp,
  canMoveDown,
  isEditing,
  onUp,
  onDown,
  onEdit,
  onRemove,
}: {
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isEditing: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <span className={styles.acts}>
      <button
        type="button"
        className={styles.act}
        aria-label={`Færa ${name} upp`}
        disabled={!canMoveUp}
        onClick={onUp}
      >
        <ChevronUp />
      </button>
      <button
        type="button"
        className={styles.act}
        aria-label={`Færa ${name} niður`}
        disabled={!canMoveDown}
        onClick={onDown}
      >
        <ChevronDown />
      </button>
      <button
        type="button"
        className={styles.act}
        aria-label={`${isEditing ? "Loka ritli fyrir" : "Breyta"} ${name}`}
        aria-expanded={isEditing}
        onClick={onEdit}
      >
        <Pencil />
      </button>
      <button
        type="button"
        className={styles.act}
        aria-label={`Fjarlægja ${name}`}
        onClick={onRemove}
      >
        <X />
      </button>
    </span>
  );
}
