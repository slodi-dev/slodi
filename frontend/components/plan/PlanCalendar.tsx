"use client";

import { Fragment, useId, useMemo, useState } from "react";
import type { PlanGrid as PlanGridData } from "@/services/plan.service";
import { countIs, formatIcelandicDayMonth, formatIcelandicMonthYear } from "@/lib/format";
import { cn } from "@/lib/util";
import { entryDay, isSameDay, parseWeekStart } from "./planEntries";
import {
  WEEKDAY_FULL,
  WEEKDAY_SHORT,
  addDays,
  coversDay,
  deriveRhythms,
  mondayOf,
  parseDay,
  placeEntries,
  weekdayOf,
  type CalendarEntry,
} from "./calendar/calendarEntries";
import { RhythmLegend } from "./calendar/Stamp";
import {
  DayEntries,
  Marks,
  StampEntry,
  StampKey,
  StampStrip,
  dataAttrs,
  type StripSegment,
} from "./calendar/StampEntry";
import styles from "./PlanCalendar.module.css";

/**
 * The Dagatal (A4, sc-39): the whole troop's month, drawn as a stamp book (D4 · Stimplar,
 * picked in Lab/PlanCalendar on 2026-10-20). Every fundur gets a rubber stamp once it is ready;
 * until then its box shows how far it has come. Rationale: PlanCalendar.mdx.
 *
 * ## A rhythm plus exceptions
 *
 * The usual weekly fundur is one quiet line (its time is in "Fundir vikunnar" above the grid);
 * anything that breaks the rhythm is a full block with its reason; a fundur that falls out gets
 * a crossed-out stamp; a multi-day event is one perforated strip across its days. The grid is
 * week rows of CSS grid rather than a <table>, because a strip has to span cells. Below 40rem of
 * its own width each day becomes a button with small stamps, and the chosen day is listed under
 * the grid with its stamps at full size.
 *
 * ## Days when it knows the day, weeks when it does not
 *
 * `starts_at` is optional in the contract. An entry with a date is drawn on that day; one
 * without is listed under the month against its *week*. Placing an undated útilega on its week's
 * Monday would invent a date the planner does not have.
 *
 * Month names come from `lib/format.ts`, never `Intl`: Chrome has no is-IS data and falls back
 * to English ("OCTOBER 2026").
 */

interface Props {
  data: PlanGridData;
  /** Injectable so tests do not depend on the day they run. */
  today?: Date;
  /** The month to open on. Defaults to today's month, else the season's first. */
  month?: Date;
  /** An entry was chosen; its `event_id`. */
  onSelect?: (eventId: string) => void;
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A month's week rows, from the Monday on or before the 1st. Whole rows only: a month is five
 * or six weeks, never five and two sevenths (March 2026 once rendered a last row of two cells).
 */
function weeksOf(month: Date): Date[][] {
  const start = mondayOf(month);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const days = Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d));
    if (w > 0 && days[0].getMonth() !== month.getMonth()) break;
    weeks.push(days);
  }
  return weeks;
}

/** A week's strip segments, each in the first lane free over its days. */
function segmentsOf(week: Date[], spans: CalendarEntry[], named: Set<string>): StripSegment[] {
  const lanes: boolean[][] = [];
  const out: StripSegment[] = [];
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

export default function PlanCalendar({ data, today, month: openOn, onSelect }: Props) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const entries = useMemo(() => placeEntries(data, now), [data, now]);
  const rhythms = useMemo(() => deriveRhythms(data), [data]);
  const headingId = useId();
  const panelId = useId();

  /** Months to page through: any month a dated week or a dated entry's days fall in. */
  const months = useMemo(() => {
    const byMonth = new Map<string, Date>();
    const add = (date: Date) => byMonth.set(monthKeyOf(date), firstOfMonth(date));
    for (const week of data.weeks) {
      const start = parseWeekStart(week);
      if (start) add(start);
    }
    for (const entry of entries) {
      add(entry.day);
      add(entry.endDay);
    }
    return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, date]) => date);
  }, [data.weeks, entries]);

  const [monthIndex, setMonthIndex] = useState(() => {
    const wanted = monthKeyOf(openOn ?? now);
    const index = months.findIndex((m) => monthKeyOf(m) === wanted);
    return index >= 0 ? index : 0;
  });
  const [picked, setPicked] = useState<Date | null>(null);

  const weekLabelByIndex = useMemo(
    () => new Map(data.weeks.map((week) => [week.index, week.label])),
    [data.weeks]
  );
  const undated = useMemo(
    () => [
      ...data.bands.filter((b) => !entryDay(b.starts_at)).map((b) => ({ entry: b, troop: true })),
      ...data.cells.filter((c) => !entryDay(c.starts_at)).map((c) => ({ entry: c, troop: false })),
    ],
    [data.bands, data.cells]
  );

  if (months.length === 0) {
    return (
      <p className={styles.empty}>
        Þetta starfsár hefur engar dagsettar vikur, svo ekkert dagatal er hægt að teikna. Krot er
        ódagsett — notaðu bekkinn eða ristina fyrir það.
      </p>
    );
  }

  // Clamped, so a refetch that shortens the season never leaves the view past its end.
  const safeIndex = Math.min(monthIndex, months.length - 1);
  const month = months[safeIndex];
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
    picked && inMonth(picked) ? picked : inMonth(now) ? now : (monthEntries[0]?.day ?? month);
  const named = new Set<string>();
  const noteOf = (week: Date[]) =>
    data.weeks.find((w) => w.starts_on && isSameDay(parseDay(w.starts_on), week[0]))?.note;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <h2 className={styles.monthTitle} id={headingId}>
          {formatIcelandicMonthYear(month)}
        </h2>
        <button
          type="button"
          className={styles.nav}
          // Stepped from `safeIndex`, not the raw state: after a clamp, stepping from the raw
          // index would take several presses before the view moved at all.
          onClick={() => setMonthIndex(Math.max(0, safeIndex - 1))}
          disabled={safeIndex === 0}
          aria-label="Fyrri mánuður"
        >
          ←
        </button>
        <button
          type="button"
          className={styles.nav}
          onClick={() => setMonthIndex(Math.min(months.length - 1, safeIndex + 1))}
          disabled={safeIndex === months.length - 1}
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
                const isToday = isSameDay(d, now);
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
                      <StampStrip key={segment.entry.id} segment={segment} onSelect={onSelect} />
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

      {undated.length > 0 && (
        <div className={styles.undated}>
          <h3 className={styles.undatedTitle}>Skráð á viku, ekki á dag</h3>
          <ul className={styles.undatedList}>
            {undated.map(({ entry, troop }) => (
              <li key={entry.event_id}>
                <span className={styles.undatedWeek}>
                  {weekLabelByIndex.get(entry.week_index) ?? `Vika ${entry.week_index}`}
                </span>
                <span>{entry.title}</span>
                {troop && <span className={styles.troopWide}>Öll sveitin</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One day cell at the grid's desktop width, any strip drawn above its entries (the docs). */
export function DayCell({
  day,
  entries,
  today = new Date(),
  onSelect,
}: {
  day: Date;
  entries: CalendarEntry[];
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
