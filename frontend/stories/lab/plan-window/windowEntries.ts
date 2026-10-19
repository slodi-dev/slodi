/**
 * The working window's data: the same `entriesForPatrol` the real PlanWindow slices, plus
 * *readiness*: what is decided about each fundur and what is still open. That is what a
 * leader works on in this view, so every direction draws it, each in its own way. Also
 * the flokkur's weekly rhythm, so a direction can keep the routine fundur quiet and put
 * the exceptions (an útilega, a dagsferð, a moved fundur) forward. See planFamily.tsx.
 */
import {
  entriesForPatrol,
  entryDay,
  formatClock,
  minutesOf,
  parseWeekStart,
  type PlanEntry,
} from "@/components/plan/planEntries";
import {
  countIs,
  formatIcelandicDateShort,
  formatIcelandicDayMonth,
  formatIcelandicNumber,
  formatMinutes,
} from "@/lib/format";
import {
  STATUS_LABEL,
  type EventType,
  type PlanBand,
  type PlanCell,
  type PlanGrid,
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

/**
 * Lab only: how many of a fundur's liðir are decided. The grid contract has the count of
 * liðir (`item_count`) but not their status, which lives per liður in the bench data. The
 * calendar lab reached the same gap and named the same field; a window that shows
 * readiness needs it summed per fundur, so it is one the contract would have to grow.
 * Absent means "not known", which reads as all decided rather than inventing open work.
 */
export type ReadinessExtra = { decided_count?: number | null };

export type WindowGrid = Omit<PlanGrid, "cells" | "bands"> & {
  cells: (PlanCell & ReadinessExtra)[];
  bands: (PlanBand & ReadinessExtra)[];
};

export type CheckKey = "efni" | "dagur" | "stadur" | "lidir" | "timi";

/** One thing that is either settled or still to do. `text` reads well either way. */
export type Check = { key: CheckKey; ok: boolean; text: string };

export const CHECK_LABEL: Record<CheckKey, string> = {
  efni: "Efni",
  dagur: "Dagur",
  stadur: "Staður",
  lidir: "Liðir",
  timi: "Tími",
};

export type WindowEntry = PlanEntry & {
  type: EventType;
  /** The last day of a multi-day event, else null. */
  until: Date | null;
  /** The weekly flokksfundur at its usual time. */
  routine: boolean;
  /** A flokksfundur moved off its usual evening or time. */
  moved: boolean;
  day: Date | null;
  weekStart: Date | null;
  clock: string | null;
  venue: string | null;
  needs: string[];
  checks: Check[];
  open: Check[];
};

/** "100 / 90 mín", or hours once a fundur is a camp: "48 klst / 48 klst". */
export function budgetText(actual: number, planned: number): string {
  if (Math.max(actual, planned) < 6 * 60) {
    return `${formatIcelandicNumber(actual)} / ${formatIcelandicNumber(planned)} mín`;
  }
  return `${formatMinutes(actual)} / ${formatMinutes(planned)}`;
}

function checksFor(
  entry: PlanEntry,
  source: (PlanCell | PlanBand) & ReadinessExtra,
  dated: boolean
): Check[] {
  const checks: Check[] = [];
  checks.push(
    entry.status === "unknown"
      ? { key: "efni", ok: false, text: "Efni fundar óákveðið" }
      : { key: "efni", ok: true, text: "Efni ákveðið" }
  );

  // A scratchpad has no dates by design; asking for one on every fundur would be noise.
  if (dated) {
    const day = entryDay(source.starts_at);
    const weekStart = parseWeekStart(entry.week);
    const clock = formatClock(source.starts_at);
    checks.push(
      day
        ? {
            key: "dagur",
            ok: true,
            text:
              dayLabel(day, lastDay(source.starts_at, source.planned_minutes)) +
              (clock ? ` kl. ${clock}` : ""),
          }
        : {
            key: "dagur",
            ok: false,
            text: weekStart
              ? `Vantar dag (vika frá ${formatIcelandicDateShort(weekStart)})`
              : "Vantar dag",
          }
    );
  }

  checks.push(
    source.venue
      ? { key: "stadur", ok: true, text: source.venue }
      : { key: "stadur", ok: false, text: "Vantar staðsetningu" }
  );

  const items = source.item_count ?? 0;
  const undecided = Math.max(0, items - (source.decided_count ?? items));
  checks.push(
    items === 0
      ? { key: "lidir", ok: false, text: "Engir liðir enn" }
      : undecided > 0
        ? {
            key: "lidir",
            ok: false,
            text: countIs(undecided, "liður óákveðinn", "liðir óákveðnir"),
          }
        : { key: "lidir", ok: true, text: countIs(items, "liður ákveðinn", "liðir ákveðnir") }
  );

  const { actual, planned } = minutesOf(source);
  checks.push(
    actual === null || planned === null
      ? { key: "timi", ok: false, text: "Engin tímaáætlun" }
      : actual > planned
        ? {
            key: "timi",
            ok: false,
            text: `${budgetText(actual, planned)}, ${countIs(actual - planned, "mínúta", "mínútur")} umfram`,
          }
        : { key: "timi", ok: true, text: budgetText(actual, planned) }
  );
  return checks;
}

export function isDated(data: Pick<PlanGrid, "weeks">): boolean {
  return data.weeks.some((week) => parseWeekStart(week) !== null);
}

/** One flokkur's fundir, in order, each with its readiness, and the flokkur's rhythm. */
export function windowSeason(
  data: WindowGrid,
  patrolId: string | null,
  now: Date
): { entries: WindowEntry[]; rhythm: Rhythm | null } {
  const dated = isDated(data);
  const raw = new Map<string, (PlanCell | PlanBand) & ReadinessExtra>();
  for (const entry of [...data.cells, ...data.bands]) raw.set(entry.event_id, entry);

  const base = entriesForPatrol(data as PlanGrid, patrolId, now).flatMap((entry) => {
    const source = raw.get(entry.id);
    if (!source) return [];
    const checks = checksFor(entry, source, dated);
    return [
      {
        ...entry,
        type: source.type,
        until: lastDay(source.starts_at, source.planned_minutes),
        day: entryDay(source.starts_at),
        weekStart: parseWeekStart(entry.week),
        clock: formatClock(source.starts_at),
        venue: source.venue ?? null,
        needs: source.needs ?? [],
        checks,
        open: checks.filter((c) => !c.ok),
      },
    ];
  });
  const rhythm = rhythmOf(base);
  const entries = base.map((e) => ({
    ...e,
    routine: isRoutine(e, rhythm),
    moved: isMoved(e, rhythm),
  }));
  return { entries, rhythm };
}

export function windowEntries(data: WindowGrid, patrolId: string | null, now: Date): WindowEntry[] {
  return windowSeason(data, patrolId, now).entries;
}

/**
 * The window, sliced the way PlanWindow slices it: the last done fundur for context, then
 * the next `ahead`. Sliced around the first not-done fundur rather than today's date, so an
 * undated scratchpad still shows its first few.
 */
export function sliceWindow(entries: WindowEntry[], ahead: number) {
  const first = entries.findIndex((e) => !e.isDone);
  if (first === -1)
    return { behind: entries[entries.length - 1] ?? null, ahead: [] as WindowEntry[] };
  return {
    behind: first > 0 ? entries[first - 1] : null,
    ahead: entries.slice(first, first + ahead),
  };
}

/** "þri 21. okt.", "fös 30. okt.–sun 1. nóv.", "Vika frá 20. okt." or "Vika 3". */
export function whenLabel(entry: WindowEntry): string {
  if (entry.day) return dayLabel(entry.day, entry.until);
  if (entry.weekStart) return `Vika frá ${formatIcelandicDateShort(entry.weekStart)}`;
  return entry.week.label;
}

export function readinessText(entry: WindowEntry): string {
  const ready = entry.checks.length - entry.open.length;
  if (entry.open.length === 0) return "Allt klárt";
  return `${ready} af ${entry.checks.length} klár. ${entry.open.map((c) => c.text).join("; ")}`;
}

/**
 * The full accessible name, the same in every direction and the same shape as the
 * calendar and timeline labs': "Hnútar og bönd, 21. október kl. 19:30, Öskjuhlíð, …",
 * then "lokið" for a past fundur or its readiness for one ahead.
 */
export function entryName(entry: WindowEntry): string {
  const date = entry.day
    ? formatIcelandicDayMonth(entry.day) +
      (entry.until ? ` til ${formatIcelandicDayMonth(entry.until)}` : "")
    : entry.weekStart
      ? `vika frá ${formatIcelandicDayMonth(entry.weekStart)}`
      : entry.week.label;
  const kind = entry.type === "flokks" ? "" : `${TYPE_LABEL[entry.type]}: `;
  const parts = [kind + entry.title, date + (entry.clock ? ` kl. ${entry.clock}` : "")];
  if (entry.moved) parts.push("breyttur tími");
  if (entry.venue) parts.push(entry.venue);
  if (entry.isTroopWide) parts.push("öll sveitin");
  parts.push(STATUS_LABEL[entry.status].toLowerCase());
  parts.push(entry.isDone ? "lokið" : readinessText(entry));
  return parts.join(", ");
}
