import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PlanWindow from "../PlanWindow";
import type { PlanCell, PlanGrid as PlanGridData } from "@/services/plan.service";

/**
 * The window's job is the small horizon a flokksforingi actually works in:
 * a little done behind, the next few ahead. The cases that matter are where
 * "now" falls, and the undated scratchpad where there is no "now" at all.
 */

const TODAY = new Date("2026-09-20T12:00:00Z");

/**
 * Real Mondays. An earlier version built these by string arithmetic and
 * produced "2026-09-35" for week 5 — an Invalid Date, whose comparisons are
 * all false, so the later weeks counted as "ahead" by accident rather than by
 * date and several assertions here proved nothing.
 */
const WEEK_STARTS = [
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
  "2026-10-05",
  "2026-10-12",
  "2026-10-19",
];

const WEEKS = WEEK_STARTS.map((starts_on, i) => ({
  index: i + 1,
  starts_on,
  label: `Vika ${i + 1}`,
}));

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
    patrols: [
      { id: "p1", name: "Refir" },
      { id: "p2", name: "Ernir" },
    ],
    weeks: WEEKS,
    bands: [],
    cells: WEEKS.map((w) => cell(w.index)),
    ...overrides,
  };
}

function titles() {
  return screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
}

describe("PlanWindow", () => {
  it("shows the next few meetings with one done behind for context", () => {
    render(<PlanWindow data={grid()} today={TODAY} ahead={4} />);

    const shown = titles();
    // Week 1 (7–14 Sept) is over. Week 2 contains TODAY, so it is still ahead.
    expect(shown).toHaveLength(5);
    expect(shown[0]).toContain("Vika 1");
    expect(shown[0]).toContain("Búið");
    expect(shown[1]).toContain("Vika 2");
    expect(shown[4]).toContain("Vika 5");
  });

  it("does not mark the current week done before it is over", () => {
    // starts_on is the Monday but the fundur is usually midweek. Comparing
    // against the start would grey out on Monday morning the very meeting the
    // leader opened the planner to prepare for.
    const monday = new Date("2026-09-14T09:00:00Z"); // week 2 starts 14 Sept
    render(<PlanWindow data={grid({ cells: [cell(2)] })} today={monday} />);

    const [entry] = titles();
    expect(entry).toContain("Vika 2");
    expect(entry).not.toContain("Búið");
  });

  it("keeps the chosen flokkur only while it exists in the season", () => {
    // The shell swaps `data` when the season changes without remounting, so a
    // patrol id from the previous season would match nothing and blank the view.
    const { rerender } = render(<PlanWindow data={grid()} today={TODAY} />);
    expect(screen.getByRole("combobox")).toHaveValue("p1");

    const otherSeason = grid({
      patrols: [{ id: "p9", name: "Úlfar" }],
      cells: [cell(3, { patrol_id: "p9", title: "Úlfafundur" })],
    });
    rerender(<PlanWindow data={otherSeason} today={TODAY} />);

    expect(screen.getByRole("combobox")).toHaveValue("p9");
    expect(titles().join(" ")).toContain("Úlfafundur");
  });

  it("does not run past the end of the season", () => {
    render(<PlanWindow data={grid({ cells: [cell(6), cell(7)] })} today={TODAY} ahead={4} />);

    expect(titles()).toHaveLength(2);
  });

  it("treats an undated scratchpad as all ahead, never done", () => {
    // There is no date to be past. Marking these done would make a scratchpad
    // look like a finished term.
    const undated = WEEKS.map((w) => ({ ...w, starts_on: null }));
    render(<PlanWindow data={grid({ weeks: undated })} today={TODAY} ahead={4} />);

    const shown = titles();
    expect(shown[0]).toContain("Vika 1");
    expect(shown.join(" ")).not.toContain("Búið");
  });

  it("only shows the chosen flokkur's meetings", () => {
    render(
      <PlanWindow
        data={grid({ cells: [cell(3), cell(4, { patrol_id: "p2", title: "Arnarfundur" })] })}
        today={TODAY}
      />
    );

    expect(titles().join(" ")).not.toContain("Arnarfundur");
  });

  it("carries the '?' marker through from the plan", () => {
    render(<PlanWindow data={grid({ cells: [cell(3, { status: "unknown" })] })} today={TODAY} />);

    expect(screen.getByLabelText("Óákveðið")).toBeInTheDocument();
  });

  it("includes troop-wide fundir, which every flokkur attends", () => {
    // A sveitarfundur or útilega is a meeting this flokkur is on by definition.
    // Leaving them out made the view a flokksforingi opens to see what is
    // coming omit half of what is coming.
    render(
      <PlanWindow
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

    const shown = titles().join(" ");
    expect(shown).toContain("Útilega");
    expect(shown).toContain("Öll sveitin");
  });

  it("survives a datetime where the contract asks for a date", () => {
    // A NaN day made the guard return false for every week, so a whole term
    // silently read as never-done with no visible failure.
    const withTime = WEEKS.map((w) => ({ ...w, starts_on: `${w.starts_on}T00:00:00Z` }));
    render(<PlanWindow data={grid({ weeks: withTime })} today={TODAY} ahead={4} />);

    expect(titles()[0]).toContain("Búið");
  });

  it("says so when the flokkur has nothing ahead", () => {
    render(<PlanWindow data={grid({ cells: [] })} today={TODAY} />);

    expect(screen.getByText(/Engir fundir framundan/)).toBeInTheDocument();
  });
});
