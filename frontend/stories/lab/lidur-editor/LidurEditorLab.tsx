"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { KIND_LABEL, STATUS_LABEL, type PlanStatus, type SlotKind } from "@/services/plan.service";
import { MAX_MINUTES, MIN_MINUTES, clampMinutes } from "@/components/plan/bench/benchState";
import { countIs, formatIcelandicDate, formatMinutes } from "@/lib/format";
import styles from "./LidurEditorLab.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * - `inline`: under its row, frequent fields on one line, the rest behind "Meira".
 * - `inspector`: a panel beside the sheet that follows the selected liður.
 * - `sheet`: a bottom sheet with big targets, chips for lengd, a segmented staða.
 * - `quick`: lengd and staða edited right on the row; the editor holds only the rest.
 */
export type LidurEditorLook = "inline" | "inspector" | "sheet" | "quick";

/** Endurmat from the last time this block was run, with who wrote it and when. */
export interface LabEndurmat {
  text: string;
  by: string;
  /** ISO date of the fundur it was written after. */
  at: string;
  /** When the note is about length: the lengd it suggests, offered as one tap. */
  suggestMinutes?: number;
}

/** The bench's `Lidur`, with the endurmat the API will carry (author and date). */
export interface LabLidur {
  id: string;
  name: string;
  kind: SlotKind;
  minutes: number;
  status: PlanStatus;
  venue: string | null;
  endurmat?: LabEndurmat | null;
}

export interface LabFundur {
  id: string;
  title: string;
  dateLabel: string;
  /** "19:30", or null for an undated fundur. */
  startsAt: string | null;
  plannedMinutes: number;
  venue: string;
  items: LabLidur[];
}

/** Another fundur on the bench, a target for "Færa í fund…". */
export interface LabOtherFundur {
  id: string;
  title: string;
  dateLabel: string;
}

/** What the lab did, for the Actions panel. */
export interface LabEvent {
  type: "save" | "discard" | "remove" | "undo" | "duplicate" | "move" | "quick";
  lidur: string;
  detail?: string;
}

export interface LidurEditorLabProps {
  /** Which lab direction to render. */
  look: LidurEditorLook;
  fundur: LabFundur;
  /** Every other fundur on the bench. Empty disables "Færa í fund…", with the reason shown. */
  otherFundir: LabOtherFundur[];
  /** Open the editor on this liður at first render (focus is not moved). */
  defaultEditingId?: string;
  /**
   * Keep modal layers inside the lab's own box instead of the viewport, so several
   * directions can sit side by side (Comparison, the docs page). No scroll lock then.
   */
  contained?: boolean;
  onEvent?: (event: LabEvent) => void;
}

/* ── Copy and constants ────────────────────────────────────────────────────── */

const KINDS: SlotKind[] = ["setning", "dagskra", "leikur", "slit", "endurmat", "custom"];
/** Undecided first: ADR-002 §3 treats "?" as the starting state, not an error. */
const STATUSES: PlanStatus[] = ["unknown", "tentative", "draft", "confirmed"];
/**
 * A glyph per staða, the same set the fundur-sheet lab uses, so colour is never the only
 * carrier (WCAG 1.4.1). Hidden from screen readers: the word says it.
 */
const STATUS_GLYPH: Record<PlanStatus, string> = {
  confirmed: "✓",
  draft: "✎",
  tentative: "~",
  unknown: "?",
};
/** One press of − or +. Fundir are planned in five-minute steps. */
const STEP = 5;
/** The lengdir leaders actually pick, for the phone sheet's chips. */
const PRESETS = [5, 10, 15, 20, 30];
/** Rule 5: a reversible act offers "Afturkalla" for at least 8 seconds. */
const UNDO_MS = 10_000;

type Draft = Pick<LabLidur, "name" | "kind" | "minutes" | "status" | "venue">;
type DraftField = keyof Draft;

/** Each field in the dative, for "Þú breyttir lengd og stöðu." */
const FIELD_DATIVE: Record<DraftField, string> = {
  name: "heiti",
  kind: "tegund",
  minutes: "lengd",
  status: "stöðu",
  venue: "staðsetningu",
};
const FIELD_ORDER: DraftField[] = ["name", "minutes", "status", "kind", "venue"];

function draftOf(lidur: LabLidur): Draft {
  const { name, kind, minutes, status, venue } = lidur;
  return { name, kind, minutes, status, venue };
}

function changedFields(original: Draft, draft: Draft): DraftField[] {
  return FIELD_ORDER.filter((field) => {
    if (field === "name") return original.name.trim() !== draft.name.trim();
    if (field === "venue") return (original.venue ?? "") !== (draft.venue ?? "").trim();
    return original[field] !== draft[field];
  });
}

