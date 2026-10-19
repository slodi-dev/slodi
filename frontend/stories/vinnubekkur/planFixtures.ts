/**
 * Variations on the grid fixture (lib/mock/plan.mock.ts) for the Vinnubekkur
 * stories: long Icelandic text, entries with only a week, and a plan whose
 * patrols have nothing on them.
 */
import { MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import type { PlanGrid } from "@/services/plan.service";

const LONG_TITLE = "Undirbúningsfundur flokksforingjaráðs vegna landsmótsþátttöku sumarsins";

/** Long titles, a long flokkur name and a long ATH note. */
export function longTextGrid(): PlanGrid {
  const data = mockGrid(MOCK_SEASON_ID);
  return {
    ...data,
    patrols: data.patrols.map((p, i) =>
      i === 0 ? { ...p, name: "Hraunbæjarrefirnir í Árbæjarhverfi" } : p
    ),
    weeks: data.weeks.map((w) =>
      w.index === 3
        ? { ...w, note: "Öskudagur — flest börn í búningum og foreldrafélagið með kaffisölu" }
        : w
    ),
    bands: data.bands.map((b, i) => (i === 0 ? { ...b, title: LONG_TITLE } : b)),
    cells: data.cells.map((c, i) =>
      i % 7 === 0 ? { ...c, title: "Skyndihjálparþjálfun með endurlífgunarbrúðum" } : c
    ),
  };
}

/**
 * Some entries known only by their week, as the contract allows: the calendar
 * lists them under "Skráð á viku, ekki á dag" rather than inventing a day.
 */
export function partlyDatedGrid(): PlanGrid {
  const data = mockGrid(MOCK_SEASON_ID);
  return {
    ...data,
    bands: data.bands.map((b, i) => (i % 2 === 0 ? { ...b, starts_at: null } : b)),
    cells: data.cells.map((c, i) => (i % 5 === 0 ? { ...c, starts_at: null } : c)),
  };
}

/** Flokkar exist, but nothing is planned for them yet. */
export function nothingPlannedGrid(): PlanGrid {
  return { ...mockGrid(MOCK_SEASON_ID), bands: [], cells: [] };
}
