"use client";

import { useId, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import {
  Check,
  ClipboardList,
  Flag,
  Hourglass,
  Mountain,
  PartyPopper,
  Pencil,
  Tent,
  TentTree,
  Users,
  type LucideIcon,
} from "lucide-react";
import { countIs, formatIcelandicDayMonth, formatIcelandicMonthYear } from "@/lib/format";
import { isSameDay } from "@/components/plan/planEntries";
import { STATUS_LABEL, type EventType, type PlanGrid } from "@/services/plan.service";
import { cn } from "@/lib/util";
import {
  BUSY_MONTH,
  LAB_PATROLS,
  LAB_TODAY,
  entryName,
  labGrid,
  patrolInitial,
  placeEntries,
  type LabEntry,
} from "./planCalendarLabData";
import styles from "./PlanCalendarLab.module.css";

/**
 * Lab copies of the Dagatal's day entry (PlanEntryChip in `meta="venue"`), each inside a lab
 * copy of the month grid. The grid is the real one's layout (a <table>, Monday first, trimmed
 * trailing row); only the entries differ. Rationale for every look: PlanCalendarLab.mdx.
 *
 * Below 40rem of its own width the grid stops trying to print titles into 50px cells: each day
 * becomes a button with small markers, and the chosen day's entries are listed under the grid
 * in the look's full form.
 */
export type DayEntryLook = "ribbon" | "agenda" | "ticket" | "readiness" | "icons";

export const LOOK_LABEL: Record<DayEntryLook, string> = {
  ribbon: "A · Fáni",
  agenda: "B · Dagbók",
  ticket: "C · Miði",
  readiness: "D · Staða",
  icons: "E · Tákn",
};

/** How many entries a day shows before the rest fold into "+N fleiri". */
export const LOOK_CAPACITY: Record<DayEntryLook, number> = {
  ribbon: 3,
  agenda: 4,
  ticket: 3,
  readiness: 3,
  icons: 4,
};

const WEEKDAYS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const WEEKDAYS_FULL = [
  "Mánudagur",
  "Þriðjudagur",
  "Miðvikudagur",
  "Fimmtudagur",
  "Föstudagur",
  "Laugardagur",
  "Sunnudagur",
];

const TYPE_ICON: Record<EventType, LucideIcon> = {
  flokks: Flag,
  sveitar: Users,
  skipulags: ClipboardList,
  utilega: Tent,
  dagsferd: Mountain,
  mot: TentTree,
  uppskeru: PartyPopper,
};

/** The big troop outings: the icons look gives them a whole row. */
const OUTING: ReadonlySet<EventType> = new Set(["utilega", "dagsferd", "mot", "uppskeru"]);

/* ── Shared bits ── */

/**
 * The flokkur's ramp as local aliases, so each look's CSS reads `--pc`, `--pc-fg` and
 * `--pc-subtle`. A troop-wide event wears the inverse surface: the one colour no flokkur has.
 */
function entryVars(entry: LabEntry): CSSProperties {
  if (!entry.patrolVar) {
    return {
      "--pc": "var(--sl-color-surface-inverse)",
      "--pc-fg": "var(--sl-color-text-inverse)",
      "--pc-subtle": "var(--sl-color-background-tertiary)",
    } as CSSProperties;
  }
  return {
    "--pc": `var(${entry.patrolVar})`,
    "--pc-fg": `var(${entry.patrolVar}-foreground)`,
    "--pc-subtle": `var(${entry.patrolVar}-subtle)`,
  } as CSSProperties;
}

function dataAttrs(entry: LabEntry) {
  return {
    "data-status": entry.status,
    "data-past": entry.past || undefined,
    "data-troop": entry.troopWide || undefined,
  };
}

/** Who, where and how decided: the line an entry gains when it has room (the phone list). */
function DetailLine({ entry }: { entry: LabEntry }) {
  const parts = [entry.patrol?.name ?? "Öll sveitin"];
  if (entry.venue) parts.push(entry.venue);
  parts.push(STATUS_LABEL[entry.status]);
  if (entry.overMinutes > 0)
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  return <span className={styles.detail}>{parts.join(" · ")}</span>;
}

interface EntryProps {
  entry: LabEntry;
  /** Room for a second line: who, where and the status in words. */
  detail?: boolean;
  onSelect?: (eventId: string) => void;
}

function EntryButton({
  entry,
  className,
  onSelect,
  children,
}: {
  entry: LabEntry;
  className: string;
  onSelect?: (eventId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(styles.entry, className)}
      style={entryVars(entry)}
      aria-label={entryName(entry)}
      onClick={() => onSelect?.(entry.id)}
      {...dataAttrs(entry)}
    >
      {children}
    </button>
  );
}

function Undecided({ entry }: { entry: LabEntry }) {
  return entry.status === "unknown" ? (
    <span className={styles.q} aria-hidden="true">
      ?
    </span>
  ) : null;
}

/* ── A · Fáni: the flokkur's flag ── */

function RibbonEntry({ entry, detail, onSelect }: EntryProps) {
  return (
    <EntryButton entry={entry} className={styles.ribbon} onSelect={onSelect}>
      <span className={styles.rbTime}>{entry.clock}</span>
      <span className={styles.rbTitle}>
        {entry.title}
        <Undecided entry={entry} />
      </span>
      {detail && <DetailLine entry={entry} />}
    </EntryButton>
  );
}

/* ── B · Dagbók: a line in a paper diary ── */

function AgendaEntry({ entry, detail, onSelect }: EntryProps) {
  return (
    <EntryButton entry={entry} className={styles.agenda} onSelect={onSelect}>
      <span className={styles.agDot} aria-hidden="true">
        {entry.troopWide ? "" : patrolInitial(entry)}
      </span>
      <span className={styles.agTime}>{entry.status === "unknown" ? "?" : entry.clock}</span>
      <span className={styles.agTitle}>{entry.title}</span>
      {detail && <DetailLine entry={entry} />}
    </EntryButton>
  );
}

/* ── C · Miði: a ticket stub ── */

const STUB_WORD: Partial<Record<LabEntry["status"], string>> = {
  draft: "drög",
  tentative: "óvíst",
  unknown: "?",
};

function TicketEntry({ entry, detail, onSelect }: EntryProps) {
  // A used ticket needs no word: the grey stub says it. Spelling "lokið" on every past
  // evening made the first half of the month the loudest part of it.
  const word = entry.past ? undefined : STUB_WORD[entry.status];
  return (
    <EntryButton entry={entry} className={styles.ticket} onSelect={onSelect}>
      <span className={styles.tkStub} aria-hidden="true">
        <span className={styles.tkTime}>{entry.clock}</span>
        {word && <span className={styles.tkWord}>{word}</span>}
      </span>
      <span className={styles.tkBody}>
        <span className={styles.tkTitle}>{entry.title}</span>
        {detail && <DetailLine entry={entry} />}
      </span>
    </EntryButton>
  );
}

/* ── D · Staða: how ready it is ── */

const STATUS_GLYPH: Record<LabEntry["status"], LucideIcon | "?"> = {
  confirmed: Check,
  draft: Pencil,
  tentative: Hourglass,
  unknown: "?",
};

function StatusGlyph({ status }: { status: LabEntry["status"] }) {
  const Glyph = STATUS_GLYPH[status];
  return (
    <span className={styles.rdGlyph} aria-hidden="true">
      {Glyph === "?" ? "?" : <Glyph size={12} strokeWidth={2.5} />}
    </span>
  );
}

function ReadinessEntry({ entry, detail, onSelect }: EntryProps) {
  return (
    <EntryButton entry={entry} className={styles.readiness} onSelect={onSelect}>
      {!entry.past && <StatusGlyph status={entry.status} />}
      <span className={styles.rdTitle}>{entry.title}</span>
      <span className={styles.rdMeta}>
        <span className={styles.rdChip} aria-hidden="true">
          {patrolInitial(entry)}
        </span>
        <span className={styles.num}>{entry.clock}</span>
        {entry.overMinutes > 0 && !entry.past && (
          <span className={styles.rdOver}>+{entry.overMinutes} mín.</span>
        )}
      </span>
      {detail && <DetailLine entry={entry} />}
    </EntryButton>
  );
}

/* ── E · Tákn: the shape says what kind of thing it is ── */

function IconEntry({ entry, detail, onSelect }: EntryProps) {
  const Icon = TYPE_ICON[entry.type];
  return (
    <EntryButton
      entry={entry}
      className={cn(styles.icons, OUTING.has(entry.type) && styles.icOuting)}
      onSelect={onSelect}
    >
      <span className={styles.icTile} aria-hidden="true">
        <Icon size={14} strokeWidth={2.25} />
        <Undecided entry={entry} />
      </span>
      <span className={styles.icText}>
        <span className={styles.icTime}>{entry.clock}</span>{" "}
        <span className={styles.icTitle}>{entry.title}</span>
      </span>
      {detail && <DetailLine entry={entry} />}
    </EntryButton>
  );
}

export const LOOK_ENTRY: Record<DayEntryLook, ComponentType<EntryProps>> = {
  ribbon: RibbonEntry,
  agenda: AgendaEntry,
  ticket: TicketEntry,
  readiness: ReadinessEntry,
  icons: IconEntry,
};

/* ── Compact markers: what a 50px phone cell can hold ── */

function Marker({ look, entry }: { look: DayEntryLook; entry: LabEntry }) {
  const Icon = TYPE_ICON[entry.type];
  return (
    <span
      className={cn(styles.marker, styles[`mk_${look}`])}
      style={entryVars(entry)}
      {...dataAttrs(entry)}
    >
      {look === "icons" && <Icon size={11} strokeWidth={2.5} />}
    </span>
  );
}

const MARKER_LIMIT = 3;

function Markers({ look, entries }: { look: DayEntryLook; entries: LabEntry[] }) {
  const shown = entries.length > MARKER_LIMIT ? entries.slice(0, MARKER_LIMIT - 1) : entries;
  const rest = entries.length - shown.length;
  return (
    <span className={styles.markers} aria-hidden="true">
      {shown.map((entry) => (
        <Marker key={entry.id} look={look} entry={entry} />
      ))}
      {rest > 0 && <span className={styles.markerMore}>+{rest}</span>}
    </span>
  );
}

/* ── One day's entries, with the overflow fold ── */

export interface DayEntriesProps {
  look: DayEntryLook;
  day: Date;
  entries: LabEntry[];
  onSelect?: (eventId: string) => void;
}

/** A day's entries as a list; past `LOOK_CAPACITY` the rest fold behind "+N fleiri". */
export function DayEntries({ look, day, entries, onSelect }: DayEntriesProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const capacity = LOOK_CAPACITY[look];
  const folds = entries.length > capacity;
  const shown = folds && !open ? entries.slice(0, capacity - 1) : entries;
  const hidden = entries.length - shown.length;
  const Entry = LOOK_ENTRY[look];

  if (entries.length === 0) return null;
  return (
    <>
      <ul className={styles.entries} id={listId}>
        {shown.map((entry) => (
          <li key={entry.id}>
            <Entry entry={entry} onSelect={onSelect} />
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
          {open ? "Færri" : `+${hidden} fleiri`}
          <span className="sl-sr-only"> {formatIcelandicDayMonth(day)}</span>
        </button>
      )}
    </>
  );
}

/* ── Status keys: each look explains its marks with its own entries ── */

const KEY_SAMPLES: { status: LabEntry["status"]; past?: boolean; label: string }[] = [
  { status: "confirmed", label: "Staðfest" },
  { status: "draft", label: "Drög" },
  { status: "tentative", label: "Óvíst" },
  { status: "unknown", label: "Óákveðið" },
  { status: "confirmed", past: true, label: "Lokið" },
];

/**
 * The key is drawn with the look's own entry, titled with the status, so it can never drift
 * from what the grid shows. It is `inert`: a picture, not five more buttons to tab through.
 * Each real entry already says its status in its accessible name.
 */
function StatusKey({ look }: { look: DayEntryLook }) {
  const Entry = LOOK_ENTRY[look];
  return (
    <div className={styles.statusKey} inert aria-hidden="true">
      {KEY_SAMPLES.map((sample) => (
        <span key={sample.label} className={styles.keySample}>
          <Entry
            entry={{
              ...SAMPLE,
              id: `key-${sample.label}`,
              title: sample.label,
              status: sample.status,
              past: Boolean(sample.past),
            }}
          />
        </span>
      ))}
    </div>
  );
}

/** A stand-in entry for the key: the first flokkur, a weekday evening. */
const SAMPLE: LabEntry = {
  id: "sample",
  title: "",
  type: "flokks",
  status: "confirmed",
  clock: "19:30",
  venue: null,
  day: LAB_TODAY,
  patrol: LAB_PATROLS[0],
  patrolVar: "--sl-color-patrol-rekkar",
  troopWide: false,
  overMinutes: 0,
  past: false,
};

function Legend({ look, data }: { look: DayEntryLook; data: PlanGrid }) {
  return (
    <div className={styles.legend}>
      <ul className={styles.keyList} aria-label="Flokkar">
        {data.patrols.map((patrol) => (
          <li key={patrol.id} className={styles.keyItem}>
            <span
              className={styles.patrolSwatch}
              style={
                { "--pc": `var(--sl-color-patrol-${patrol.accent ?? "adrir"})` } as CSSProperties
              }
              aria-hidden="true"
            />
            {patrol.name}
          </li>
        ))}
        <li className={styles.keyItem}>
          <span className={cn(styles.patrolSwatch, styles.troopSwatch)} aria-hidden="true" />
          Öll sveitin
        </li>
      </ul>
      <StatusKey look={look} />
    </div>
  );
}

/* ── The month ── */

function mondayOnOrBefore(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekday);
}

function monthRows(month: Date): Date[][] {
  const start = mondayOnOrBefore(month);
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(
      Array.from(
        { length: 7 },
        (_, c) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + r * 7 + c)
      )
    );
  }
  // Whole rows only, as in the real calendar: a month is five or six weeks.
  while (rows.length > 1 && rows[rows.length - 1].every((d) => d.getMonth() !== month.getMonth())) {
    rows.pop();
  }
  return rows;
}