/** "lengd", "lengd og stöðu", "heiti, lengd og stöðu". */
function joinIs(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} og ${words[words.length - 1]}`;
}

function minutesLabel(minutes: number): string {
  return countIs(minutes, "mínúta", "mínútur");
}

/** Start time of each liður, from the fundur's start. */
function startTimes(fundur: LabFundur): (string | null)[] {
  const match = fundur.startsAt ? /^(\d{1,2}):(\d{2})$/.exec(fundur.startsAt) : null;
  if (!match) return fundur.items.map(() => null);
  let at = Number(match[1]) * 60 + Number(match[2]);
  return fundur.items.map((item) => {
    const clock = `${String(Math.floor(at / 60) % 24).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
    at += item.minutes;
    return clock;
  });
}

/* ── Small hooks ───────────────────────────────────────────────────────────── */

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * What a modal layer needs (rule 7): Tab stays inside, the page behind does not scroll.
 *
 * The shared `Modal` has neither, and its Escape listener sits on `document`, so it would
 * also close the editor underneath it. Promoting a modal direction means fixing `Modal`
 * first; the lab carries this stand-in so the behaviour can be judged now.
 */
function useModalLayer(ref: RefObject<HTMLElement | null>, active: boolean, lockScroll = true) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    const node = ref.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener("keydown", onKey);
    return () => {
      if (lockScroll) document.body.style.overflow = previous;
      node?.removeEventListener("keydown", onKey);
    };
  }, [ref, active, lockScroll]);
}

/* ── Fields ────────────────────────────────────────────────────────────────── */

/** Enter in a text field never submits or closes anything (rule 6). */
function swallowEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.preventDefault();
}

