"use client";

import { useId, useState, type CSSProperties } from "react";
import { countIs, formatIcelandicDayMonth } from "@/lib/format";
import { cn } from "@/lib/util";
import { STATUS_LABEL, type EventType, type PlanStatus } from "@/services/plan.service";
import {
  WEEKDAY_SHORT,
  dayOfSpan,
  entryName,
  patrolInitial,
  spanRange,
  weekdayOf,
  type CalendarEntry,
} from "./calendarEntries";
import {
  STAMP_MEANING,
  STAMP_PICTURES,
  STAMP_STATES,
  Stamp,
  stampStateOf,
  type StampState,
} from "./Stamp";
import styles from "../PlanCalendar.module.css";

/**
 * The Dagatal's entries: one entry in a day cell, a multi-day strip, the phone marks, a day's
 * list with its fold, and the stamp key. Rationale: PlanCalendar.mdx.
 */

/** Entries a day shows before the rest fold behind "+N fleiri". */
const CAPACITY = 3;

/** The flokkur's ramp as local aliases; the whole sveit wears the inverse surface. */
export function patrolVars(entry: Partial<Pick<CalendarEntry, "patrolVar">>): CSSProperties {
  if (!entry.patrolVar) {
    return {
      "--pc": "var(--sl-color-surface-inverse)",
      "--pc-fg": "var(--sl-color-text-inverse)",
    } as CSSProperties;
  }
  return {
    "--pc": `var(${entry.patrolVar})`,
    "--pc-fg": `var(${entry.patrolVar}-foreground)`,
  } as CSSProperties;
}

/** The stamp's view of an entry. */
export function subjectOf(entry: CalendarEntry) {
  return { ...entry, cancelled: entry.kind === "cancelled" };
}

/** The status and stamp state as data attributes, which the CSS tints by. */
export function dataAttrs(entry: CalendarEntry) {
  return {
    "data-status": entry.status,
    "data-state": stampStateOf(subjectOf(entry)),
    "data-kind": entry.kind,
  };
}

export function PatrolChip({ entry, className }: { entry: CalendarEntry; className?: string }) {
  return (
    <span className={cn(styles.chip, className)} style={patrolVars(entry)} aria-hidden="true">
      {patrolInitial(entry)}
    </span>
  );
}

/** Who, where and how decided: the line an entry gains in the phone day list. */
function DetailLine({ entry, day }: { entry: CalendarEntry; day?: Date }) {
  const parts: string[] = [];
  if (entry.kind === "span" && day)
    parts.push(`Dagur ${dayOfSpan(entry, day)} af ${entry.spanDays}`);
  parts.push(entry.patrol?.name ?? "Öll sveitin");
  if (entry.kind !== "cancelled") {
    if (entry.venue) parts.push(entry.venue);
    parts.push(entry.past ? "Lokið" : STATUS_LABEL[entry.status]);
  }
  if (entry.overMinutes > 0 && !entry.past) {
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  }
  return <span className={styles.detail}>{parts.join(" · ")}</span>;
}

interface StampEntryProps {
  entry: CalendarEntry;
  /** The phone day list: a large stamp and a detail line. */
  detail?: boolean;
  /** The day it is shown on, for "dagur 2 af 3". */
  day?: Date;
  onSelect?: (eventId: string) => void;
}

/**
 * One entry in a day cell. The stamp and the tint are the first read (status); the title second;
 * the flokkur third. The usual fundur is one line with no time (the legend holds the times);
 * anything else gets its time and its reason for being different.
 */
export function StampEntry({ entry, detail, day, onSelect }: StampEntryProps) {
  const routine = entry.kind === "routine";
  const cancelled = entry.kind === "cancelled";
  const notes: string[] = [];
  if (entry.kind === "span") notes.push(spanRange(entry));
  if (entry.movedFrom) notes.push(`Fært frá ${WEEKDAY_SHORT[weekdayOf(entry.movedFrom)]}.`);
  if (cancelled && entry.cancelledReason) notes.push(entry.cancelledReason);
  const showMeta = detail || !routine;

  return (
    <button
      type="button"
      className={cn(styles.entry, detail && styles.entryDetail)}
      style={patrolVars(entry)}
      aria-label={entryName(entry)}
      onClick={() => onSelect?.(entry.id)}
      {...dataAttrs(entry)}
    >
      <Stamp entry={subjectOf(entry)} size={detail ? "lg" : "md"} />
      <span className={styles.body}>
        <span className={styles.line}>
          {(routine || cancelled) && <PatrolChip entry={entry} />}
          <span className={styles.title}>
            {cancelled ? `${entry.patrol?.name ?? "Fundur"} fellur niður` : entry.title}
          </span>
        </span>
        {showMeta && (
          <span className={styles.meta}>
            {!routine && !cancelled && <PatrolChip entry={entry} />}
            {!cancelled && entry.clock && <span className={styles.num}>{entry.clock}</span>}
            {notes.map((note) => (
              <span key={note} className={styles.note}>
                {note}
              </span>
            ))}
            {entry.overMinutes > 0 && !entry.past && !detail && (
              <span className={styles.over}>+{entry.overMinutes} mín.</span>
            )}
            {detail && <DetailLine entry={entry} day={day} />}
          </span>
        )}
      </span>
    </button>
  );
}