function weekdayName(day: Date): string {
  return WEEKDAYS_FULL[(day.getDay() + 6) % 7];
}

export interface PlanCalendarLabProps {
  /** Which day-entry variation to render. */
  look: DayEntryLook;
  /** Same contract as PlanCalendar. Defaults to the lab's fixed October/December grid. */
  data?: PlanGrid;
  /** The month to open on. */
  month?: Date;
  /** Injectable "today", as on the real component. */
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
  const [offset, setOffset] = useState(0);
  const month = new Date(initialMonth.getFullYear(), initialMonth.getMonth() + offset, 1);
  const inMonth = (d: Date) =>
    d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();

  const rows = monthRows(month);
  const onDay = (d: Date) => entries.filter((e) => isSameDay(e.day, d));
  const monthEntries = entries.filter((e) => inMonth(e.day));

  const firstBusy = monthEntries[0]?.day ?? month;
  const [picked, setPicked] = useState<Date | null>(null);
  const selected =
    picked && inMonth(picked)
      ? picked
      : inMonth(today)
        ? today
        : monthEntries.length
          ? firstBusy
          : month;

  const headingId = useId();
  const panelId = useId();
  const Entry = LOOK_ENTRY[look];
  const selectedEntries = onDay(selected);

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
        </span>
      </div>

