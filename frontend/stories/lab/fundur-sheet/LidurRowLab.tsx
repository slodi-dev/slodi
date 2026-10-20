"use client";

import { useRef, type ComponentType } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Pencil, X } from "lucide-react";
import {
  BAND_KIND,
  BAND_OF,
  KIND_LABEL,
  STATUS_LABEL,
  type Fundur,
  type Lidur,
} from "@/services/plan.service";
import type { BenchIntent } from "@/components/plan/bench/benchState";
import { clampMinutes } from "@/components/plan/bench/benchState";
import { dragId } from "@/components/plan/bench/dnd";
import { Stamp } from "@/components/plan/calendar/Stamp";
import { cn } from "@/lib/util";
import { rowHeight, type FundurSheetLook } from "./sheetModel";
import styles from "./FundurSheetLab.module.css";

/**
 * The current LidurRow (components/plan/bench/LidurRow.tsx) with a `look`.
 *
 * Same handle, same buttons, same keys, same intents: the keyboard handler and
 * the duration nudge are copied unchanged. What changes is what the row shows:
 *
 * - the clock is marked `data-clock`, and an undated fundur gets "+0:40"
 *   rather than "—" (the sheet passes it in);
 * - the kind is a visible word, not a stripe of colour nobody can decode, and only when it
 *   isn't the band's own (a Leikur in Verkefni fundar, not Setning under Setning);
 * - the theme is shown only when it differs from the fundur's own;
 * - the endurmat is shown, not tucked into a tooltip;
 * - lucide icons for ⠿ ↑ ↓ ✎ ✕, at 36px, 48px on a narrow sheet or a touch screen;
 * - F2 adds the calendar's stamp, F3 a tick box for the printed sheet.
 */

interface Props {
  look: FundurSheetLook;
  fundur: Fundur;
  lidur: Lidur;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isEditing: boolean;
  startsAt: string | null;
  isSelected: boolean;
  isGrabbed: boolean;
  dispatch: (intent: BenchIntent) => void;
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  focusSibling: (id: string, delta: -1 | 1) => void;
}

export default function LidurRowLab({
  look,
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
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: dragId.row(lidur.id),
      data: { kind: "row", fundurId: fundur.event_id, lidur },
    });

  const move = (to: number) => dispatch({ t: "move", fundurId: fundur.event_id, id: lidur.id, to });

  // Copied from LidurRow: Space grabs and drops, the arrows move a grabbed row
  // and otherwise move focus, Delete removes, Enter opens the editor.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
      if (isGrabbed) move(index + delta);
      else focusSibling(lidur.id, delta);
      return;
    }
    if (event.key === "Enter") {
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

  const ownTheme = lidur.theme && lidur.theme !== fundur.theme ? lidur.theme : null;
  // "Setning" under the Setning band says nothing; a Leikur in Verkefni fundar does.
  const ownKind = BAND_KIND[BAND_OF[lidur.kind]] !== lidur.kind ? KIND_LABEL[lidur.kind] : null;

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
      data-status={lidur.status}
      data-grabbed={isGrabbed}
      aria-current={isSelected || undefined}
      onKeyDown={onKeyDown}
    >
      <span ref={setActivatorNodeRef} className={styles.grip} aria-hidden="true" {...listeners}>
        <GripVertical size={16} strokeWidth={2} />
      </span>

      <div className={styles.rowClock}>
        <span className={styles.rowAt} data-clock>
          {startsAt ?? "—"}
        </span>
        <button
          type="button"
          className={styles.rowDur}
          aria-label={`Lengd: ${lidur.minutes} mínútur. Upp-ör styttir um 5, niður-ör lengir um 5. Smelltu til að opna ritil.`}
          onKeyDown={nudgeMinutes}
          onClick={(e) => {
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
        {look === "blad" && <span className={styles.tick} aria-hidden="true" />}
        {look === "stimplar" && (
          <span className={styles.rowStamp} aria-hidden="true">
            <Stamp
              entry={{
                id: lidur.id,
                status: lidur.status,
                type: "flokks",
                theme: lidur.theme ?? fundur.theme,
              }}
              size="md"
            />
          </span>
        )}
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{lidur.name}</span>
          <span className={styles.rowSub}>
            <span className={cn(styles.st, styles[`st_${lidur.status}`])}>
              {STATUS_LABEL[lidur.status]}
            </span>
            {ownKind ? (
              <span className={styles.kind}>{ownKind}</span>
            ) : (
              <span className={styles.srOnly}>{KIND_LABEL[lidur.kind]}.</span>
            )}
            {ownTheme && <span className={styles.theme}>{ownTheme}</span>}
          </span>
          {lidur.endurmat && (
            <span className={styles.endurmat}>
              <b>Endurmat frá síðast:</b> {lidur.endurmat}
            </span>
          )}
        </span>
      </button>

      <div className={styles.rowActs}>
        <ActionButton
          icon={ArrowUp}
          label={`Færa ${lidur.name} upp`}
          disabled={!canMoveUp}
          onClick={() => move(index - 1)}
        />
        <ActionButton
          icon={ArrowDown}
          label={`Færa ${lidur.name} niður`}
          disabled={!canMoveDown}
          onClick={() => move(index + 1)}
        />
        <ActionButton
          icon={Pencil}
          label={`${isEditing ? "Loka ritli fyrir" : "Breyta"} ${lidur.name}`}
          expanded={isEditing}
          onClick={() => dispatch({ t: "edit", id: isEditing ? null : lidur.id })}
        />
        <ActionButton
          icon={X}
          label={`Fjarlægja ${lidur.name}`}
          onClick={() => dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id })}
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  expanded,
  onClick,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.ib}
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}
