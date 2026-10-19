/**
 * Seasons for the timeline lab, all built on the real fixture (lib/mock/plan.mock.ts), which
 * is anchored to today: week 8 is the current week.
 *
 * Real terms are mostly one weekly flokksfundur at the same time, with exceptions around
 * it: a fös–sun útilega, a one-day dagsferð, a fundur moved to another evening. The base
 * fixture already has the weekly rhythm and the troop-wide events; these add the rest.
 */
import { MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import type { PlanCell, PlanGrid } from "@/services/plan.service";

/** `YYYY-MM-DDTHH:MM:00` for the given weekday (0 = Monday) of a week starting `monday`. */
function at(monday: string | null, weekday: number, clock: string): string | null {
  if (!monday) return null;
  const [y, m, d] = monday.split("-").map(Number);
  const day = new Date(y, m - 1, d + weekday);
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return `${iso}T${clock}:00`;
}

/**
 * The fixture, plus per flokkur: a Saturday dagsferð of its own, an extra afternoon fundur
 * in a week that already has one, and one weekly fundur moved to a Thursday.
 */
export function busyGrid(): PlanGrid {
  const data = mockGrid(MOCK_SEASON_ID);
  const monday = new Map(data.weeks.map((w) => [w.index, w.starts_on]));
  const extra: PlanCell[] = data.patrols.flatMap((patrol) =>
    [7, 11].flatMap((week) => {
      const base = data.cells.find((c) => c.patrol_id === patrol.id && c.week_index === week);
      if (!base) return [];
      const dayTrip = week === 11;
      return [
        {
          ...base,
          event_id: `${base.event_id}-extra`,
          title: dayTrip ? "Dagsferð flokksins í Heiðmörk" : "Aukafundur: kökubasar",
          type: dayTrip ? "dagsferd" : "flokks",
          status: dayTrip ? "unknown" : "confirmed",
          span_weeks: 1,
          planned_minutes: dayTrip ? 6 * 60 : 120,
          starts_at: at(monday.get(week) ?? null, 5, dayTrip ? "10:00" : "13:00"),
        } satisfies PlanCell,
      ];
    })
  );
  const moved = data.cells.map((c) =>
    c.week_index === 12 ? { ...c, starts_at: at(monday.get(12) ?? null, 3, "18:00") } : c
  );
  return { ...data, cells: [...moved, ...extra] };
}

/** A thin term: a handful of fundir with weeks of nothing between them. */
export function quietGrid(): PlanGrid {
  const data = mockGrid(MOCK_SEASON_ID);
  const keep = new Set([2, 6, 11, 15]);
  return {
    ...data,
    bands: data.bands.filter((b) => b.week_index === 9),
    cells: data.cells.filter((c) => keep.has(c.week_index)),
  };
}

/** Far enough ahead that the whole season is behind. */
export const AFTER_SEASON = new Date(2099, 0, 1);
