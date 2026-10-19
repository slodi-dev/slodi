import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PlanTimeline from "../PlanTimeline";
import type { PlanCell, PlanGrid as PlanGridData } from "@/services/plan.service";

/**
 * The timeline is the whole season for one flokkur, where the window (A7) is
 * the next few. What matters is that it groups by month for orientation,
 * survives an undated scratchpad, and agrees with the window about what counts
 * as a meeting — they share `entriesForPatrol` precisely so they cannot drift.
 */

const TODAY = new Date("2026-09-20T12:00:00Z");

const WEEKS = [
  { index: 1, starts_on: "2026-09-07", label: "Vika 1" },
  { index: 2, starts_on: "2026-09-14", label: "Vika 2" },
  { index: 3, starts_on: "2026-10-05", label: "Vika 3" },
];

function cell(weekIndex: number, overrides: Partial<PlanCell> = {}): PlanCell {
  return {
    event_id: `e${weekIndex}`,
    week_index: weekIndex,
    patrol_id: "p1",
    title: `Fundur ${weekIndex}`,
    status: "draft",
    type: "flokks",
    span_weeks: 1,
    ...overrides,
  };
}

function grid(overrides: Partial<PlanGridData> = {}): PlanGridData {
  return {
    season_id: "s1",
    patrols: [{ id: "p1", name: "Refir" }],
    weeks: WEEKS,
    bands: [],
    cells: WEEKS.map((w) => cell(w.index)),
    ...overrides,
  };
}

describe("PlanTimeline", () => {
  it("groups the season by month so a term is readable", () => {
    render(<PlanTimeline data={grid()} today={TODAY} />);

    // Icelandic month names come from Intl, not a date library.
    expect(screen.getByRole("heading", { name: /september 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /október 2026/i })).toBeInTheDocument();
  });

  it("shows the whole season, not just the next few", () => {
    // This is the difference from the rolling window.
    render(<PlanTimeline data={grid()} today={TODAY} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("marks what is already behind", () => {
    render(<PlanTimeline data={grid()} today={TODAY} />);

    const items = screen.getAllByRole("listitem");
    // Week 1 (7–14 Sept) is over by 20 Sept; week 2 contains it.
    expect(items[0].className).toMatch(/done/);
    expect(items[1].className).toMatch(/ahead/);
  });

  it("includes troop-wide fundir the flokkur attends", () => {
    render(
      <PlanTimeline
        data={grid({
          cells: [],
          bands: [
            {
              event_id: "b1",
              week_index: 3,
              title: "Útilega",
              status: "confirmed",
              type: "utilega",
              span_weeks: 1,
            },
          ],
        })}
        today={TODAY}
      />
    );

    expect(screen.getByText("Útilega")).toBeInTheDocument();
    expect(screen.getByText("Öll sveitin")).toBeInTheDocument();
  });

  it("does not invent month headings for an undated scratchpad", () => {
    // A scratchpad has no dates, so there are no months to group by. Falling
    // back to the week label keeps it honest rather than guessing a calendar.
    const undated = WEEKS.map((w) => ({ ...w, starts_on: null }));
    render(<PlanTimeline data={grid({ weeks: undated })} today={TODAY} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Vika 1")).toBeInTheDocument();
  });

  it("says so when the flokkur has nothing planned", () => {
    render(<PlanTimeline data={grid({ cells: [] })} today={TODAY} />);

    expect(screen.getByText(/Ekkert skráð á þennan flokk/)).toBeInTheDocument();
  });
});