function HeitiField({
  value,
  error,
  onChange,
  inputRef,
}: {
  value: string;
  error: string | null;
  onChange: (name: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-heiti`}>
        Heiti
      </label>
      <input
        ref={inputRef}
        id={`${id}-heiti`}
        className={styles.input}
        value={value}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={swallowEnter}
      />
      {error && (
        <p id={`${id}-err`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Lengd: − and + in five-minute steps either side of a number you can type.
 *
 * Every valid keystroke goes into the draft, so a value typed and then abandoned with
 * Escape still counts as a change and the discard question is asked about it. The value
 * is clamped when the field is left or Enter is pressed, never mid-typing.
 */
function LengdStepper({
  minutes,
  onChange,
  big = false,
  labelledBy,
  name,
  live = true,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  big?: boolean;
  /**
   * Report every valid keystroke (an editor's draft). Off on the quick row, which writes
   * straight to the sheet and so must wait for blur or Enter: clamping "4" on the way
   * to "40" would snap it to 5.
   */
  live?: boolean;
  /** The visible label, when the stepper sits in a labelled group. */
  labelledBy?: string;
  /** The liður's name, so the row stepper's buttons say which liður they change. */
  name?: string;
}) {
  const [text, setText] = useState(String(minutes));
  const [prev, setPrev] = useState(minutes);
  if (prev !== minutes) {
    setPrev(minutes);
    if (Number(text) !== minutes) setText(String(minutes));
  }
  const commit = () => {
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(String(minutes));
      return;
    }
    const clamped = clampMinutes(Math.round(parsed));
    setText(String(clamped));
    onChange(clamped);
  };
  const of = name ? ` ${name}` : "";
  return (
    <div
      className={`${styles.stepper} ${big ? styles.stepperBig : ""}`}
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : `Lengd${of}`}
    >
      <button
        type="button"
        className={styles.step}
        aria-label={`Stytta${of} um ${STEP} mínútur`}
        disabled={minutes <= MIN_MINUTES}
        onClick={() => onChange(clampMinutes(minutes - STEP))}
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
          value={text}
          aria-label={`Lengd${of} í mínútum`}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = Number(e.target.value);
            if (live && e.target.value.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
          }}
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
        aria-label={`Lengja${of} um ${STEP} mínútur`}
        disabled={minutes >= MAX_MINUTES}
        onClick={() => onChange(clampMinutes(minutes + STEP))}
      >
        +
      </button>
    </div>
  );
}

function LengdField({
  minutes,
  onChange,
  chips = false,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  /** The phone sheet: preset chips above the stepper. */
  chips?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${id}-lengd`}>
        Lengd
      </span>
      {chips && (
        <div className={styles.presets} role="group" aria-label="Algengar lengdir">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.preset}
              aria-pressed={minutes === preset}
              aria-label={minutesLabel(preset)}
              onClick={() => onChange(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      )}
      <LengdStepper minutes={minutes} onChange={onChange} big={chips} labelledBy={`${id}-lengd`} />
    </div>
  );
}

/**
 * Staða as a segmented control built from real radios: one Tab stop, arrows move the
 * choice, and Enter has nothing to submit. "?" is drawn on Óákveðið so colour is never
 * the only carrier (WCAG 1.4.1).
 */
function StadaField({
  status,
  onChange,
  grid = false,
}: {
  status: PlanStatus;
  onChange: (status: PlanStatus) => void;
  /** Two by two, for the phone sheet. */
  grid?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>Staða</legend>
      <div className={`${styles.segments} ${grid ? styles.segmentsGrid : ""}`}>
        {STATUSES.map((value) => (
          <label key={value} className={styles.segment} data-status={value}>
            <input
              type="radio"
              className={styles.radio}
              name={name}
              value={value}
              checked={status === value}
              onChange={() => onChange(value)}
            />
            <span className={styles.q} aria-hidden="true">
              {STATUS_GLYPH[value]}
            </span>
            {STATUS_LABEL[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TegundField({ kind, onChange }: { kind: SlotKind; onChange: (kind: SlotKind) => void }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-tegund`}>
        Tegund liðar
      </label>
      <select
        id={`${id}-tegund`}
        className={styles.input}
        value={kind}
        onChange={(e) => onChange(e.target.value as SlotKind)}
      >
        {KINDS.map((value) => (
          <option key={value} value={value}>
            {KIND_LABEL[value]}
          </option>
        ))}
      </select>
    </div>
  );
}

function StadsetningField({
  venue,
  fundurVenue,
  onChange,
}: {
  venue: string | null;
  fundurVenue: string;
  onChange: (venue: string | null) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-stadur`}>
        Staðsetning <span className={styles.optional}>(valfrjálst)</span>
      </label>
      <input
        id={`${id}-stadur`}
        className={styles.input}
        value={venue ?? ""}
        placeholder={`Sami staður og fundurinn: ${fundurVenue}`}
        aria-describedby={`${id}-stadur-hint`}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value || null)}
        onKeyDown={swallowEnter}
      />
      <p id={`${id}-stadur-hint`} className={styles.hint}>
        Fylltu aðeins út ef þessi liður fer annað.
      </p>
    </div>
  );
}

/**
 * "Færa í fund…" as a select: the target is usually off screen and often weeks away.
 * With nowhere to go it is disabled, and the reason is visible text (rule 9).
 */
function MoveField({
  otherFundir,
  onMove,
}: {
  otherFundir: LabOtherFundur[];
  onMove: (fundurId: string) => void;
}) {
  const id = useId();
  const none = otherFundir.length === 0;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-faera`}>
        Færa í annan fund
      </label>
      <select
        id={`${id}-faera`}
        className={styles.input}
        value=""
        disabled={none}
        aria-describedby={none ? `${id}-faera-why` : undefined}
        onChange={(e) => e.target.value && onMove(e.target.value)}
      >
        <option value="">Færa í fund…</option>
        {otherFundir.map((other) => (
          <option key={other.id} value={other.id}>
            {other.title} · {other.dateLabel}
          </option>
        ))}
      </select>
      {none && (
        <p id={`${id}-faera-why`} className={styles.hint}>
          Enginn annar fundur er á bekknum.
        </p>
      )}
    </div>
  );
}

/**
 * Endurmat from last time, in the editor, above the fields it is about.
 *
 * It says who wrote it and after which fundur, because "of stuttur" from a leader who ran
 * it last week weighs differently from a note two years old. When the note is about
 * length it offers that lengd as one tap: the commonest reason to read it at all.
 */
function EndurmatNote({
  endurmat,
  minutes,
  onUseMinutes,
  compact = false,
}: {
  endurmat: LabEndurmat;
  minutes: number;
  onUseMinutes?: (minutes: number) => void;
  /** One line under a row (the quick direction). */
  compact?: boolean;
}) {
  const suggest =
    endurmat.suggestMinutes && endurmat.suggestMinutes !== minutes ? endurmat.suggestMinutes : null;
  return (
    // A note, not an <aside>: a landmark per liður would crowd the landmark list.
    <div
      role="note"
      className={`${styles.endurmat} ${compact ? styles.endurmatCompact : ""}`}
      aria-label="Endurmat frá síðast"
    >
      <p className={styles.endurmatHead}>
        <span className={styles.endurmatTitle}>Endurmat frá síðast</span>
        <span className={styles.endurmatBy}>
          {endurmat.by} · {formatIcelandicDate(endurmat.at)}
        </span>
      </p>
      <p className={styles.endurmatText}>„{endurmat.text}“</p>
      {suggest && onUseMinutes && (
        <button type="button" className={styles.endurmatUse} onClick={() => onUseMinutes(suggest)}>
          Setja lengd í {formatMinutes(suggest)}
        </button>
      )}
    </div>
  );
}

function Meira({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={styles.meira}>
      <button
        type="button"
        className={styles.meiraToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
        Meira
        <span className={styles.meiraHint}>tegund, staðsetning, færa, afrita</span>
      </button>
      <div id={id} className={styles.meiraBody} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/* ── The discard question (rule 6) ─────────────────────────────────────────── */

function DiscardQuestion({
  name,
  fields,
  contained,
  onKeep,
  onDiscard,
}: {
  name: string;
  fields: DraftField[];
  contained: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  useModalLayer(ref, true, !contained);
  // Focus the quiet choice: Enter or Escape straight away loses nothing.
  useEffect(() => keepRef.current?.focus(), []);
  const what = joinIs(fields.map((f) => FIELD_DATIVE[f]));
  return (
    <div className={styles.backdrop} data-layer="question">
      <div
        ref={ref}
        className={styles.question}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // Topmost layer only: closing the question goes back to editing.
            e.preventDefault();
            e.stopPropagation();
            onKeep();
          }
        }}
      >
        <h2 id={`${id}-t`} className={styles.questionTitle}>
          Henda breytingum?
        </h2>
        <p id={`${id}-d`} className={styles.questionText}>
          Þú breyttir {what} á „{name}“. Ef þú hendir þeim verður liðurinn eins og hann var.
        </p>
        <div className={styles.questionActions}>
          <button ref={keepRef} type="button" className={styles.btn} onClick={onKeep}>
            Halda áfram að breyta
          </button>
          <button type="button" className={styles.btnDanger} onClick={onDiscard}>
            Henda breytingum
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── The editor body, per direction ────────────────────────────────────────── */

interface EditorProps {
  look: LidurEditorLook;
  lidur: LabLidur;
  draft: Draft;
  setField: <K extends DraftField>(field: K, value: Draft[K]) => void;
  nameError: string | null;
  fundur: LabFundur;
  otherFundir: LabOtherFundur[];
  position: number;
  startsAt: string | null;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  onDone: () => void;
  onRequestClose: () => void;
  onDuplicate: () => void;
  onMove: (fundurId: string) => void;
  onRemove: () => void;
  /** The inspector's ‹ › through the sheet. */
  onStep?: (delta: -1 | 1) => void;
}

function EditorHeader({
  look,
  lidur,
  position,
  total,
  startsAt,
  titleId,
  onRequestClose,
  onStep,
}: {
  look: LidurEditorLook;
  lidur: LabLidur;
  position: number;
  total: number;
  startsAt: string | null;
  titleId: string;
  onRequestClose: () => void;
  onStep?: (delta: -1 | 1) => void;
}) {
  const where = `${startsAt ? `kl. ${startsAt} · ` : ""}liður\u00a0${position}\u00a0af\u00a0${total}`;
  const asHeading = look === "inspector" || look === "sheet";
  return (
    <div className={styles.head}>
      {look === "sheet" && <span className={styles.grabber} aria-hidden="true" />}
      <div className={styles.headText}>
        <span className={styles.eyebrow}>
          {KIND_LABEL[lidur.kind]} · {where}
        </span>
        {asHeading ? (
          <h2 id={titleId} className={styles.headTitle}>
            {lidur.name || "Ónefndur liður"}
          </h2>
        ) : (
          <span id={titleId} className={styles.srOnly}>
            Breyta lið: {lidur.name}
          </span>
        )}
      </div>
      {onStep && (
        <div className={styles.headStep}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Fyrri liður"
            disabled={position <= 1}
            onClick={() => onStep(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Næsti liður"
            disabled={position >= total}
            onClick={() => onStep(1)}
          >
            ›
          </button>
        </div>
      )}
      <button
        type="button"
        className={styles.iconBtn}
        aria-label="Loka ritli"
        onClick={onRequestClose}
      >
        ✕
      </button>
    </div>
  );
}

function EditorFooter({
  onDone,
  onDuplicate,
  onRemove,
  withDuplicate,
}: {
  onDone: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  withDuplicate: boolean;
}) {
  return (
    <div className={styles.foot}>
      <button type="button" className={styles.btnGo} onClick={onDone}>
        Lokið
      </button>
      {withDuplicate && (
        <button type="button" className={styles.btn} onClick={onDuplicate}>
          Afrita
        </button>
      )}
      {/* Reversible, so no confirm dialog: it goes at once and "Afturkalla" brings it back. */}
      <button type="button" className={styles.btnRemove} onClick={onRemove}>
        Fjarlægja lið
      </button>
    </div>
  );
}

function EditorBody(props: EditorProps) {
  const {
    look,
    lidur,
    draft,
    setField,
    nameError,
    fundur,
    otherFundir,
    position,
    startsAt,
    firstFieldRef,
    onDone,
    onRequestClose,
    onDuplicate,
    onMove,
    onRemove,
    onStep,
  } = props;
  const titleId = useId();
  const total = fundur.items.length;
  const endurmat = lidur.endurmat ? (
    <EndurmatNote
      endurmat={lidur.endurmat}
      minutes={draft.minutes}
      onUseMinutes={look === "quick" ? undefined : (m) => setField("minutes", m)}
    />
  ) : null;
  const heiti = (
    <HeitiField
      value={draft.name}
      error={nameError}
      onChange={(v) => setField("name", v)}
      inputRef={firstFieldRef}
    />
  );
  const tegund = <TegundField kind={draft.kind} onChange={(v) => setField("kind", v)} />;
  const stadur = (
    <StadsetningField
      venue={draft.venue}
      fundurVenue={fundur.venue}
      onChange={(v) => setField("venue", v)}
    />
  );
  const move = <MoveField otherFundir={otherFundir} onMove={onMove} />;
  const header = (
    <EditorHeader
      look={look}
      lidur={{ ...lidur, name: draft.name }}
      position={position}
      total={total}
      startsAt={startsAt}
      titleId={titleId}
      onRequestClose={onRequestClose}
      onStep={onStep}
    />
  );

  if (look === "inline") {
    return (
      <div className={styles.inlineBody} role="group" aria-labelledby={titleId}>
        {header}
        {endurmat}
        {heiti}
        <div className={styles.frequent}>
          <LengdField minutes={draft.minutes} onChange={(v) => setField("minutes", v)} />
          <StadaField status={draft.status} onChange={(v) => setField("status", v)} />
        </div>
        <Meira>
          <div className={styles.pair}>
            {tegund}
            {stadur}
          </div>
          <div className={styles.pair}>
            {move}
            <div className={styles.fieldEnd}>
              <button type="button" className={styles.btn} onClick={onDuplicate}>
                Afrita lið
              </button>
            </div>
          </div>
        </Meira>
        <EditorFooter
          onDone={onDone}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          withDuplicate={false}
        />
      </div>
    );
  }

  if (look === "inspector") {
    return (
      <>
        {header}
        <div className={styles.panelScroll}>
          {endurmat}
          {heiti}
          <LengdField minutes={draft.minutes} onChange={(v) => setField("minutes", v)} />
          <StadaField status={draft.status} onChange={(v) => setField("status", v)} grid />
          <div className={styles.divider} aria-hidden="true" />
          {tegund}
          {stadur}
          {move}
        </div>
        <EditorFooter onDone={onDone} onDuplicate={onDuplicate} onRemove={onRemove} withDuplicate />
      </>
    );
  }

  if (look === "sheet") {
    return (
      <>
        {header}
        <div className={styles.panelScroll}>
          {endurmat}
          {heiti}
          <LengdField minutes={draft.minutes} onChange={(v) => setField("minutes", v)} chips />
          <StadaField status={draft.status} onChange={(v) => setField("status", v)} grid />
          <Meira>
            {tegund}
            {stadur}
            {move}
            <button type="button" className={styles.btnWide} onClick={onDuplicate}>
              Afrita lið
            </button>
          </Meira>
        </div>
        <div className={styles.panelFoot}>
          <button type="button" className={styles.btnRemove} onClick={onRemove}>
            Fjarlægja lið
          </button>
          <button type="button" className={styles.btnGoWide} onClick={onDone}>
            Lokið
          </button>
        </div>
      </>
    );
  }

  // quick: lengd and staða live on the row, so the editor holds only the rest.
  return (
    <div className={styles.inlineBody} role="group" aria-labelledby={titleId}>
      {header}
      {heiti}
      <div className={styles.pair}>
        {tegund}
        {stadur}
      </div>
      <div className={styles.pair}>{move}</div>
      <EditorFooter onDone={onDone} onDuplicate={onDuplicate} onRemove={onRemove} withDuplicate />
    </div>
  );
}

/* ── Row pieces ────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: PlanStatus }) {
  return (
    <span className={styles.pill} data-status={status}>
      <span aria-hidden="true">{STATUS_GLYPH[status]} </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The quick direction's staða: the pill is a menu button, the options are radios
 * (`menuitemradio`). Escape or a choice closes it and focus goes back to the pill.
 */
function StatusMenu({
  status,
  name,
  onChange,
}: {
  status: PlanStatus;
  name: string;
  onChange: (status: PlanStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []
    );
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(at + delta + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.menuWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.pillBtn}
        data-status={status}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Staða ${name}: ${STATUS_LABEL[status]}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden="true">{STATUS_GLYPH[status]} </span>
        {STATUS_LABEL[status]}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          className={styles.menu}
          role="menu"
          aria-label={`Staða ${name}`}
          onKeyDown={onMenuKey}
        >
          {STATUSES.map((value) => (
            <div
              key={value}
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={status === value}
              className={styles.menuItem}
              onClick={() => {
                onChange(value);
                close();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(value);
                  close();
                }
              }}
            >
              <span className={styles.menuCheck} aria-hidden="true">
                {status === value ? "✓" : ""}
              </span>
              <span aria-hidden="true">{STATUS_GLYPH[value]} </span>
              {STATUS_LABEL[value]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── The lab ───────────────────────────────────────────────────────────────── */

type Toast = { seq: number; text: string; undo: (() => void) | null };

/**
 * A fundur sheet with the liður editor in one of four directions.
 *
 * The sheet itself is a stand-in: plain rows (time, heiti, staða, lengd) so the editor
 * has something to open from and hand focus back to. `stories/lab/fundur-sheet` is
 * redesigning the real one.
 *
 * Unlike today's editor, every direction holds a draft and commits it on "Lokið" (or, in
 * the inspector, when you move to another liður). That is what makes "Henda breytingum?"
 * possible at all: with write-through there is nothing to discard and Escape cannot be
 * an undo.
 */
export default function LidurEditorLab({
  look,
  fundur: initialFundur,
  otherFundir,
  defaultEditingId,
  contained = false,
  onEvent,
}: LidurEditorLabProps) {
  const [items, setItems] = useState<LabLidur[]>(initialFundur.items);
  const [editingId, setEditingId] = useState<string | null>(defaultEditingId ?? null);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(() => {
    const open = initialFundur.items.find((i) => i.id === defaultEditingId);
    return open ? draftOf(open) : null;
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", seq: 0 });
  const [focusRequest, setFocusRequest] = useState<{ selector: string; seq: number } | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Where focus was when the discard question opened, to go back to on "Halda áfram". */
  const beforeQuestionRef = useRef<HTMLElement | null>(null);
  const headingId = useId();

  const narrow = useMediaQuery("(max-width: 899px)");
  const fundur: LabFundur = { ...initialFundur, items };
  const starts = startTimes(fundur);
  const editing = items.find((i) => i.id === editingId) ?? null;
  const index = editing ? items.indexOf(editing) : -1;
  const dirtyFields = editing && draft ? changedFields(draftOf(editing), draft) : [];

  /** The inspector is a modal bottom sheet below 900px; the sheet look always is. */
  const modal = Boolean(editing) && (look === "sheet" || (look === "inspector" && narrow));
  useModalLayer(panelRef, modal && !asking, !contained);

  /* Focus moves only after React has drawn the thing it moves to. */
  useEffect(() => {
    if (!focusRequest) return;
    rootRef.current?.querySelector<HTMLElement>(focusRequest.selector)?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (editingId && focusOnOpen) firstFieldRef.current?.focus();
  }, [editingId, focusOnOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const say = (text: string) => setAnnouncement((a) => ({ text, seq: a.seq + 1 }));
  const focusRow = (id: string) =>
    setFocusRequest((r) => ({ selector: `[data-lab-open="${id}"]`, seq: (r?.seq ?? 0) + 1 }));
  const focusSelector = (selector: string) =>
    setFocusRequest((r) => ({ selector, seq: (r?.seq ?? 0) + 1 }));

  const setField = <K extends DraftField>(field: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    if (field === "name" && nameError && String(value).trim()) setNameError(null);
  };

  /** Write the draft into the sheet. Returns false when it cannot be saved yet. */
  const commit = (): boolean => {
    if (!editing || !draft) return true;
    if (!draft.name.trim()) {
      setNameError("Gefðu liðnum heiti.");
      firstFieldRef.current?.focus();
      return false;
    }
    if (dirtyFields.length === 0) return true;
    const saved: LabLidur = {
      ...editing,
      ...draft,
      name: draft.name.trim(),
      minutes: clampMinutes(Math.round(draft.minutes)),
      venue: draft.venue?.trim() || null,
    };
    setItems((all) => all.map((i) => (i.id === editing.id ? saved : i)));
    onEvent?.({
      type: "save",
      lidur: saved.name,
      detail: joinIs(dirtyFields.map((f) => FIELD_DATIVE[f])),
    });
    say(`Breytingar vistaðar: ${saved.name}.`);
    return true;
  };

  const open = (id: string, moveFocus: boolean) => {
    const lidur = items.find((i) => i.id === id);
    if (!lidur) return;
    setEditingId(id);
    setDraft(draftOf(lidur));
    setNameError(null);
    setFocusOnOpen(moveFocus);
  };

  const closeNow = (returnTo: string | null) => {
    setEditingId(null);
    setDraft(null);
    setNameError(null);
    setAsking(false);
    if (returnTo) focusRow(returnTo);
  };

  const done = () => {
    if (!editing) return;
    if (commit()) closeNow(editing.id);
  };

  /** ✕, Escape and the backdrop: ask first when something changed (rule 6). */
  const requestClose = () => {
    if (!editing) return;
    if (dirtyFields.length === 0) {
      closeNow(editing.id);
      return;
    }
    beforeQuestionRef.current = document.activeElement as HTMLElement | null;
    setAsking(true);
  };

  const keepEditing = () => {
    setAsking(false);
    const back = beforeQuestionRef.current;
    window.requestAnimationFrame(() =>
      back && back.isConnected ? back.focus() : firstFieldRef.current?.focus()
    );
  };

  const discard = () => {
    if (!editing) return;
    onEvent?.({ type: "discard", lidur: editing.name });
    say(`Breytingum hent: ${editing.name}.`);
    closeNow(editing.id);
  };

  /** The inspector follows the selection: the draft is saved, never dropped, on the way. */
  const switchTo = (id: string, moveFocus: boolean) => {
    if (editing && editing.id !== id && !commit()) return;
    open(id, moveFocus);
  };

  const neighbourAfterRemoval = (at: number, list: LabLidur[]) =>
    list[at + 1]?.id ?? list[at - 1]?.id ?? null;

  /** Take a liður off the sheet at once, with "Afturkalla" (rule 5). */
  const takeOff = (lidur: LabLidur, text: string, type: "remove" | "move", detail?: string) => {
    const at = items.findIndex((i) => i.id === lidur.id);
    const next = neighbourAfterRemoval(at, items);
    setItems((all) => all.filter((i) => i.id !== lidur.id));
    closeNow(null);
    onEvent?.({ type, lidur: lidur.name, detail });
    setToast({
      seq: (toast?.seq ?? 0) + 1,
      text,
      undo: () => {
        setItems((all) => [...all.slice(0, at), lidur, ...all.slice(at)]);
        setToast(null);
        onEvent?.({ type: "undo", lidur: lidur.name });
        say(`Liður kominn aftur: ${lidur.name}.`);
        focusRow(lidur.id);
      },
    });
    if (next) focusRow(next);
    else focusSelector(`[data-lab-heading]`);
  };

  const remove = () => {
    if (!editing) return;
    takeOff(editing, `Liður fjarlægður: ${editing.name}.`, "remove");
  };

  const moveTo = (fundurId: string) => {
    if (!editing || !draft) return;
    const target = otherFundir.find((f) => f.id === fundurId);
    const moved = { ...editing, ...draft, name: draft.name.trim() || editing.name };
    takeOff(
      moved,
      `Liður færður í ${target?.title ?? "annan fund"}: ${moved.name}.`,
      "move",
      target?.title
    );
  };

  const duplicate = () => {
    if (!editing || !draft) return;
    if (!commit()) return;
    const copy: LabLidur = {
      ...editing,
      ...draft,
      name: draft.name.trim(),
      id: `${editing.id}-afrit-${announcement.seq + 1}`,
    };
    setItems((all) => {
      const at = all.findIndex((i) => i.id === editing.id);
      return [...all.slice(0, at + 1), copy, ...all.slice(at + 1)];
    });
    onEvent?.({ type: "duplicate", lidur: copy.name });
    say(`Liður afritaður: ${copy.name}. Afritið er næst á eftir.`);
  };

  /** The quick direction writes lengd and staða straight through: one tap, one change. */
  const quickPatch = (lidur: LabLidur, patch: Partial<Pick<LabLidur, "minutes" | "status">>) => {
    const next = { ...lidur, ...patch };
    setItems((all) => all.map((i) => (i.id === lidur.id ? next : i)));
    onEvent?.({
      type: "quick",
      lidur: lidur.name,
      detail: patch.minutes !== undefined ? `${patch.minutes} mín` : STATUS_LABEL[next.status],
    });
    say(
      patch.minutes !== undefined
        ? `Lengd ${minutesLabel(next.minutes)}: ${lidur.name}.`
        : `Staða ${STATUS_LABEL[next.status]}: ${lidur.name}.`
    );
  };

  const total = items.reduce((sum, i) => sum + i.minutes, 0);
  const over = total - fundur.plannedMinutes;

  const editorProps =
    editing && draft
      ? {
          look,
          lidur: editing,
          draft,
          setField,
          nameError,
          fundur,
          otherFundir,
          position: index + 1,
          startsAt: starts[index],
          firstFieldRef,
          onDone: done,
          onRequestClose: requestClose,
          onDuplicate: duplicate,
          onMove: moveTo,
          onRemove: remove,
        }
      : null;

  const escapeCloses = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  };

  const rows = (
    <ol className={styles.rows} aria-labelledby={headingId}>
      {items.map((lidur, i) => {
        const isEditing = editingId === lidur.id;
        return (
          <li key={lidur.id} className={styles.rowItem} data-editing={isEditing || undefined}>
            <div className={styles.row} data-kind={lidur.kind}>
              <span className={styles.rowAt}>{starts[i] ?? "—"}</span>
              <button
                type="button"
                className={styles.rowMain}
                data-lab-open={lidur.id}
                aria-expanded={look === "inline" || look === "quick" ? isEditing : undefined}
                aria-haspopup={look === "sheet" ? "dialog" : undefined}
                aria-current={look === "inspector" && isEditing ? true : undefined}
                onClick={() => {
                  if (look === "inspector" && isEditing) {
                    firstFieldRef.current?.focus();
                  } else if (look === "inspector" && editingId) {
                    // Already open: follow the click, leave focus on the row.
                    switchTo(lidur.id, false);
                  } else if (isEditing) {
                    requestClose();
                  } else {
                    switchTo(lidur.id, true);
                  }
                }}
              >
                <span className={styles.rowTitle}>{lidur.name}</span>
                <span className={styles.rowSub}>
                  {look !== "quick" && <StatusPill status={lidur.status} />}
                  <span>{KIND_LABEL[lidur.kind]}</span>
                  {lidur.venue && <span>· {lidur.venue}</span>}
                  {lidur.endurmat && look !== "quick" && (
                    <span className={styles.rowEndurmat}>· Endurmat frá síðast</span>
                  )}
                </span>
              </button>
              {look === "quick" ? (
                <div className={styles.rowQuick}>
                  <LengdStepper
                    minutes={lidur.minutes}
                    name={lidur.name}
                    live={false}
                    onChange={(minutes) =>
                      quickPatch(lidur, { minutes: clampMinutes(Math.round(minutes)) })
                    }
                  />
                  <StatusMenu
                    status={lidur.status}
                    name={lidur.name}
                    onChange={(status) => quickPatch(lidur, { status })}
                  />
                </div>
              ) : (
                <span className={styles.rowDur}>{formatMinutes(lidur.minutes)}</span>
              )}
            </div>
            {look === "quick" && lidur.endurmat && (
              <div className={styles.rowNote}>
                <EndurmatNote
                  endurmat={lidur.endurmat}
                  minutes={lidur.minutes}
                  compact
                  onUseMinutes={(minutes) => quickPatch(lidur, { minutes })}
                />
              </div>
            )}
            {isEditing && editorProps && (look === "inline" || look === "quick") && (
              <div className={styles.inline} onKeyDown={escapeCloses}>
                <EditorBody {...editorProps} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );

  const sheet = (
    // Not a <section>: side by side in Comparison, four sheets with one name are four
    // indistinguishable landmarks.
    <div className={styles.sheet}>
      <div className={styles.sheetHead}>
        <h2 id={headingId} className={styles.sheetTitle} tabIndex={-1} data-lab-heading>
          {fundur.title} · {fundur.dateLabel}
        </h2>
        <p className={styles.sheetMeta}>
          {fundur.startsAt ? `kl. ${fundur.startsAt} · ` : "Ódagsett · "}
          {fundur.venue} · {countIs(items.length, "liður", "liðir")}
        </p>
      </div>
      {items.length === 0 ? (
        <p className={styles.blank}>Engir liðir eftir á þessum fundi.</p>
      ) : (
        rows
      )}
      <div className={styles.sheetFoot}>
        <span className={over > 0 ? styles.over : undefined}>
          {total} / {fundur.plannedMinutes} mín{over > 0 ? ` · ${over} yfir` : ""}
        </span>
      </div>
    </div>
  );

  const panel =
    editorProps && (look === "sheet" || look === "inspector") ? (
      <div
        ref={panelRef}
        className={look === "sheet" ? styles.bottomSheet : styles.inspector}
        role={modal ? "dialog" : "region"}
        aria-modal={modal || undefined}
        aria-label={`Breyta lið: ${editing?.name ?? ""}`}
        data-modal={modal || undefined}
        onKeyDown={escapeCloses}
      >
        <EditorBody
          {...editorProps}
          onStep={
            look === "inspector"
              ? (delta) => {
                  const next = items[index + delta];
                  if (next) switchTo(next.id, false);
                }
              : undefined
          }
        />
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-look={look}
      data-contained={contained || undefined}
    >
      {look === "inspector" ? (
        <div className={styles.split}>
          {sheet}
          {panel ? (
            modal ? (
              <div
                className={styles.backdrop}
                onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
              >
                {panel}
              </div>
            ) : (
              panel
            )
          ) : (
            !narrow && (
              <div className={styles.inspectorEmpty}>
                <p className={styles.eyebrow}>Ritill</p>
                <p>Veldu lið á fundinum til að breyta honum. Ritillinn fylgir þér á milli liða.</p>
              </div>
            )
          )}
        </div>
      ) : (
        sheet
      )}

      {look === "sheet" && panel && (
        <div
          className={styles.backdrop}
          data-layer="sheet"
          onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
        >
          {panel}
        </div>
      )}

      {asking && editing && (
        <DiscardQuestion
          name={editing.name}
          fields={dirtyFields}
          contained={contained}
          onKeep={keepEditing}
          onDiscard={discard}
        />
      )}

      <div className={styles.toastSlot} role="status">
        {toast && (
          <div key={toast.seq} className={styles.toast}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button type="button" className={styles.toastUndo} onClick={toast.undo}>
                Afturkalla
              </button>
            )}
          </div>
        )}
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announcement.seq % 2 === 0 ? announcement.text : ""}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement.seq % 2 === 1 ? announcement.text : ""}
      </p>
    </div>
  );
}
