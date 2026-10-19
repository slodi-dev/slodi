"use client";

import { useMemo, useState } from "react";
import type { PlanBand, PlanCell, PlanGrid as PlanGridData } from "@/services/plan.service";
import { countIs, formatIcelandicMonthYear } from "@/lib/format";
import { entryDay, isSameDay, parseWeekStart } from "./planEntries";
import PlanEntryChip from "./PlanEntryChip";
import styles from "./PlanCalendar.module.css";

/**
 * The Dagatal (A4, sc-39) — the shared artifact A5 builds on. v5 hi-fi.
 *
 * ## Days when it knows the day, weeks when it does not
 *
 * The grid contract carries `week_index` for every entry; `starts_at` is
 * optional, because the endpoints that will supply it do not exist yet. So this
 * view does both, and is explicit about which it is doing:
 *
 * - an entry with a date is drawn **on that day**, as the design shows;
 * - an entry without one is listed under the month as belonging to a *week*.
 *
 * The fallback is not a nicety. Placing an undated útilega on its week's Monday
 * because that is the only date available would invent information the planner
 * does not have, and a leader setting dates around this calendar would be
 * misled. Better a list that says "this week" than a grid that lies about a day.
 *
 * Month names come from `lib/format.ts`, never `Intl`: Chrome has no is-IS
 * data and falls back to English ("OCTOBER 2026").
 */

/** Mánudagur-first, which is how an Icelandic week reads. */
const WEEKDAYS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];

const DAYS_IN_GRID = 42;

interface Props {
  data: PlanGridData;
  /** Injectable so tests do not depend on the day they run. */
  today?: Date;
}

type Placed = {
  entry: PlanBand | PlanCell;
  troopWide: boolean;
  day: Date | null;
  /** Column position of the owning flokkur, so its colour matches the Rist. */
  patrolIndex: number;
};

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The Monday on or before a date — the first cell of its calendar row. */
function mondayOnOrBefore(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekday);
}

export default function PlanCalendar({ data, today }: Props) {
  const now = useMemo(() => today ?? new Date(), [today]);

  const placed = useMemo<Placed[]>(() => {
    const all: Placed[] = [];
    // Every patrol's meetings, not one — this is the whole-troop view.
    for (const band of data.bands) {
      all.push({ entry: band, troopWide: true, day: entryDay(band.starts_at), patrolIndex: 0 });
    }
    for (const cell of data.cells) {
      all.push({
        entry: cell,
        troopWide: false,
        day: entryDay(cell.starts_at),
        // A flokkur keeps its colour across all three views, which only holds
        // if the calendar resolves it the same way the grid does. Left at -1
        // when the id matches nothing: drawing an unknown cell in the *first*
        // flokkur's colour and identity is a label that lies.
        patrolIndex: data.patrols.findIndex((patrol) => patrol.id === cell.patrol_id),
      });
    }
    return all;
  }, [data.bands, data.cells, data.patrols]);

  /** Months to page through: any month a dated week or a dated entry falls in. */
  const months = useMemo(() => {
    const byMonth = new Map<string, Date>();
    for (const week of data.weeks) {
      const start = parseWeekStart(week);
      if (start) byMonth.set(monthKeyOf(start), new Date(start.getFullYear(), start.getMonth(), 1));
    }
    for (const { day } of placed) {
      if (day) byMonth.set(monthKeyOf(day), new Date(day.getFullYear(), day.getMonth(), 1));
    }
    return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, date]) => date);
  }, [data.weeks, placed]);

  const [monthIndex, setMonthIndex] = useState(() => {
    const current = months.findIndex((month) => monthKeyOf(month) === monthKeyOf(now));
    return current >= 0 ? current : 0;
  });

  const weekLabelByIndex = useMemo(
    () => new Map(data.weeks.map((week) => [week.index, week.label])),
    [data.weeks]
  );

  if (months.length === 0) {
    return (
      <p className={styles.empty}>
        Þetta starfsár hefur engar dagsettar vikur, svo ekkert dagatal er hægt að teikna. Krot er
        ódagsett — notaðu bekkinn eða ristina fyrir það.
      </p>
    );
  }

  const safeIndex = Math.min(monthIndex, months.length - 1);
  const month = months[safeIndex];

  const inThisMonth = (day: Date) =>
    day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();

  const gridStart = mondayOnOrBefore(month);
  const days: Date[] = [];
  for (let i = 0; i < DAYS_IN_GRID; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const dated = placed.filter((p): p is Placed & { day: Date } => p.day !== null);
  const undated = placed.filter((p) => p.day === null);
  const elsewhere = dated.filter((p) => !inThisMonth(p.day)).length;

  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  /**
   * Drop a trailing row that belongs entirely to the next month.
   *
   * Trimmed by whole rows, never by day. An earlier version stopped as soon as
   * it passed day 35 and left the calendar, which cut the final week in half:
   * March 2026 rendered a last row of two cells instead of seven. A month is
   * five or six weeks; it is never five and two sevenths.
   */
  while (rows.length > 1 && rows[rows.length - 1].every((day) => !inThisMonth(day))) {
    rows.pop();
  }

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <h2 className={styles.monthTitle}>{formatIcelandicMonthYear(month)}</h2>
        <button
          type="button"
          className={styles.nav}
          // Stepped from `safeIndex`, not the raw state. A refetch that shortens
          // the season leaves `monthIndex` above the clamp, and stepping from it
          // means several presses before the view moves at all.
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
          {elsewhere > 0
            ? `${countIs(elsewhere, "fundur", "fundir")} í öðrum mánuðum`
            : "allir dagsettir fundir í þessum mánuði"}
        </span>
      </div>

      <div className={styles.cal}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Dagatal — dagsettir fundir á sínum degi. Ódagsettir liðir eru taldir fyrir neðan.
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col" className={styles.dayHead}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0].toDateString()}>
                {row.map((day) => {
                  const out = !inThisMonth(day);
                  const isToday = isSameDay(day, now);
                  const onThisDay = dated.filter((p) => isSameDay(p.day, day));
                  return (
                    <td
                      key={day.toDateString()}
                      className={`${styles.day} ${out ? styles.out : ""} ${isToday ? styles.today : ""}`}
                    >
                      <span className={styles.dayHd}>
                        <span className={styles.dayNumber}>{day.getDate()}</span>
                      </span>
                      {onThisDay.map(({ entry, troopWide, patrolIndex }) => (
                        <PlanEntryChip
                          key={entry.event_id}
                          entry={entry}
                          patrol={patrolIndex >= 0 ? data.patrols[patrolIndex] : undefined}
                          patrolIndex={Math.max(0, patrolIndex)}
                          meta="venue"
                          isTroopWide={troopWide}
                        />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {undated.length > 0 && (
        <div className={styles.undated}>
          <h3 className={styles.undatedTitle}>Skráð á viku, ekki á dag</h3>
          <ul className={styles.undatedList}>
            {undated.map(({ entry, troopWide }) => (
              <li key={entry.event_id}>
                <span className={styles.undatedWeek}>
                  {weekLabelByIndex.get(entry.week_index) ?? `Vika ${entry.week_index}`}
                </span>
                <span>{entry.title}</span>
                {troopWide && <span className={styles.troopWide}>Öll sveitin</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
