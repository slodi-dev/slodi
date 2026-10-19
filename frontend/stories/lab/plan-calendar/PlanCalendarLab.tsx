"use client";

import { Fragment, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Anchor,
  Ban,
  Check,
  CircleHelp,
  ClipboardList,
  Compass,
  Flag,
  Flame,
  FlameKindling,
  Footprints,
  HeartHandshake,
  Hourglass,
  Mountain,
  PartyPopper,
  Pencil,
  PencilLine,
  Sparkles,
  Tent,
  TentTree,
  TreePine,
  type LucideIcon,
} from "lucide-react";
import { countIs, formatIcelandicDayMonth, formatIcelandicMonthYear } from "@/lib/format";
import { isSameDay } from "@/components/plan/planEntries";
import { STATUS_LABEL, type EventType, type PlanStatus } from "@/services/plan.service";
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
 * The Staða family: the Dagatal as a planning-status map, in four variations that differ in the
 * mark each entry wears for its status. Rationale: PlanCalendarLab.mdx.
 *
 * The month is a rhythm plus exceptions, so entries come in four kinds (see `EntryKind`): the
 * flokkur's usual fundur is one quiet line, anything else on a day is a full block, a fundur
 * that falls out says so, and a multi-day event is one bar across its days. The grid is week
 * rows of CSS grid rather than a <table>, because a bar has to span cells.
 *
 * Below 40rem of its own width each day becomes a button with small marks and the chosen day is
 * listed under the grid in full, a span there as "dagur 2 af 3".
 */
export type StatusLook = "stada" | "merki" | "vardeldur" | "stimplar";

export const LOOKS: StatusLook[] = ["stada", "merki", "vardeldur", "stimplar"];

export const LOOK_LABEL: Record<StatusLook, string> = {
  stada: "D1 · Staða",
  merki: "D2 · Merki",
  vardeldur: "D3 · Varðeldur",
  stimplar: "D4 · Stimplar",
};

/** Entries a day shows before the rest fold behind "+N fleiri". */
const CAPACITY = 3;

const STATUS_ORDER: PlanStatus[] = ["confirmed", "draft", "tentative", "unknown"];

/* ── Icons ── */

/** Unlit sticks: the campfire before anyone has decided anything. */
function Sticks({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 19 20 12.5" />
      <path d="M4 12.5 20 19" />
      <path d="M12 9.5v-2" strokeDasharray="1 3" />
    </svg>
  );
}

const THEME_ICON: Record<string, LucideIcon> = {
  Útilíf: TreePine,
  Ratleikni: Compass,
  Hreyfing: Footprints,
  Sjómennska: Anchor,
  Hefðir: Flame,
  Umhyggja: HeartHandshake,
};

const TYPE_ICON: Record<EventType, LucideIcon> = {
  flokks: Flag,
  sveitar: Flag,
  skipulags: ClipboardList,
  utilega: Tent,
  dagsferd: Mountain,
  mot: TentTree,
  uppskeru: PartyPopper,
};

/** The stamp a fundur earns: its theme for a flokksfundur, its type for anything else. */
function stampIcon(entry: Pick<LabEntry, "type" | "theme">): LucideIcon {
  if (entry.type === "flokks" && entry.theme && THEME_ICON[entry.theme]) {
    return THEME_ICON[entry.theme];
  }
  return TYPE_ICON[entry.type];
}

/* ── The status mark, per look ── */

type MarkSize = "sm" | "md" | "lg";
const PX: Record<MarkSize, number> = { sm: 11, md: 13, lg: 18 };

const STADA_GLYPH: Record<PlanStatus, LucideIcon | null> = {
  confirmed: Check,
  draft: Pencil,
  tentative: Hourglass,
  unknown: null,
};

const MERKI_ICON: Record<PlanStatus, LucideIcon | null> = {
  confirmed: Check,
  draft: PencilLine,
  tentative: CircleHelp,
  unknown: null,
};

const FIRE_ICON: Record<PlanStatus, LucideIcon | null> = {
  confirmed: FlameKindling,
  draft: Flame,
  tentative: Sparkles,
  unknown: null,
};

interface MarkProps {
  look: StatusLook;
  entry: Pick<LabEntry, "status" | "type" | "theme" | "kind" | "patrol" | "troopWide"> &
    Partial<Pick<LabEntry, "patrolVar">>;
  size?: MarkSize;
}