      <Legend look={look} data={data} />

      <div className={styles.cal}>
        <table className={styles.table} aria-labelledby={headingId}>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className={styles.dayHead}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0].toDateString()}>
                {row.map((d) => {
                  const out = !inMonth(d);
                  const isToday = isSameDay(d, today);
                  const dayEntries = onDay(d);
                  const isSelected = isSameDay(d, selected);
                  return (
                    <td
                      key={d.toDateString()}
                      className={cn(
                        styles.day,
                        out && styles.out,
                        isToday && styles.today,
                        d < today && !isToday && styles.pastDay
                      )}
                    >
                      <div className={styles.wide}>
                        <span className={styles.dayHd}>
                          <span
                            className={styles.dayNumber}
                            aria-current={isToday ? "date" : undefined}
                          >
                            {d.getDate()}
                          </span>
                        </span>
                        <DayEntries look={look} day={d} entries={dayEntries} onSelect={onSelect} />
                      </div>
                      {out ? (
                        <span className={styles.compactDay}>
                          <span className={styles.dayNumber}>{d.getDate()}</span>
                          <Markers look={look} entries={dayEntries} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.compactDay}
                          aria-pressed={isSelected}
                          aria-controls={panelId}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={`${formatIcelandicDayMonth(d)}, ${
                            dayEntries.length
                              ? countIs(dayEntries.length, "viðburður", "viðburðir")
                              : "ekkert skráð"
                          }`}
                          onClick={() => setPicked(d)}
                        >
                          <span className={styles.dayNumber}>{d.getDate()}</span>
                          <Markers look={look} entries={dayEntries} />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className={styles.dayPanel} id={panelId} aria-live="polite">
        <h3 className={styles.dayPanelTitle}>
          {weekdayName(selected)} {formatIcelandicDayMonth(selected)}
        </h3>
        {selectedEntries.length ? (
          <ul className={styles.panelList}>
            {selectedEntries.map((entry) => (
              <li key={entry.id}>
                <Entry entry={entry} detail onSelect={onSelect} />
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

/* ── One day, close up: a single cell outside the grid ── */

export interface DayCellLabProps {
  look: DayEntryLook;
  day: Date;
  entries: LabEntry[];
  today?: Date;
  onSelect?: (eventId: string) => void;
}

/** One calendar cell at the grid's desktop width, for comparing looks day by day. */
export function DayCellLab({ look, day, entries, today = LAB_TODAY, onSelect }: DayCellLabProps) {
  const isToday = isSameDay(day, today);
  return (
    <div className={cn(styles.closeCell, styles[`look_${look}`], isToday && styles.today)}>
      <span className={styles.dayHd}>
        <span className={styles.dayNumber} aria-current={isToday ? "date" : undefined}>
          {day.getDate()}
        </span>
      </span>
      <DayEntries look={look} day={day} entries={entries} onSelect={onSelect} />
    </div>
  );
}
