/**
 * Seasons for the window lab, built on the real fixture (lib/mock/plan.mock.ts), which is
 * anchored to today. The fixture's fundir all have a venue, a budget and decided liðir, so a
 * readiness view would show nothing to do. These add the open work a real term has, ramping
 * with distance the way A8's progressive detailing does: the next fundur is nearly ready, the
 * ones after it less and less.
 */
import { isWeekDone } from "@/components/plan/planEntries";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import type { PlanBand, PlanCell, PlanGrid } from "@/services/plan.service";
import type { ReadinessExtra, WindowGrid } from "./windowEntries";

type Entry = (PlanCell | PlanBand) & ReadinessExtra;

/** The same start moved `days` later and to `clock`, the way a fundur gets moved. */
function moveTo(startsAt: string | null | undefined, days: number, clock: string): string | null {
  if (!startsAt) return null;
  const [y, m, d] = startsAt.slice(0, 10).split("-").map(Number);
  const day = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${clock}:00`;
}

/** What is still open on the fundur `rank` places ahead of today. */
function openWorkFor<T extends Entry>(entry: T, rank: number): T {
  const items = entry.item_count || 5;
  const planned = entry.planned_minutes ?? 90;
  // On budget unless the rank says otherwise; the base fixture drifts over on purpose.
  const settled = { item_count: items, decided_count: items, actual_minutes: planned - 5 };
  switch (rank) {
    case 0:
      return { ...entry, ...settled };
    case 1:
      return { ...entry, ...settled, decided_count: items - 2 };
    case 2:
      // Moved to another evening, and the new venue is not booked yet.
      return {
        ...entry,
        ...settled,
        venue: null,
        actual_minutes: planned + 15,
        starts_at: entry.type === "flokks" ? moveTo(entry.starts_at, 2, "18:00") : entry.starts_at,
      };
    case 3:
      // A8: the skeleton is in, nothing about it is decided yet.
      return {
        ...entry,
        status: "unknown",
        venue: null,
        item_count: 0,
        actual_minutes: null,
        needs: [],
      };
    default:
      return { ...entry, ...settled, venue: null, decided_count: items - 1 };
  }
}

/**
 * Rank each fundur by its place among the flokkur's fundir ahead (0 = the next one). Bands
 * are shared, so they rank among themselves, one place back: the next troop event is
 * rarely the very next thing a flokkur has to sort.
 */
function withOpenWork(data: PlanGrid, now: Date): WindowGrid {
  const weekOf = new Map(data.weeks.map((w) => [w.index, w]));
  const ahead = (e: Entry) => {
    const week = weekOf.get(e.week_index);
    return week ? !isWeekDone(week, now) : false;
  };
  const byWeek = (a: Entry, b: Entry) => a.week_index - b.week_index;

  const rankOf = new Map<string, number>();
  for (const patrol of data.patrols) {
    data.cells
      .filter((c) => c.patrol_id === patrol.id && ahead(c))
      .sort(byWeek)
      .forEach((c, i) => rankOf.set(c.event_id, i));
  }
  data.bands
    .filter(ahead)
    .sort(byWeek)
    .forEach((b, i) => rankOf.set(b.event_id, i + 1));

  const tweak = <T extends Entry>(e: T): T => {
    const rank = rankOf.get(e.event_id);
    return rank === undefined ? e : openWorkFor(e, rank);
  };
  return { ...data, cells: data.cells.map(tweak), bands: data.bands.map(tweak) };
}

/** A real working term: the next fundur ready, open items piling up further out. */
export function busyGrid(now = new Date()): WindowGrid {
  return withOpenWork(mockGrid(MOCK_SEASON_ID), now);
}

/** A thin term with everything sorted: two fundir ahead, both ready. */
export function quietGrid(): WindowGrid {
  const data = mockGrid(MOCK_SEASON_ID);
  const keep = new Set([6, 12, 15]);
  return {
    ...data,
    bands: [],
    cells: data.cells
      .filter((c) => keep.has(c.week_index))
      .map((c) => ({ ...c, status: "confirmed", decided_count: c.item_count })),
  };
}

/** The scratchpad: undated, so readiness has no "dagur" to ask for. */
export function undatedGrid(): WindowGrid {
  return withOpenWork(mockGrid(MOCK_SCRATCHPAD_ID), new Date());
}

/** Far enough ahead that the whole season is behind. */
export const AFTER_SEASON = new Date(2099, 0, 1);
