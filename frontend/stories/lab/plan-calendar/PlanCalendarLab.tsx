"use client";

import { Fragment, useId, useMemo, useState, type CSSProperties } from "react";
import { countIs, formatIcelandicDayMonth, formatIcelandicMonthYear } from "@/lib/format";
import { isSameDay } from "@/components/plan/planEntries";
import { STATUS_LABEL, type EventType, type PlanStatus } from "@/services/plan.service";
import {
  RhythmLegend,
  STAMP_MEANING,
  STAMP_PICTURES,
  STAMP_STATES,
  Stamp,
  stampStateOf,
  type StampState,
} from "./stampKit";
import { cn } from "@/lib/util";
import {
  BUSY_MONTH,
  LAB_TODAY,
  WEEKDAY_FULL,
  WEEKDAY_SHORT,
  coversDay,
  dayOfSpan,
  deriveRhythms,
  entryName,
  labGrid,
  mondayOf,
  patrolInitial,
  placeEntries,
  spanRange,
  weekdayOf,
  type LabEntry,
  type LabGrid,
} from "./planCalendarLabData";
import styles from "./PlanCalendarLab.module.css";

/**
 * D4 · Stimplar, the look the user picked: the Dagatal as a stamp book. Every fundur gets a
 * rubber stamp once it is ready; until then its box shows how far it has come. Rationale and the
 * stamp language: PlanCalendarLab.mdx.
 *
 * The month is a rhythm plus exceptions (see `EntryKind`): the usual fundur is one quiet line,
 * anything else is a full block with its reason, a fundur that falls out gets a crossed-out
 * stamp, and a multi-day event is one perforated strip across its days. The grid is week rows of
 * CSS grid rather than a <table>, because a strip has to span cells.
 *
 * Below 40rem of its own width each day becomes a button with small stamps, and the chosen day
 * is listed under the grid with its stamp at full size ("Dagur 2 af 3" on a span).
 */

/** Entries a day shows before the rest fold behind "+N fleiri". */
const CAPACITY = 3;

/* ── Shared bits ── */

