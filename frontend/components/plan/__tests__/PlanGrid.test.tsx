import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PlanGrid from "../PlanGrid";
import type { PlanGrid as PlanGridData, PlanCell, PlanBand } from "@/services/plan.service";

/**
 * The grid's job is that a leader can read a whole term at a glance, so the
 * things worth pinning are structural: every week is a row, every flokkur a
 * column, a troop-wide event takes the row, and a spanning element does not
 * push the row out of shape.
 */

const PATROLS = [
  { id: "p1", name: "Refir" },
  { id: "p2", name: "Ernir" },
];

const WEEKS = [
  { index: 1, starts_on: "2026-09-07", label: "Vika 1" },
  { index: 2, starts_on: "2026-09-14", label: "Vika 2" },
  { index: 3, starts_on: "2026-09-21", label: "Vika 3" },
];

function cell(overrides: Partial<PlanCell> = {}): PlanCell {
  return {
    event_id: "e1",
    week_index: 1,
    patrol_id: "p1",
    title: "Fundur",
    status: "confirmed",
    type: "flokks",
    span_weeks: 1,
    ...overrides,
  };
}

function band(overrides: Partial<PlanBand> = {}): PlanBand {
  return {
    event_id: "b1",
    week_index: 2,
    title: "Útilega",
    status: "confirmed",
    type: "utilega",
    span_weeks: 1,
    ...overrides,
  };
}

function grid(overrides: Partial<PlanGridData> = {}): PlanGridData {
  return {
    season_id: "s1",
    patrols: PATROLS,
    weeks: WEEKS,
    bands: [],
    cells: [],
    ...overrides,
  };
}

/** How many trailing columns are utilities (ATH, Innkaup) rather than flokkar. */
const UTIL_COLUMNS = 2;

/**
 * The flokkur cells of a row — no week header, and no ATH/Innkaup columns.
 *
 * The utility columns are per-week and always present, so counting them would
 * make every assertion below about the *layout* of events also depend on how
 * many utility columns the design happens to have. Dropping them keeps each
 * test measuring the one thing it names.
 */
function bodyCells(rowName: string) {
  const row = screen.getByRole("row", { name: new RegExp(rowName) });
  const cells = within(row).queryAllByRole("cell");
  return cells.slice(0, Math.max(0, cells.length - UTIL_COLUMNS));
}