/** The look's mark for an entry's status. Always decorative: the name says the status. */
export function StatusMark({ look, entry, size = "md" }: MarkProps) {
  const px = PX[size];
  if (entry.kind === "cancelled") {
    return (
      <span
        className={cn(styles.mark, styles.markCancelled, styles[`size_${size}`])}
        aria-hidden="true"
      >
        <Ban size={px} strokeWidth={2.5} />
      </span>
    );
  }
  const status = entry.status;
  let inner: ReactNode = "?";
  if (look === "stada") {
    const Glyph = STADA_GLYPH[status];
    if (Glyph) inner = <Glyph size={px} strokeWidth={2.5} />;
  } else if (look === "merki") {
    const Icon = MERKI_ICON[status];
    inner = Icon ? <Icon size={px} strokeWidth={2.5} /> : null;
  } else if (look === "vardeldur") {
    const Icon = FIRE_ICON[status];
    inner = Icon ? <Icon size={px + 2} strokeWidth={2.25} /> : <Sticks size={px + 2} />;
  } else {
    const Icon = stampIcon(entry);
    inner = status === "unknown" ? "?" : <Icon size={px} strokeWidth={2.25} />;
  }
  return (
    <span
      className={cn(styles.mark, styles[`mark_${look}`], styles[`size_${size}`])}
      data-status={status}
      aria-hidden="true"
    >
      {inner}
      {look === "merki" && (
        <span className={styles.flagTab} style={patrolVars(entry)}>
          {entry.troopWide ? "S" : (entry.patrol?.name.charAt(0) ?? "")}
        </span>
      )}
    </span>
  );
}

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

