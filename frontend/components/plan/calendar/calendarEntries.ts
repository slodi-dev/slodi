/**
 * The Dagatal's view of a grid: every dated entry placed on its days and judged against the
 * weekly rhythm.
 *
 * ## A month is a rhythm plus exceptions
 *
 * A sveit almost always meets the same way every week: each flokkur on its own weekday at its
 * own time. Around that rhythm sit the exceptions: a fös–sun útilega, a laugardags dagsferð, a
 * mót, a fundur moved because of a sveitarfundur, a week that falls out (vetrarfrí). So every
 * entry gets an `EntryKind`, and the calendar draws the usual fundur quietly and the exceptions
 * loudly.
 *
 * ## Derived, because the contract doesn't say
 *
 * - The weekly rhythm is *derived* from the fundir (the most common weekday and time per
 *   flokkur), because nothing in the contract declares a recurrence.
 * - "Moved from" is inferred: the flokkur had nothing, not even a cancelled fundur, on its usual
 *   day that week.
 * - `ends_at` and `cancelled` are optional on the contract (proposed in sc-646); without them a
 *   multi-day event is its first day only and nothing ever falls out.
 */
import { countIs, formatIcelandicDateShort, formatIcelandicDayMonth } from "@/lib/format";
import { PATROL_ACCENTS, formatClock } from "@/components/plan/planEntries";
import {
  STATUS_LABEL,
  type EventType,
  type Patrol,
  type PlanBand,
  type PlanCell,
  type PlanGrid,
  type PlanStatus,
} from "@/services/plan.service";

export const TYPE_LABEL: Record<EventType, string> = {
  skipulags: "Skipulagsfundur",
  sveitar: "Sveitarfundur",
  flokks: "Flokksfundur",
  uppskeru: "Uppskeruhátíð",
  utilega: "Útilega",
  dagsferd: "Dagsferð",
  mot: "Mót",
};

/** Mánudagur-first weekday names. */
export const WEEKDAY_SHORT = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];
export const WEEKDAY_FULL = [
  "mánudagur",
  "þriðjudagur",
  "miðvikudagur",
  "fimmtudagur",
  "föstudagur",
  "laugardagur",
  "sunnudagur",
];

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week a date falls in. */
export function mondayOf(date: Date): Date {
  return addDays(date, -weekdayOf(date));
}

/** A local date from the date part of an ISO string. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayKey(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/* ── The weekly rhythm, derived ── */

export type Rhythm = { patrol: Patrol; weekday: number; clock: string };

/**
 * Each flokkur's usual weekday and time: the most common pair among its fundir. Derived because
 * the contract has no recurrence rule. A flokkur with no clear habit (under three) gets none.
 */