describe("PlanGrid", () => {
  it("renders a column per flokkur and a row per week", () => {
    render(<PlanGrid data={grid()} />);

    for (const patrol of PATROLS) {
      expect(screen.getByRole("columnheader", { name: patrol.name })).toBeInTheDocument();
    }
    for (const week of WEEKS) {
      // The header also carries the week's date, so match the label rather than
      // the whole accessible name.
      expect(
        screen.getByRole("rowheader", { name: new RegExp(`^${week.label}\\b`) })
      ).toBeInTheDocument();
    }
  });

  it("puts a per-flokkur event in its own patrol's column only", () => {
    render(<PlanGrid data={grid({ cells: [cell({ title: "Refafundur", patrol_id: "p2" })] })} />);

    const cells = bodyCells("Vika 1");
    expect(cells).toHaveLength(2);
    expect(within(cells[1]).getByRole("button", { name: /Refafundur/ })).toBeInTheDocument();
    expect(within(cells[0]).queryByRole("button")).toBeNull();
  });

  it("spans a troop-wide event across every flokkur", () => {
    // This is what stops parallel flokksfundir being drawn during a útilega.
    render(<PlanGrid data={grid({ bands: [band()] })} />);

    const cells = bodyCells("Vika 2");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveAttribute("colspan", String(PATROLS.length));
    expect(within(cells[0]).getByRole("button", { name: /Útilega/ })).toBeInTheDocument();
  });

  it("does not draw a second cell under a multi-week element", () => {
    // A rowSpan plus the cell beneath it would give that row an extra column
    // and shear the whole grid sideways.
    render(<PlanGrid data={grid({ cells: [cell({ title: "Merki 1/2", span_weeks: 2 })] })} />);

    const first = bodyCells("Vika 1");
    expect(first).toHaveLength(2);
    expect(first[0]).toHaveAttribute("rowspan", "2");

    // Week 2 only has the other patrol's cell — the spanned column is taken.
    expect(bodyCells("Vika 2")).toHaveLength(1);
  });

  it("continues a multi-week band down instead of leaving a hole", () => {
    render(<PlanGrid data={grid({ bands: [band({ week_index: 1, span_weeks: 2 })] })} />);

    // Without a rowSpan the band draws its title in week 1 and leaves week 2 a
    // row with no body cells at all — ragged, not a band. The covered row
    // legitimately owns no cell of its own; the span is what fills it.
    const [bandCell] = bodyCells("Vika 1");
    expect(bandCell).toHaveAttribute("rowspan", "2");
    expect(screen.getByRole("rowheader", { name: /^Vika 2\b/ })).toBeInTheDocument();
    expect(bodyCells("Vika 2")).toHaveLength(0);
  });

  it("clips a cell's span where a band begins", () => {
    // A troop-wide event means every flokkur is on it, so a per-flokkur cell
    // cannot run into one. Clipping keeps the band full width; the alternative
    // — squeezing the band into whatever columns are left — cannot be expressed
    // as one table cell unless those columns happen to be contiguous.
    render(
      <PlanGrid
        data={grid({
          cells: [cell({ week_index: 1, patrol_id: "p1", span_weeks: 2 })],
          bands: [band({ week_index: 2 })],
        })}
      />
    );

    const [clipped] = bodyCells("Vika 1");
    expect(clipped).not.toHaveAttribute("rowspan");

    const [bandCell] = bodyCells("Vika 2");
    expect(bandCell).toHaveAttribute("colspan", String(PATROLS.length));
  });

  it("reports cells that fall inside a band's weeks instead of dropping them", () => {
    // Silently omitting an event from the one view a leader uses to check a
    // week is worse than showing it awkwardly.
    render(
      <PlanGrid
        data={grid({
          bands: [band({ week_index: 2, span_weeks: 2 })],
          cells: [cell({ week_index: 3, title: "Falinn fundur" })],
        })}
      />
    );

    expect(screen.getByText(/1 flokkafundur á sama tíma/)).toBeInTheDocument();
  });

  it("marks an undecided element with the '?' rather than leaving it blank", () => {
    // ADR-002 §3: setting the skeleton early must not make the plan look broken.
    render(<PlanGrid data={grid({ cells: [cell({ status: "unknown" })] })} />);

    expect(screen.getByLabelText("Óákveðið")).toBeInTheDocument();
  });

  it("reports which event was picked", () => {
    const onSelectEvent = vi.fn();
    render(
      <PlanGrid
        data={grid({ cells: [cell({ event_id: "chosen" })] })}
        onSelectEvent={onSelectEvent}
      />
    );

    screen.getByRole("button", { name: /Fundur/ }).click();
    expect(onSelectEvent).toHaveBeenCalledWith("chosen");
  });

  it("clips overlapping bands instead of shearing the table", () => {
    // Two troop-wide events overlapping is bad data, but the grid must not turn
    // bad data into a table with more columns in one row than it has.
    render(
      <PlanGrid
        data={grid({
          bands: [band({ week_index: 1, span_weeks: 3 }), band({ event_id: "b2", week_index: 2 })],
        })}
      />
    );

    const [first] = bodyCells("Vika 1");
    expect(first).toHaveAttribute("rowspan", "1"); // clipped at the next band
    expect(bodyCells("Vika 2")).toHaveLength(1);
  });

  it("does not let a span run off the end of the season", () => {
    // A rowSpan longer than the table has rows stretches the last row instead.
    render(<PlanGrid data={grid({ cells: [cell({ week_index: 3, span_weeks: 5 })] })} />);

    const [last] = bodyCells("Vika 3");
    expect(last).not.toHaveAttribute("rowspan"); // only one week left
  });

  it("reports a cell hidden underneath another cell's span", () => {
    // Same reasoning as the band case: an omitted event is worse than an
    // awkward one, because the leader has no way to know it exists.
    render(
      <PlanGrid
        data={grid({
          cells: [
            cell({ week_index: 1, patrol_id: "p1", span_weeks: 3 }),
            cell({ event_id: "e2", week_index: 2, patrol_id: "p1", title: "Falinn" }),
          ],
        })}
      />
    );

    // The first is clipped so the second can render in its own right.
    expect(screen.getByRole("button", { name: /Falinn/ })).toBeInTheDocument();
  });

  it("says so when there is nothing to lay out yet", () => {
    render(<PlanGrid data={grid({ patrols: [], weeks: [] })} />);
    expect(screen.getByText(/hvorki flokka né vikur/)).toBeInTheDocument();
  });
});