/** Where one week row draws a multi-day event. */
export type StripSegment = {
  entry: CalendarEntry;
  /** First and last column, 0 = mánudagur. */
  start: number;
  end: number;
  /** Row inside the week, so overlapping strips stack. */
  lane: number;
  continuesFromBefore: boolean;
  continuesAfter: boolean;
  /** Only a strip's first segment is a button, so it is announced once. */
  focusable: boolean;
};

/** A multi-day event: one perforated strip across its days. Only one segment is a button. */
export function StampStrip({
  segment,
  onSelect,
}: {
  segment: StripSegment;
  onSelect?: (eventId: string) => void;
}) {
  const { entry } = segment;
  const content = (
    <>
      <Stamp entry={subjectOf(entry)} size="md" />
      <span className={styles.stripText}>
        <span className={styles.title}>
          {segment.continuesFromBefore ? "↳ " : ""}
          {entry.title}
        </span>
        <span className={styles.stripRange}>
          {segment.continuesFromBefore ? "framhald · " : entry.clock ? `${entry.clock} · ` : ""}
          {spanRange(entry)}
        </span>
      </span>
      <PatrolChip entry={entry} />
    </>
  );
  const className = cn(
    styles.entry,
    styles.strip,
    segment.continuesFromBefore && styles.fromBefore,
    segment.continuesAfter && styles.intoNext
  );
  const style = {
    ...patrolVars(entry),
    gridColumn: `${segment.start + 1} / ${segment.end + 2}`,
    gridRow: 2 + segment.lane,
  };
  if (!segment.focusable) {
    // The rest of a strip already named once: drawn, not announced twice.
    return (
      <div className={className} style={style} aria-hidden="true" {...dataAttrs(entry)}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={entryName(entry)}
      onClick={() => onSelect?.(entry.id)}
      {...dataAttrs(entry)}
    >
      {content}
    </button>
  );
}

/** The phone cell's small stamps: up to three, or two and "+N". */
export function Marks({ entries }: { entries: CalendarEntry[] }) {
  const LIMIT = 3;
  const shown = entries.length > LIMIT ? entries.slice(0, LIMIT - 1) : entries;
  const rest = entries.length - shown.length;
  return (
    <span className={styles.marks} aria-hidden="true">
      {shown.map((entry) => (
        <Stamp key={entry.id} entry={subjectOf(entry)} size="sm" />
      ))}
      {rest > 0 && <span className={styles.markMore}>+{rest}</span>}
    </span>
  );
}

/** A day's single-day entries, folding past three behind "+N fleiri". */
export function DayEntries({
  day,
  entries,
  onSelect,
}: {
  day: Date;
  entries: CalendarEntry[];
  onSelect?: (eventId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const folds = entries.length > CAPACITY;
  const shown = folds && !open ? entries.slice(0, CAPACITY - 1) : entries;
  if (entries.length === 0) return null;
  return (
    <>
      <ul className={styles.entries} id={listId}>
        {shown.map((entry) => (
          <li key={entry.id}>
            <StampEntry entry={entry} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      {folds && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Færri" : `+${entries.length - shown.length} fleiri`}
          <span className="sl-sr-only"> {formatIcelandicDayMonth(day)}</span>
        </button>
      )}
    </>
  );
}

/** A stand-in fundur for the key: a Ratleikni flokksfundur. */
export function sampleEntry(state: StampState, id = "lykill") {
  return {
    id: `${id}-${state}`,
    status: (["past", "cancelled"].includes(state) ? "confirmed" : state) as PlanStatus,
    cancelled: state === "cancelled",
    past: state === "past",
    type: "flokks" as EventType,
    theme: "Ratleikni",
  };
}

/** Every stamp state and what it means. `compact` is the one-line legend above the grid. */
export function StampKey({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn(styles.key, compact && styles.keyCompact)}>
      <ul className={styles.keyList} aria-label="Stimplar">
        {STAMP_STATES.map((state) => (
          <li key={state} className={styles.keyItem} data-state={state}>
            <Stamp entry={sampleEntry(state)} size={compact ? "md" : "lg"} />
            <span>
              <span className={styles.keyName}>{STAMP_MEANING[state].name}</span>
              {!compact && <span className={styles.keyLooks}>{STAMP_MEANING[state].looks}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!compact && (
        <ul className={styles.keyList} aria-label="Myndir á stimplum">
          {STAMP_PICTURES.map(({ label, icon: Icon, by }) => (
            <li key={label} className={styles.keyItem}>
              <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
              <span>
                {label} <span className={styles.keyLooks}>({by})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