export function deriveRhythms(data: PlanGrid): Rhythm[] {
  return data.patrols.flatMap((patrol) => {
    const counts = new Map<string, number>();
    for (const cell of data.cells) {
      if (cell.patrol_id !== patrol.id || !cell.starts_at || cell.cancelled) continue;
      const key = `${weekdayOf(parseDay(cell.starts_at))} ${formatClock(cell.starts_at)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 3) return [];
    const [weekday, clock] = best[0].split(" ");
    return [{ patrol, weekday: Number(weekday), clock }];
  });
}

/* ── One entry, placed and judged ── */

export type EntryKind =
  /** The flokkur's usual fundur on its usual evening. */
  | "routine"
  /** Anything else on one day: a troop event, an extra or moved fundur. */
  | "exception"
  /** A flokksfundur that falls out. */
  | "cancelled"
  /** Runs over more than one day. */
  | "span";

export type CalendarEntry = {
  id: string;
  title: string;
  type: EventType;
  status: PlanStatus;
  kind: EntryKind;
  clock: string | null;
  venue: string | null;
  theme: string | null;
  day: Date;
  /** Last day, for a span. Equal to `day` otherwise. */
  endDay: Date;
  /** Days covered, 1 unless a span. */
  spanDays: number;
  patrol?: Patrol;
  /** The `--sl-color-patrol-*` base name, the same one the Rist uses. Absent when troop-wide. */
  patrolVar?: string;
  troopWide: boolean;
  /** The flokkur's usual day, when this fundur was moved off it (inferred). */
  movedFrom?: Date;
  /** Why it falls out, when cancelled. */
  cancelledReason?: string;
  overMinutes: number;
  /** The last day is before today. */
  past: boolean;
};

/** The patrol's colour, resolved the way the Rist does: its accent, else its column's. */
function patrolVarOf(data: PlanGrid, patrol: Patrol): string {
  const index = data.patrols.indexOf(patrol);
  const accent = patrol.accent ?? PATROL_ACCENTS[index % PATROL_ACCENTS.length];
  return `--sl-color-patrol-${accent}`;
}

/** Every dated entry, in time order. Undated ones are left out: they have no day to go on. */
export function placeEntries(data: PlanGrid, today: Date): CalendarEntry[] {
  const rhythms = new Map(deriveRhythms(data).map((r) => [r.patrol.id, r]));

  /** Did this flokkur have anything (even a cancelled fundur) on its usual day that week? */
  const onUsualDay = (patrolId: string, date: Date): boolean => {
    const rhythm = rhythms.get(patrolId);
    if (!rhythm) return true;
    const usual = dayKey(addDays(mondayOf(date), rhythm.weekday));
    return data.cells.some(
      (c) => c.patrol_id === patrolId && c.starts_at && dayKey(parseDay(c.starts_at)) === usual
    );
  };

  const place = (entry: PlanCell | PlanBand, patrol: Patrol | undefined): CalendarEntry | null => {
    if (!entry.starts_at) return null;
    const day = parseDay(entry.starts_at);
    const end = entry.ends_at ? parseDay(entry.ends_at) : day;
    // An end before the start is a data error; drawing it backwards would be worse than a day.
    const endDay = dayKey(end) < dayKey(day) ? day : end;
    const spanDays = Math.round((dayKey(endDay) - dayKey(day)) / 86_400_000) + 1;
    const clock = formatClock(entry.starts_at);
    const rhythm = patrol ? rhythms.get(patrol.id) : undefined;
    const isUsual = Boolean(rhythm && rhythm.weekday === weekdayOf(day) && rhythm.clock === clock);

    let kind: EntryKind = "exception";
    if (entry.cancelled) kind = "cancelled";
    else if (spanDays > 1) kind = "span";
    else if (isUsual) kind = "routine";

    const movedFrom =
      patrol && rhythm && kind === "exception" && !onUsualDay(patrol.id, day)
        ? addDays(mondayOf(day), rhythm.weekday)
        : undefined;

    const over = (entry.actual_minutes ?? 0) - (entry.planned_minutes ?? Infinity);
    return {
      id: entry.event_id,
      title: entry.title,
      type: entry.type,
      status: entry.status,
      kind,
      clock,
      venue: entry.venue ?? null,
      theme: entry.theme ?? null,
      day,
      endDay,
      spanDays,
      patrol,
      patrolVar: patrol ? patrolVarOf(data, patrol) : undefined,
      troopWide: !patrol,
      movedFrom,
      cancelledReason: entry.cancelled?.reason,
      overMinutes: over > 0 ? over : 0,
      past: dayKey(endDay) < dayKey(today),
    };
  };

  const all = [
    ...data.bands.map((band) => place(band, undefined)),
    // A cell whose flokkur matches nothing keeps no patrol rather than borrowing the first
    // one's colour and name: a label that lies is worse than none.
    ...data.cells.map((cell) =>
      place(
        cell,
        data.patrols.find((p) => p.id === cell.patrol_id)
      )
    ),
  ].filter((e): e is CalendarEntry => e !== null);

  return all.sort(
    (a, b) => dayKey(a.day) - dayKey(b.day) || (a.clock ?? "").localeCompare(b.clock ?? "")
  );
}

/** Does the entry cover this day? */
export function coversDay(entry: CalendarEntry, date: Date): boolean {
  const k = dayKey(date);
  return k >= dayKey(entry.day) && k <= dayKey(entry.endDay);
}

/** 1-based position of a day inside a span: "dagur 2 af 3". */
export function dayOfSpan(entry: CalendarEntry, date: Date): number {
  return Math.round((dayKey(date) - dayKey(entry.day)) / 86_400_000) + 1;
}

/** "fös 30. okt.–sun 1. nóv." */
export function spanRange(entry: CalendarEntry): string {
  const at = (d: Date) => `${WEEKDAY_SHORT[weekdayOf(d)]} ${formatIcelandicDateShort(d)}`;
  return `${at(entry.day)}–${at(entry.endDay)}`;
}

/** "Flokksfundur Arna", "Sveitarfundur", "Útilega": what kind of thing, and whose. */
export function kindPhrase(entry: CalendarEntry): string {
  if (!entry.patrol) return TYPE_LABEL[entry.type];
  const genitive = entry.patrol.name_genitive;
  return genitive
    ? `${TYPE_LABEL[entry.type]} ${genitive}`
    : `${TYPE_LABEL[entry.type]} (${entry.patrol.name})`;
}

/**
 * The accessible name of an entry's button.
 *
 * - "Flokksfundur Arna: Hnútar og bönd, 20. október kl. 19:30, Skátaheimilið, staðfest"
 * - "Haustútilega á Úlfljótsvatni, fös 30. okt.–sun 1. nóv., öll sveitin, Úlfljótsvatn, drög"
 * - "Flokksfundur Bjarna fellur niður, 22. október: vetrarfrí"
 */
export function entryName(entry: CalendarEntry): string {
  if (entry.kind === "cancelled") {
    return `${kindPhrase(entry)} fellur niður, ${formatIcelandicDayMonth(entry.day)}${
      entry.cancelledReason ? `: ${entry.cancelledReason}` : ""
    }`;
  }
  const parts =
    entry.kind === "span"
      ? [entry.title, spanRange(entry), entry.patrol ? entry.patrol.name : "öll sveitin"]
      : [
          `${kindPhrase(entry)}${entry.troopWide ? ", öll sveitin" : ""}: ${entry.title}`,
          `${formatIcelandicDayMonth(entry.day)}${entry.clock ? ` kl. ${entry.clock}` : ""}`,
        ];
  if (entry.venue) parts.push(entry.venue);
  parts.push(STATUS_LABEL[entry.status].toLowerCase());
  if (entry.movedFrom) parts.push(`fært frá ${formatIcelandicDayMonth(entry.movedFrom)}`);
  if (entry.overMinutes > 0)
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  if (entry.past) parts.push("lokið");
  return parts.join(", ");
}

/** The first letter of a flokkur; "S" for the whole sveit. */
export function patrolInitial(entry: CalendarEntry): string {
  return entry.patrol ? entry.patrol.name.charAt(0).toUpperCase() : "S";
}
