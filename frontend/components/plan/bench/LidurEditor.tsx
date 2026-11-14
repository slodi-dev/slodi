"use client";

import { useEffect, useState } from "react";
import {
  KIND_LABEL,
  STATUS_LABEL,
  type Fundur,
  type Lidur,
  type PlanStatus,
  type SlotKind,
} from "@/services/plan.service";
import type { BenchIntent } from "./benchState";
import { MAX_MINUTES, MIN_MINUTES, clampMinutes } from "./benchState";
import styles from "./editor.module.css";

/**
 * The inline liður editor — sc-150 `BlockInspector`, in its in-sheet form.
 *
 * It opens *under the row it edits* rather than in a side panel. That is the
 * hi-fi's choice and it is the right one for this surface: a leader editing the
 * third liður of a fundur is thinking about the two either side of it, and a
 * panel on the far edge of the window breaks that adjacency for the sake of a
 * tidier layout.
 *
 * Every field writes straight through — there is no save button, because the
 * thing being edited is a draft plan, not a form. "Lokið" closes the editor; it
 * does not commit anything, and nothing is lost by never pressing it.
 *
 * ## There is no þema field
 *
 * A block carries the theme it came into the plan with (B3, sc-47) — that is
 * *context travelling with the block*, not a property a leader sets here. And
 * nothing is ever "outside" a fundur's theme: the earlier version of this
 * editor judged each liður against the fundur and told the leader when one did
 * not match, which invented a rule the programme does not have.
 */

/** What one press of − or + is worth. Fundir are planned in five-minute steps. */
const STEP = 5;

/**
 * Length as a number you can type, with − and + either side.
 *
 * This was ten preset chips. They read as noise — a row of near-identical
 * pills where only one is meaningful, and the one you want is often not among
 * them. A field plus two steppers is smaller, covers every value, and matches
 * how a leader actually thinks about it: "make that a bit longer".
 *
 * The typed value is held as a draft and only committed on blur or Enter.
 * Committing on every keystroke means clearing the field to retype it snaps to
 * the minimum, and the next character lands after a value the leader did not
 * ask for.
 */
function DurationField({
  minutes,
  onCommit,
}: {
  minutes: number;
  onCommit: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState(String(minutes));

  // Follow the value when it changes from anywhere else — the − / + buttons
  // here, or the arrow keys on the row's own duration chip.
  useEffect(() => setDraft(String(minutes)), [minutes]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || draft.trim() === "") {
      setDraft(String(minutes));
      return;
    }
    onCommit(clampMinutes(Math.round(parsed)));
  };

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.step}
        aria-label={`Stytta um ${STEP} mínútur`}
        disabled={minutes <= MIN_MINUTES}
        onClick={() => onCommit(clampMinutes(minutes - STEP))}
      >
        −
      </button>
      <span className={styles.stepValue}>
        <input
          className={styles.stepInput}
          type="number"
          inputMode="numeric"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={STEP}
          value={draft}
          aria-label="Lengd í mínútum"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <span className={styles.stepUnit} aria-hidden="true">
          mín
        </span>
      </span>
      <button
        type="button"
        className={styles.step}
        aria-label={`Lengja um ${STEP} mínútur`}
        disabled={minutes >= MAX_MINUTES}
        onClick={() => onCommit(clampMinutes(minutes + STEP))}
      >
        +
      </button>
    </div>
  );
}

const KINDS: SlotKind[] = ["setning", "dagskra", "leikur", "slit", "endurmat", "custom"];
const STATUSES: PlanStatus[] = ["confirmed", "draft", "tentative", "unknown"];

interface Props {
  fundur: Fundur;
  /** Every other fundur on the bench — where "Færa í fund…" can send this. */
  otherFundir: Fundur[];
  lidur: Lidur;
  /** Position in the fundur, for "liður 3 af 5". */
  position: number;
  total: number;
  startsAt: string | null;
  dispatch: (intent: BenchIntent) => void;
  onClose: () => void;
}