function dataAttrs(entry: LabEntry) {
  return {
    "data-status": entry.status,
    "data-kind": entry.kind,
    "data-past": entry.past || undefined,
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
  if (entry.kind === "span" && day) {
    parts.push(`Dagur ${dayOfSpan(entry, day)} af ${entry.spanDays}`);
  }
  parts.push(entry.patrol?.name ?? "Öll sveitin");
  if (entry.kind !== "cancelled") {
    if (entry.venue) parts.push(entry.venue);
    parts.push(STATUS_LABEL[entry.status]);
  }
  if (entry.overMinutes > 0) {
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  }
  return <span className={styles.detail}>{parts.join(" · ")}</span>;
}

/* ── One entry ── */

interface EntryProps {
  look: StatusLook;
  entry: LabEntry;
  /** Room for a second line: the phone day list. */
  detail?: boolean;
  /** The day it is shown on, for "dagur 2 af 3". */
  day?: Date;
  onSelect?: (eventId: string) => void;
}

/**
 * One entry in a day cell. The status tint is the first read; the mark makes it readable without
 * colour; the flokkur is second. Routine fundir are one line with no time (the rhythm legend
 * holds the times), anything else gets its time and its reason for being different.
 */
export function StatusEntry({ look, entry, detail, day, onSelect }: EntryProps) {
  const routine = entry.kind === "routine";
  const cancelled = entry.kind === "cancelled";
  const notes: string[] = [];
  if (entry.kind === "span") notes.push(spanRange(entry));
  if (entry.movedFrom) notes.push(`Fært frá ${WEEKDAY_SHORT[weekdayOf(entry.movedFrom)]}.`);
  if (cancelled && entry.cancelledReason) notes.push(entry.cancelledReason);

  return (
    <button
      type="button"
      className={cn(styles.entry, styles[`look_${look}`])}
      style={patrolVars(entry)}
      aria-label={entryName(entry)}
      onClick={() => onSelect?.(entry.id)}
      {...dataAttrs(entry)}
    >
      <StatusMark look={look} entry={entry} />
      <span className={styles.line}>
        {look !== "merki" && (routine || cancelled) && <PatrolChip entry={entry} />}
        <span className={styles.title}>
          {cancelled ? `${entry.patrol?.name ?? "Fundur"} fellur niður` : entry.title}
        </span>
      </span>
      {!routine && !detail && (
        <span className={styles.meta}>
          {look !== "merki" && !cancelled && <PatrolChip entry={entry} />}
          {!cancelled && entry.clock && <span className={styles.num}>{entry.clock}</span>}
          {notes.map((note) => (
            <span key={note} className={styles.note}>
              {note}
            </span>
          ))}
          {entry.overMinutes > 0 && !entry.past && (
            <span className={styles.over}>+{entry.overMinutes} mín.</span>
          )}
        </span>
      )}
      {detail && (
        <span className={styles.meta}>
          {!cancelled && entry.clock && <span className={styles.num}>{entry.clock}</span>}
          {notes.map((note) => (
            <span key={note} className={styles.note}>
              {note}
            </span>
          ))}
          <DetailLine entry={entry} day={day} />
        </span>
      )}
    </button>
  );
}

/** A multi-day event: one bar across its days. Only one segment is a button. */
function SpanBar({
  look,
  entry,
  segment,
  onSelect,
}: {
  look: StatusLook;
  entry: LabEntry;
  segment: Segment;
  onSelect?: (eventId: string) => void;
}) {
  const TypeIcon = TYPE_ICON[entry.type];
  const content = (
    <>
      <StatusMark look={look} entry={entry} />
      {look === "vardeldur" && (
        <span className={styles.typeBadge} aria-hidden="true">
          <TypeIcon size={13} strokeWidth={2.25} />
        </span>
      )}
      <span className={styles.spanText}>
        <span className={styles.title}>
          {segment.continuesFromBefore ? "↳ " : ""}
          {entry.title}
        </span>
        <span className={styles.spanRange}>
          {segment.continuesFromBefore ? "framhald · " : `${entry.clock} · `}
          {spanRange(entry)}
        </span>
      </span>
      {look !== "merki" && <PatrolChip entry={entry} />}
    </>
  );
  const className = cn(
    styles.entry,
    styles.span,
    styles[`look_${look}`],
    segment.continuesFromBefore && styles.fromBefore,
    segment.continuesAfter && styles.intoNext
  );
  const style = {
    ...patrolVars(entry),
    gridColumn: `${segment.start + 1} / ${segment.end + 2}`,
    gridRow: 2 + segment.lane,
  };
  if (!segment.focusable) {
    // The rest of a bar that has already been named once: drawn, not announced twice.
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

function Marks({ look, entries }: { look: StatusLook; entries: LabEntry[] }) {
  const LIMIT = 3;
  const shown = entries.length > LIMIT ? entries.slice(0, LIMIT - 1) : entries;
  const rest = entries.length - shown.length;
  return (
    <span className={styles.marks} aria-hidden="true">
      {shown.map((entry) => (
        <span key={entry.id} className={styles.markTile} {...dataAttrs(entry)}>
          <StatusMark look={look} entry={entry} size="sm" />
        </span>
      ))}
      {rest > 0 && <span className={styles.markMore}>+{rest}</span>}
    </span>
  );
}

/* ── A day's entries, with the fold ── */

export function DayEntries({
  look,
  day,
  entries,
  onSelect,
}: {
  look: StatusLook;
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
            <StatusEntry look={look} entry={entry} onSelect={onSelect} />
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

const KEY_TYPES: Record<StatusLook, string> = {
  stada: "Litur og tákn segja stöðuna.",
  merki: "Hver fundur fær merki; flipinn er flokkurinn.",
  vardeldur: "Eldurinn vex eftir því sem fundurinn skýrist.",
  stimplar: "Tilbúinn fundur fær stimpil eftir þema eða gerð.",
};

const SAMPLE_BASE = {
  type: "flokks" as EventType,
  theme: "Ratleikni",
  kind: "routine" as const,
  troopWide: false,
  patrol: { id: "k", name: "Refir", accent: "rekkar" as const },
  patrolVar: "--sl-color-patrol-rekkar",
};

/** Every mark of a look and what it means, as text. */
export function StatusKey({ look, compact = false }: { look: StatusLook; compact?: boolean }) {
  return (
    <div className={cn(styles.key, compact && styles.keyCompact)}>
      {!compact && <p className={styles.keyLead}>{KEY_TYPES[look]}</p>}
      <ul className={styles.keyList} aria-label="Staða">
        {STATUS_ORDER.map((status) => (
          <li key={status} className={styles.keyItem}>
            <span className={styles.keyTile} data-status={status}>
              <StatusMark
                look={look}
                entry={{ ...SAMPLE_BASE, status }}
                size={compact ? "md" : "lg"}
              />
            </span>
            {STATUS_LABEL[status]}
          </li>
        ))}
        <li className={styles.keyItem}>
          <span className={styles.keyTile} data-kind="cancelled">
            <StatusMark
              look={look}
              entry={{ ...SAMPLE_BASE, status: "confirmed", kind: "cancelled" }}
              size={compact ? "md" : "lg"}
            />
          </span>
          Fellur niður
        </li>
      </ul>
      {!compact && look === "stimplar" && (
        <ul className={styles.keyList} aria-label="Stimplar">
          {(
            [
              ["Útilíf", TreePine],
              ["Ratleikni", Compass],
              ["Hreyfing", Footprints],
              ["Sjómennska", Anchor],
              ["Hefðir", Flame],
              ["Umhyggja", HeartHandshake],
              ["Útilega", Tent],
              ["Dagsferð", Mountain],
              ["Mót", TentTree],
              ["Sveitarfundur", Flag],
              ["Skipulagsfundur", ClipboardList],
              ["Uppskeruhátíð", PartyPopper],
            ] as [string, LucideIcon][]
          ).map(([label, Icon]) => (
            <li key={label} className={styles.keyItem}>
              <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
      {!compact && look === "vardeldur" && (
        <ul className={styles.keyList} aria-label="Merki á viðburðum">
          {(
            [
              ["Útilega", Tent],
              ["Dagsferð", Mountain],
              ["Mót", TentTree],
            ] as [string, LucideIcon][]
          ).map(([label, Icon]) => (
            <li key={label} className={styles.keyItem}>
              <span className={styles.typeBadge} aria-hidden="true">
                <Icon size={13} strokeWidth={2.25} />
              </span>
              {label} (fleiri dagar)
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

/** A week's span segments, each in the first lane free over its days. */
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

export interface PlanCalendarLabProps {
  /** Which variation of the status mark to use. */
  look: StatusLook;
  /** Defaults to the lab's fixed autumn-2026 grid. */
  data?: LabGrid;
  month?: Date;
  today?: Date;
  onSelect?: (eventId: string) => void;
}

export default function PlanCalendarLab({
  look,
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
  const undecided = monthEntries.filter((e) => e.status === "unknown").length;
  const selected =
    picked && inMonth(picked) ? picked : inMonth(today) ? today : (monthEntries[0]?.day ?? month);
  const named = new Set<string>();
  const noteOf = (week: Date[]) =>
    data.weeks.find((w) => w.starts_on && isSameDay(parseIso(w.starts_on), week[0]))?.note;

  return (
    <div className={cn(styles.root, styles[`look_${look}`])}>
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
          {undecided > 0 && ` · ${countIs(undecided, "óákveðinn", "óákveðnir")}`}
        </span>
      </div>

      <div className={styles.legend}>
        {rhythms.length > 0 && (
          <div className={styles.rhythm}>
            <span className={styles.rhythmLabel}>Fundir vikunnar</span>
            <ul className={styles.rhythmList}>
              {rhythms.map((r) => (
                <li key={r.patrol.id} className={styles.rhythmItem}>
                  <span
                    className={styles.chip}
                    style={
                      {
                        "--pc": `var(--sl-color-patrol-${r.patrol.accent ?? "adrir"})`,
                        "--pc-fg": `var(--sl-color-patrol-${r.patrol.accent ?? "adrir"}-foreground)`,
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  >
                    {r.patrol.name.charAt(0)}
                  </span>
                  {r.patrol.name} {WEEKDAY_SHORT[r.weekday]} {r.clock}
                </li>
              ))}
            </ul>
          </div>
        )}
        <StatusKey look={look} compact />
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
            // A day's items go in DOM order (number, bars that start here, its entries), so Tab
            // reads the week day by day; the grid places them.
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
                const daySpans = segments.filter((s) => s.start === c);
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
                        <Marks look={look} entries={singles} />
                      </button>
                    ) : (
                      <span
                        className={styles.compactDay}
                        style={{ gridColumn: c + 1, gridRow: 1 }}
                        aria-hidden="true"
                      >
                        <span className={styles.dayNumber}>{d.getDate()}</span>
                        <Marks look={look} entries={singles} />
                      </span>
                    )}
                    {daySpans.map((segment) => (
                      <SpanBar
                        key={segment.entry.id}
                        look={look}
                        entry={segment.entry}
                        segment={segment}
                        onSelect={onSelect}
                      />
                    ))}
                    {daySpans.map((segment) => (
                      <span
                        key={`mk-${segment.entry.id}`}
                        className={cn(
                          styles.spanMark,
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
                      <DayEntries look={look} day={d} entries={singles} onSelect={onSelect} />
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
                <StatusEntry look={look} entry={entry} detail day={selected} onSelect={onSelect} />
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

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* ── One day, close up ── */

/** One cell at the grid's desktop width, with any span drawn above its entries. */
export function DayCellLab({
  look,
  day,
  entries,
  today = LAB_TODAY,
  onSelect,
}: {
  look: StatusLook;
  day: Date;
  entries: LabEntry[];
  today?: Date;
  onSelect?: (eventId: string) => void;
}) {
  const isToday = isSameDay(day, today);
  const spans = entries.filter((e) => e.kind === "span");
  const singles = entries.filter((e) => e.kind !== "span");
  return (
    <div className={cn(styles.closeCell, styles[`look_${look}`])}>
      <span className={cn(styles.dayHd, isToday && styles.today)}>
        <span className={styles.dayNumber} aria-current={isToday ? "date" : undefined}>
          {day.getDate()}
        </span>
      </span>
      {spans.map((entry) => (
        <StatusEntry key={entry.id} look={look} entry={entry} day={day} onSelect={onSelect} />
      ))}
      <DayEntries look={look} day={day} entries={singles} onSelect={onSelect} />
    </div>
  );
}
