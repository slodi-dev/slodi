/**
 * The data the timeline lab draws, derived from the same `entriesForPatrol` the real
 * PlanTimeline uses, so a direction can never disagree with it about what counts as a
 * fundur or as done. What it adds is what a spatial view needs and the chip list did not:
 * the day, the clock, the span, where "today" falls between the weeks, and whether a fundur
 * is the weekly routine or an exception to it (see planFamily.tsx).
 */
import {
  entriesForPatrol,
  entryDay,
  formatClock,
  parseWeekStart,
  type PlanEntry,
} from "@/components/plan/planEntries";
import { formatIcelandicDateShort, formatIcelandicDayMonth } from "@/lib/format";
import {
  STATUS_LABEL,
  type EventType,
  type PlanBand,
  type PlanCell,
  type PlanGrid,
  type PlanWeek,
} from "@/services/plan.service";
import {
  dayLabel,
  isMoved,
  isRoutine,
  lastDay,
  rhythmOf,
  TYPE_LABEL,
  type Rhythm,
} from "./planFamily";

export type TimelineEntry = PlanEntry & {
  /** The real day, when the entry has one; otherwise only its week is known. */
  day: Date | null;
  weekStart: Date | null;
  clock: string | null;
  spanWeeks: number;
  type: EventType;
  /** The last day of a multi-day event (an útilega fös–sun), else null. */
  until: Date | null;
  /** The weekly flokksfundur at its usual time: drawn quietly. */
  routine: boolean;
  /** A flokksfundur moved off its usual evening or time: worth noticing. */
  moved: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** One flokkur's season, in order, with its rhythm and what the directions need on top. */
export function timelineSeason(
  data: PlanGrid,
  patrolId: string | null,
  now: Date
): { entries: TimelineEntry[]; rhythm: Rhythm | null } {
  const raw = new Map<string, PlanCell | PlanBand>();
  for (const entry of [...data.cells, ...data.bands]) raw.set(entry.event_id, entry);

  const base = entriesForPatrol(data, patrolId, now).map((entry) => {
    const source = raw.get(entry.id);
    return {
      ...entry,
      day: entryDay(source?.starts_at),
      weekStart: parseWeekStart(entry.week),
      clock: formatClock(source?.starts_at),
      spanWeeks: Math.max(1, source?.span_weeks ?? 1),
      type: source?.type ?? ("flokks" as EventType),
      until: lastDay(source?.starts_at, source?.planned_minutes),
    };
  });
  const rhythm = rhythmOf(base);
  const entries = base.map((e) => ({
    ...e,
    routine: isRoutine(e, rhythm),
    moved: isMoved(e, rhythm),
  }));
  return { entries, rhythm };
}

export function timelineEntries(data: PlanGrid, patrolId: string | null, now: Date) {
  return timelineSeason(data, patrolId, now).entries;
}

/** True when the season has dates at all; a scratchpad has none. */
export function isDated(data: PlanGrid): boolean {
  return data.weeks.some((week) => parseWeekStart(week) !== null);
}

/**
 * Where today sits on the week axis, as a fractional week index (week 3, Thursday ≈ 3.5),
 * or null on an undated season. Clamped to the axis so "the season is over" still has a
 * place to draw the marker: just after the last week.
 */
export function todayPosition(weeks: PlanWeek[], now: Date): number | null {
  const dated = weeks
    .map((week) => ({ week, start: parseWeekStart(week) }))
    .filter((w): w is { week: PlanWeek; start: Date } => w.start !== null);
  if (dated.length === 0) return null;

  const first = dated[0];
  const last = dated[dated.length - 1];
  // Calendar days, not instants: today's marker should not drift with the time of day.
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((day.getTime() - first.start.getTime()) / DAY_MS);
  const sinceFirst = days / 7;
  const position = first.week.index + sinceFirst;
  return Math.min(Math.max(position, first.week.index), last.week.index + 1);
}

/** "þri 21. okt.", "fös 30. okt.–sun 1. nóv.", "Vika frá 20. okt." or "Vika 3". */
export function whenLabel(entry: TimelineEntry): string {
  if (entry.day) return dayLabel(entry.day, entry.until);
  if (entry.weekStart) return `Vika frá ${formatIcelandicDateShort(entry.weekStart)}`;
  return entry.week.label;
}

/**
 * The full accessible name for an entry: everything the eye gets from position, colour
 * and fill, in words. Same shape as the calendar lab's ("Hnútar og bönd, 21. október kl.
 * 19:30, drög, lokið"), so an entry sounds the same in every view and every look.
 */
export function entryName(entry: TimelineEntry): string {
  const when = entry.day
    ? formatIcelandicDayMonth(entry.day) +
      (entry.until ? ` til ${formatIcelandicDayMonth(entry.until)}` : "")
    : entry.weekStart
      ? `vika frá ${formatIcelandicDayMonth(entry.weekStart)}`
      : entry.week.label;
  const kind = entry.type === "flokks" ? "" : `${TYPE_LABEL[entry.type]}: `;
  const parts = [kind + entry.title, when + (entry.clock ? ` kl. ${entry.clock}` : "")];
  if (entry.moved) parts.push("breyttur tími");
  if (entry.spanWeeks > 1) parts.push(`${entry.spanWeeks} vikur`);
  if (entry.isTroopWide) parts.push("öll sveitin");
  parts.push(STATUS_LABEL[entry.status].toLowerCase());
  if (entry.isDone) parts.push("lokið");
  return parts.join(", ");
}

/** Weeks between two entries with nothing on them for this flokkur. */
export function gapWeeksAfter(entry: TimelineEntry, next: TimelineEntry | undefined): number {
  if (!next) return 0;
  return Math.max(0, next.week.index - (entry.week.index + entry.spanWeeks));
}
