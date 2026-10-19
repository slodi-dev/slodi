import type {
  Patrol,
  PatrolAccent,
  PlanBand,
  PlanCell,
  PlanGrid,
  PlanWeek,
} from "@/services/plan.service";

/**
 * Turning the grid into one flokkur's list of meetings.
 *
 * Shared by the rolling window (A7) and the timeline (A4), which are the same
 * projection at two zoom levels — the window is the timeline sliced to the next
 * few. Keeping the derivation in one place is what stops them disagreeing about
 * what counts as a meeting or as done, which is the sort of drift ADR-002 §2's
 * "one dataset" is supposed to rule out.
 */

export type PlanEntry = {
  id: string;
  title: string;
  status: PlanCell["status"];
  week: PlanWeek;
  isDone: boolean;
  /** Troop-wide: every flokkur is on it, so it appears in each one's list. */
  isTroopWide: boolean;
};

/**
 * A week counts as done once it is over, not once it has begun.
 *
 * `starts_on` is the Monday, but the fundur is usually midweek — comparing
 * against the start would grey out on Monday morning the very meeting the
 * leader opened the planner to prepare for.
 *
 * An undated week — a scratchpad — is never done: there is no date to be past,
 * and marking it done would make a scratchpad look like a finished term.
 */
export function isWeekDone(week: PlanWeek, today: Date): boolean {
  const start = parseWeekStart(week);
  if (!start) return false;
  // A date-only ISO string parses as UTC midnight while `today` is a local
  // instant, so comparing them directly shifts the boundary by the offset —
  // invisible in Iceland, up to a day wrong further west. Compare calendar days.
  const weekEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return weekEnd.getTime() <= today.getTime();
}

/** The week's Monday as a local date, or null when undated or malformed. */
export function parseWeekStart(week: PlanWeek): Date | null {
  if (!week.starts_on) return null;
  // Tolerates a datetime where the contract asks for a date: a NaN component
  // would otherwise make every week silently read as never-done.
  const [year, month, day] = week.starts_on.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Every meeting this flokkur is on, in week order.
 *
 * Troop-wide events are included because a sveitarfundur or útilega is a
 * meeting this flokkur attends by definition — omitting them would leave the
 * views showing only half of what is coming.
 */
export function entriesForPatrol(data: PlanGrid, patrolId: string | null, now: Date): PlanEntry[] {
  if (!patrolId) return [];

  const weekByIndex = new Map<number, PlanWeek>();
  for (const week of data.weeks) weekByIndex.set(week.index, week);

  const toEntry = (entry: PlanCell | PlanBand, isTroopWide: boolean): PlanEntry | null => {
    const week = weekByIndex.get(entry.week_index);
    if (!week) return null;
    return {
      id: entry.event_id,
      title: entry.title,
      status: entry.status,
      week,
      isDone: isWeekDone(week, now),
      isTroopWide,
    };
  };

  const mine = data.cells
    .filter((cell) => cell.patrol_id === patrolId)
    .map((cell) => toEntry(cell, false));
  const shared = data.bands.map((band) => toEntry(band, true));

  return [...mine, ...shared]
    .filter((entry): entry is PlanEntry => entry !== null)
    .sort((a, b) => a.week.index - b.week.index);
}

/**
 * The patrol to show, given what the user picked.
 *
 * The shell swaps `data` when the season changes without remounting, so a
 * patrol id from the previous season would survive and match nothing — an empty
 * view and a select with no option chosen.
 */
export function resolvePatrolId(data: PlanGrid, chosen: string | null): string | null {
  if (chosen && data.patrols.some((patrol) => patrol.id === chosen)) return chosen;
  return data.patrols[0]?.id ?? null;
}

/**
 * The patrol ramps, in the order an undeclared flokkur picks them up.
 *
 * A `Patrol` may not carry an accent — the field is optional, and the backend
 * that will fill it does not exist yet. Falling back on column position keeps
 * every flokkur visually distinct today, and keeps it *stable*: the same column
 * gets the same colour on every render and in every view, which is the whole
 * point of colouring them.
 */
export const PATROL_ACCENTS: PatrolAccent[] = [
  "rekkar",
  "drekar",
  "falkar",
  "drott",
  "rover",
  "adrir",
];

/** The CSS colour for a flokkur, declared or derived from its column. */
export function accentVarFor(patrol: Patrol | undefined, index: number): string {
  const accent = patrol?.accent ?? PATROL_ACCENTS[index % PATROL_ACCENTS.length];
  return `var(--sl-color-patrol-${accent})`;
}

/**
 * `HH:MM` from an entry's start, or null when it has none.
 *
 * Reads the clock out of the ISO string rather than constructing a `Date`: the
 * planner wants the local wall-clock time the fundur was scheduled for, and
 * parsing then re-formatting would move it by the viewer's offset — a leader
 * abroad would see their own meetings at the wrong time.
 */
export function formatClock(startsAt: string | null | undefined): string | null {
  if (!startsAt) return null;
  const match = /T(\d{2}):(\d{2})/.exec(startsAt);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** The local calendar day of an entry, or null when it has no date. */
export function entryDay(startsAt: string | null | undefined): Date | null {
  if (!startsAt) return null;
  const [year, month, day] = startsAt.slice(0, 10).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day);
}

/** Planned and actual minutes, normalised so views do not each guess a default. */
export function minutesOf(entry: PlanBand | PlanCell): {
  actual: number | null;
  planned: number | null;
} {
  return {
    actual: entry.actual_minutes ?? null,
    planned: entry.planned_minutes ?? null,
  };
}

/** Same calendar day, ignoring the time of day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