export default function LidurEditor({
  fundur,
  otherFundir,
  lidur,
  position,
  total,
  startsAt,
  dispatch,
  onClose,
}: Props) {
  const patch = (next: Partial<Omit<Lidur, "id">>) =>
    dispatch({ t: "patch", fundurId: fundur.event_id, id: lidur.id, patch: next });

  /**
   * Escape closes the editor and hands focus back to its row
   * (docs/ux-conventions.md §7: Escape closes the topmost layer, and focus
   * returns to whatever opened it). Without this, Escape did nothing here.
   */
  const closeOnEscape = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const row = document.querySelector<HTMLElement>(`[data-lidur-row="${lidur.id}"]`);
    onClose();
    row?.focus();
  };

  return (
    // A labelled listitem: the editor sits inside the liðir list as a sibling
    // of the row it belongs to, and a list may only own listitems. It used to
    // be `presentation`, which does not help — the fields inside then count as
    // the list's children (axe aria-required-children). While it is open the
    // list reads one item longer, which is true: there is one more thing in it.
    // The keydown only catches Escape bubbling up from the fields inside.
    <div
      className={styles.redit}
      role="listitem"
      aria-label={`Breyta lið: ${lidur.name}`}
      onKeyDown={closeOnEscape}
    >
      {/* Empty gutter, so the editor lines up with the row's body rather than
          its clock — it is about the block, not about the time. */}
      <div className={styles.sp} aria-hidden="true" />

      <div className={styles.body}>
        <div className={styles.hd}>
          <span className={styles.eyebrow}>
            Breyta lið{startsAt ? ` · byrjar kl. ${startsAt}` : ""} · liður {position} af {total}
          </span>
          <button type="button" className={styles.ib} aria-label="Loka ritli" onClick={onClose}>
            ✕
          </button>
        </div>

        <label className={styles.fld}>
          <span>Heiti</span>
          <input
            className={styles.in}
            value={lidur.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>

        <div className={styles.grid2}>
          <label className={styles.fld}>
            <span>Tegund liðar</span>
            <select
              className={styles.in}
              value={lidur.kind}
              onChange={(e) => patch({ kind: e.target.value as SlotKind })}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fld}>
            <span>Staðsetning</span>
            <input
              className={styles.in}
              value={lidur.venue ?? ""}
              placeholder="Sami staður og fundurinn"
              onChange={(e) => patch({ venue: e.target.value || null })}
            />
          </label>
        </div>

        <div className={styles.grid2}>
          <div className={styles.fld}>
            <span id={`dur-${lidur.id}`}>Lengd</span>
            <div role="group" aria-labelledby={`dur-${lidur.id}`}>
              <DurationField minutes={lidur.minutes} onCommit={(minutes) => patch({ minutes })} />
            </div>
          </div>

          <div className={styles.fld}>
            <span id={`st-${lidur.id}`}>Staða</span>
            <div className={styles.chips} role="group" aria-labelledby={`st-${lidur.id}`}>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={styles.chipbtn}
                  aria-pressed={lidur.status === status}
                  onClick={() => patch({ status })}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {lidur.endurmat && (
          <div className={styles.endur}>
            <span className={styles.endurH}>Endurmat frá síðast</span>
            <p className={styles.endurQ}>„{lidur.endurmat}“</p>
          </div>
        )}

        <div className={styles.ft}>
          <button type="button" className={`${styles.btn} ${styles.btnGo}`} onClick={onClose}>
            Lokið
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => dispatch({ t: "duplicate", fundurId: fundur.event_id, id: lidur.id })}
          >
            Afrita
          </button>

          {/*
           * A select rather than a drag: the fundur it is going to is usually
           * off screen, and often weeks away. This is the "we did this too late
           * in the term, move it forward" case, which no amount of dragging
           * makes pleasant.
           *
           * It resets to the placeholder because the move unmounts this editor —
           * the value would have nothing to describe.
           */}
          <label className={styles.moveTo}>
            <span className={styles.srOnly}>Færa lið í annan fund</span>
            <select
              className={styles.in}
              value=""
              disabled={otherFundir.length === 0}
              onChange={(e) => {
                if (!e.target.value) return;
                dispatch({
                  t: "moveToFundur",
                  fundurId: fundur.event_id,
                  id: lidur.id,
                  toFundurId: e.target.value,
                });
              }}
            >
              <option value="">Færa í fund…</option>
              {otherFundir.map((other) => (
                <option key={other.event_id} value={other.event_id}>
                  {other.title} · {other.date_label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.dngr}
            onClick={() => {
              onClose();
              dispatch({ t: "remove", fundurId: fundur.event_id, id: lidur.id });
            }}
          >
            Fjarlægja lið
          </button>
        </div>
      </div>
    </div>
  );
}
