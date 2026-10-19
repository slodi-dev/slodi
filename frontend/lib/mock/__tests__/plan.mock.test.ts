import { describe, expect, it } from "vitest";
import { mockGrid, mockSeasons, MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID } from "../plan.mock";
import { isWeekDone } from "@/components/plan/planEntries";

/**
 * A fixture is only useful while it stays a *valid* instance of the contract.
 * A dangling patrol id or a week index nothing points at would render as an
 * empty column and read as a bug in the view rather than in the data — which is
 * the expensive kind of wrong, because it sends someone debugging the wrong
 * file. These tests pin the invariants the views assume.
 */

describe("plan fixtures", () => {
  it("labels every season as fake in its own name", () => {
    // The banner can be cropped out of a screenshot; the name cannot.
    for (const season of mockSeasons()) {
      expect(season.name).toContain("GERVIGÖGN");
    }
  });

  it("offers both a dated starfsár and an undated scratchpad", () => {
    const seasons = mockSeasons();
    const starfsar = seasons.find((s) => s.id === MOCK_SEASON_ID);
    const scratchpad = seasons.find((s) => s.id === MOCK_SCRATCHPAD_ID);

    expect(starfsar?.kind).toBe("starfsar");
    expect(starfsar?.starts_on).toBeTruthy();
    expect(scratchpad?.kind).toBe("scratchpad");
    expect(scratchpad?.starts_on).toBeNull();
  });

  it("points every cell and band at a week and patrol that exist", () => {
    const grid = mockGrid(MOCK_SEASON_ID);
    const weeks = new Set(grid.weeks.map((w) => w.index));
    const patrols = new Set(grid.patrols.map((p) => p.id));

    for (const cell of grid.cells) {
      expect(weeks.has(cell.week_index)).toBe(true);
      expect(patrols.has(cell.patrol_id)).toBe(true);
    }
    for (const band of grid.bands) {
      expect(weeks.has(band.week_index)).toBe(true);
    }
  });

  it("never puts two entries in one cell, spans included", () => {
    const grid = mockGrid(MOCK_SEASON_ID);
    const occupied = new Set<string>();

    for (const cell of grid.cells) {
      for (let offset = 0; offset < cell.span_weeks; offset++) {
        const key = `${cell.week_index + offset}:${cell.patrol_id}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      }
    }
  });

  it("keeps troop-wide weeks clear of flokksfundir", () => {
    const grid = mockGrid(MOCK_SEASON_ID);
    const bandWeeks = new Set(grid.bands.map((b) => b.week_index));

    for (const cell of grid.cells) {
      for (let offset = 0; offset < cell.span_weeks; offset++) {
        expect(bandWeeks.has(cell.week_index + offset)).toBe(false);
      }
    }
  });

  it("straddles today, so the rolling window has both halves to show", () => {
    // A7 is "done behind, skeleton ahead". A fixture entirely in the past or
    // entirely in the future demonstrates half of it and looks correct doing so.
    const grid = mockGrid(MOCK_SEASON_ID);
    const now = new Date();
    const done = grid.weeks.filter((w) => isWeekDone(w, now));

    expect(done.length).toBeGreaterThan(0);
    expect(done.length).toBeLessThan(grid.weeks.length);
  });

  it("includes an unknown status and a multi-week span", () => {
    // The "?" of A8 and the spanning element of ADR-002 §3 are the two cases
    // most easily broken by a layout change, so the fixture must contain them.
    const grid = mockGrid(MOCK_SEASON_ID);

    expect(grid.cells.some((c) => c.status === "unknown")).toBe(true);
    expect(grid.cells.some((c) => c.span_weeks > 1)).toBe(true);
  });

  it("leaves the scratchpad grid undated", () => {
    const grid = mockGrid(MOCK_SCRATCHPAD_ID);
    expect(grid.weeks.every((w) => w.starts_on === null)).toBe(true);
  });
});