/** The flokkur's ramp as local aliases; the whole sveit wears the inverse surface. */
function patrolVars(entry: Partial<Pick<LabEntry, "patrolVar">>): CSSProperties {
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
function subjectOf(entry: LabEntry) {
  return { ...entry, cancelled: entry.kind === "cancelled" };
}

function stateOf(entry: LabEntry): StampState {
  return stampStateOf(subjectOf(entry));
}

function dataAttrs(entry: LabEntry) {
  return {
    "data-status": entry.status,
    "data-state": stateOf(entry),
    "data-kind": entry.kind,
  };
}

function PatrolChip({ entry }: { entry: LabEntry }) {
  return (
    <span className={styles.chip} style={patrolVars(entry)} aria-hidden="true">
      {patrolInitial(entry)}
    </span>
  );
}

/** Who, where and how decided: the line an entry gains in the phone day list. */
function DetailLine({ entry, day }: { entry: LabEntry; day?: Date }) {
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

/* ── One entry ── */

interface EntryProps {
  entry: LabEntry;
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
export function StampEntry({ entry, detail, day, onSelect }: EntryProps) {
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

/** A multi-day event: one perforated strip across its days. Only one segment is a button. */
function StampStrip({
  entry,
  segment,
  onSelect,
}: {
  entry: LabEntry;
  segment: Segment;
  onSelect?: (eventId: string) => void;
}) {
  const content = (
    <>
      <Stamp entry={subjectOf(entry)} size="md" />
      <span className={styles.stripText}>
        <span className={styles.title}>
          {segment.continuesFromBefore ? "↳ " : ""}
          {entry.title}
        </span>
        <span className={styles.stripRange}>
          {segment.continuesFromBefore ? "framhald · " : `${entry.clock} · `}
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

/* ── Phone marks ── */

function Marks({ entries }: { entries: LabEntry[] }) {
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

/* ── A day's entries, with the fold ── */

export function DayEntries({
  day,
  entries,
  onSelect,
}: {
  day: Date;
  entries: LabEntry[];
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

/* ── The key ── */

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

/** Every stamp state and what it means, in words. `compact` is the one-line legend above the grid. */
export { Stamp, STAMP_MEANING, STAMP_STATES };

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

/* ── The month, as week rows ── */

type Segment = {
  entry: LabEntry;
  start: number;
  end: number;
  lane: number;
  continuesFromBefore: boolean;
  continuesAfter: boolean;
  focusable: boolean;
};

function weeksOf(month: Date): Date[][] {
  const start = mondayOf(month);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const days = Array.from(
      { length: 7 },
      (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
    );
    if (w > 0 && days[0].getMonth() !== month.getMonth()) break;
    weeks.push(days);
  }
  return weeks;
}

/** A week's strip segments, each in the first lane free over its days. */
function segmentsOf(week: Date[], spans: LabEntry[], named: Set<string>): Segment[] {
  const lanes: boolean[][] = [];
  const out: Segment[] = [];
  for (const entry of spans) {
    const cols = week.map((d, i) => (coversDay(entry, d) ? i : -1)).filter((i) => i >= 0);
    if (cols.length === 0) continue;
    const start = cols[0];
    const end = cols[cols.length - 1];
    let lane = 0;
    while (lanes[lane]?.slice(start, end + 1).some(Boolean)) lane++;
    lanes[lane] = lanes[lane] ?? Array(7).fill(false);
    for (let i = start; i <= end; i++) lanes[lane][i] = true;
    out.push({
      entry,
      start,
      end,
      lane,
      continuesFromBefore: !isSameDay(week[start], entry.day),
      continuesAfter: !isSameDay(week[end], entry.endDay),
      focusable: !named.has(entry.id),
    });
    named.add(entry.id);
  }
  return out;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export interface PlanCalendarLabProps {
  /** Defaults to the lab's fixed autumn-2026 grid. */
  data?: LabGrid;
  month?: Date;
  today?: Date;
  onSelect?: (eventId: string) => void;
}

export default function PlanCalendarLab({
  data: given,
  month: initialMonth = BUSY_MONTH,
  today = LAB_TODAY,
  onSelect,
}: PlanCalendarLabProps) {
  const data = useMemo(() => given ?? labGrid(), [given]);
  const entries = useMemo(() => placeEntries(data, today), [data, today]);
  const rhythms = useMemo(() => deriveRhythms(data), [data]);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<Date | null>(null);
  const headingId = useId();
  const panelId = useId();

  const month = new Date(initialMonth.getFullYear(), initialMonth.getMonth() + offset, 1);
  const inMonth = (d: Date) =>
    d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  const weeks = weeksOf(month);
  const spans = entries.filter((e) => e.kind === "span");
  const singlesOn = (d: Date) => entries.filter((e) => e.kind !== "span" && isSameDay(e.day, d));
  const allOn = (d: Date) => entries.filter((e) => coversDay(e, d));

  const monthEntries = entries.filter((e) => inMonth(e.day) && e.kind !== "cancelled");
  const stamped = monthEntries.filter((e) => e.status === "confirmed" && !e.past).length;
  const undecided = monthEntries.filter((e) => e.status === "unknown").length;
  const selected =
    picked && inMonth(picked) ? picked : inMonth(today) ? today : (monthEntries[0]?.day ?? month);
  const named = new Set<string>();
  const noteOf = (week: Date[]) =>
    data.weeks.find((w) => w.starts_on && isSameDay(parseIso(w.starts_on), week[0]))?.note;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <h2 className={styles.monthTitle} id={headingId}>
          {formatIcelandicMonthYear(month)}
        </h2>
        <button
          type="button"
          className={styles.nav}
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Fyrri mánuður"
        >
          ←
        </button>
        <button
          type="button"
          className={styles.nav}
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Næsti mánuður"
        >
          →
        </button>
        <span className={styles.eyebrow}>
          {countIs(monthEntries.length, "viðburður", "viðburðir")} í mánuðinum
          {stamped > 0 && ` · ${countIs(stamped, "stimplaður", "stimplaðir")} fram undan`}
          {undecided > 0 && ` · ${countIs(undecided, "óákveðinn", "óákveðnir")}`}
        </span>
      </div>

      <div className={styles.legend}>
        <RhythmLegend rules={rhythms} />
        <StampKey compact />
      </div>

      <div className={styles.cal} role="group" aria-labelledby={headingId}>
        <div className={styles.weekHead} aria-hidden="true">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className={styles.dayHead}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => {
          const segments = segmentsOf(week, spans, named);
          const lanes = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
          const note = noteOf(week);
          return (
            // A day's items go in DOM order (number, strips that start here, its entries), so
            // Tab reads the week day by day; the grid places them.
            <div key={week[0].toDateString()} className={styles.week}>
              {week.map((d, c) => (
                <span
                  key={`bg-${c}`}
                  className={cn(styles.dayBg, !inMonth(d) && styles.out, c >= 5 && styles.weekend)}
                  style={{ gridColumn: c + 1 }}
                  aria-hidden="true"
                />
              ))}
              {week.map((d, c) => {
                const isToday = isSameDay(d, today);
                const singles = singlesOn(d);
                const covering = allOn(d);
                const live = covering.filter((e) => e.kind !== "cancelled").length;
                const cancelled = covering.length - live;
                const daySegments = segments.filter((s) => s.start === c);
                return (
                  <Fragment key={d.toDateString()}>
                    <span
                      className={cn(styles.dayHd, isToday && styles.today)}
                      style={{ gridColumn: c + 1, gridRow: 1 }}
                    >
                      <span
                        className={styles.dayNumber}
                        aria-current={isToday ? "date" : undefined}
                      >
                        {d.getDate()}
                        <span className="sl-sr-only">
                          . {formatIcelandicDayMonth(d).replace(/^\d+\. /, "")},{" "}
                          {WEEKDAY_FULL[weekdayOf(d)]}
                        </span>
                      </span>
                    </span>
                    {inMonth(d) ? (
                      <button
                        type="button"
                        className={cn(styles.compactDay, isToday && styles.today)}
                        style={{ gridColumn: c + 1, gridRow: 1 }}
                        aria-pressed={isSameDay(d, selected)}
                        aria-controls={panelId}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${formatIcelandicDayMonth(d)}, ${
                          live ? countIs(live, "viðburður", "viðburðir") : "ekkert skráð"
                        }${cancelled ? `, ${countIs(cancelled, "fundur fellur", "fundir falla")} niður` : ""}`}
                        onClick={() => setPicked(d)}
                      >
                        <span className={styles.dayNumber}>{d.getDate()}</span>
                        <Marks entries={singles} />
                      </button>
                    ) : (
                      <span
                        className={styles.compactDay}
                        style={{ gridColumn: c + 1, gridRow: 1 }}
                        aria-hidden="true"
                      >
                        <span className={styles.dayNumber}>{d.getDate()}</span>
                        <Marks entries={singles} />
                      </span>
                    )}
                    {daySegments.map((segment) => (
                      <StampStrip
                        key={segment.entry.id}
                        entry={segment.entry}
                        segment={segment}
                        onSelect={onSelect}
                      />
                    ))}
                    {daySegments.map((segment) => (
                      <span
                        key={`mk-${segment.entry.id}`}
                        className={cn(
                          styles.stripMark,
                          segment.continuesFromBefore && styles.fromBefore,
                          segment.continuesAfter && styles.intoNext
                        )}
                        style={{
                          gridColumn: `${segment.start + 1} / ${segment.end + 2}`,
                          gridRow: 2 + segment.lane,
                        }}
                        aria-hidden="true"
                        {...dataAttrs(segment.entry)}
                      />
                    ))}
                    <div
                      className={styles.dayBody}
                      style={{ gridColumn: c + 1, gridRow: 2 + lanes }}
                    >
                      <DayEntries day={d} entries={singles} onSelect={onSelect} />
                    </div>
                  </Fragment>
                );
              })}
              {note && (
                <p className={styles.weekNote} style={{ gridRow: 3 + lanes }}>
                  {note}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <section className={styles.dayPanel} id={panelId} aria-live="polite">
        <h3 className={styles.dayPanelTitle}>
          {capitalise(WEEKDAY_FULL[weekdayOf(selected)])} {formatIcelandicDayMonth(selected)}
        </h3>
        {allOn(selected).length ? (
          <ul className={styles.panelList}>
            {allOn(selected).map((entry) => (
              <li key={entry.id}>
                <StampEntry entry={entry} detail day={selected} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.panelEmpty}>Ekkert skráð þennan dag.</p>
        )}
      </section>
    </div>
  );
}

/* ── One day, close up ── */

/** One cell at the grid's desktop width, any strip drawn above its entries. */
export function DayCellLab({
  day,
  entries,
  today = LAB_TODAY,
  onSelect,
}: {
  day: Date;
  entries: LabEntry[];
  today?: Date;
  onSelect?: (eventId: string) => void;
}) {
  const isToday = isSameDay(day, today);
  const spans = entries.filter((e) => e.kind === "span");
  const singles = entries.filter((e) => e.kind !== "span");
  return (
    <div className={styles.closeCell}>
      <span className={cn(styles.dayHd, isToday && styles.today)}>
        <span className={styles.dayNumber} aria-current={isToday ? "date" : undefined}>
          {day.getDate()}
        </span>
      </span>
      {spans.map((entry) => (
        <StampEntry key={entry.id} entry={entry} day={day} onSelect={onSelect} />
      ))}
      <DayEntries day={day} entries={singles} onSelect={onSelect} />
    </div>
  );
}
