import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PlanCalendar from "../PlanCalendar";
import type { PlanGrid as PlanGridData } from "@/services/plan.service";

/**
 * The month view is the whole troop, not one flokkur, and its load-bearing
 * honesty is about dates: `starts_at` is optional, so an entry that has one is
 * drawn on that day and an entry that does not is listed against its *week*.
 * Pinning an undated entry to a day would invent information the planner does
 * not have, which is the thing these tests exist to stop.
 */

const TODAY = new Date("2026-09-16T12:00:00Z"); // a Wednesday in week 2

const WEEKS = [
  { index: 1, starts_on: "2026-09-07", label: "Vika 1" },
  { index: 2, starts_on: "2026-09-14", label: "Vika 2" },
  { index: 3, starts_on: "2026-10-05", label: "Vika 3" },
];

function grid(overrides: Partial<PlanGridData> = {}): PlanGridData {
  return {
    season_id: "s1",
    patrols: [
      { id: "p1", name: "Refir" },
      { id: "p2", name: "Ernir" },
    ],
    weeks: WEEKS,
    bands: [],
    cells: [],
    ...overrides,
  };
}

const flokksfundur = {
  event_id: "e1",
  week_index: 2,
  patrol_id: "p1",
  title: "Refafundur",
  status: "draft" as const,
  type: "flokks" as const,
  span_weeks: 1,
};

const utilega = {
  event_id: "b1",
  week_index: 2,
  title: "Útilega",
  status: "confirmed" as const,
  type: "utilega" as const,
  span_weeks: 1,
};

describe("PlanCalendar", () => {
  it("opens on the month containing today", () => {
    render(<PlanCalendar data={grid()} today={TODAY} />);

    expect(screen.getByRole("heading", { name: /september 2026/i })).toBeInTheDocument();
  });

  it("shows every flokkur's meetings, not one patrol's", () => {
    // This is the whole-troop artifact A5 is built around.
    render(<PlanCalendar data={grid({ cells: [flokksfundur], bands: [utilega] })} today={TODAY} />);

    expect(screen.getByText("Refafundur")).toBeInTheDocument();
    expect(screen.getByText("Útilega")).toBeInTheDocument();
  });

  it("keeps an undated entry out of the day grid entirely", () => {
    // Rendering one into a weekday cell would tell a leader a day the planner
    // does not know.
    render(<PlanCalendar data={grid({ cells: [flokksfundur] })} today={TODAY} />);

    const entry = screen.getByText("Refafundur");
    expect(entry.closest("td")).toBeNull();
    expect(screen.getByText(/Skráð á viku, ekki á dag/)).toBeInTheDocument();
    // And it still says which week it belongs to.
    expect(screen.getByText("Vika 2")).toBeInTheDocument();
  });

  it("places a dated entry on its own day", () => {
    const dated = { ...flokksfundur, starts_at: "2026-09-16T19:30:00" };
    render(<PlanCalendar data={grid({ cells: [dated] })} today={TODAY} />);

    const cell = screen.getByText("Refafundur").closest("td") as HTMLElement;
    expect(cell).not.toBeNull();
    // The 16th, not the Monday of its week.
    expect(within(cell).getByText("16")).toBeInTheDocument();
    expect(screen.queryByText(/Skráð á viku, ekki á dag/)).not.toBeInTheDocument();
  });

  it("shows the clock and venue a dated entry carries", () => {
    const dated = {
      ...flokksfundur,
      starts_at: "2026-09-16T19:30:00",
      venue: "Skátaheimilið",
    };
    render(<PlanCalendar data={grid({ cells: [dated] })} today={TODAY} />);

    const cell = screen.getByText("Refafundur").closest("td") as HTMLElement;
    expect(within(cell).getByText("19:30")).toBeInTheDocument();
    expect(within(cell).getByText("Skátaheimilið")).toBeInTheDocument();
  });

  it("moves between the months the season actually covers", () => {
    render(<PlanCalendar data={grid()} today={TODAY} />);

    fireEvent.click(screen.getByRole("button", { name: /Næsti/ }));
    expect(screen.getByRole("heading", { name: /október 2026/i })).toBeInTheDocument();

    // September is the first month, so there is nothing before it.
    fireEvent.click(screen.getByRole("button", { name: /Fyrri/ }));
    expect(screen.getByRole("button", { name: /Fyrri/ })).toBeDisabled();
  });

  it("marks today, and only today", () => {
    // Asserted on the cell rather than by row index: the grid starts on the
    // Monday on or before the 1st, so which row today lands in depends on the
    // month, and a positional index would pass or fail for the wrong reason.
    const { container } = render(<PlanCalendar data={grid()} today={TODAY} />);

    const marked = container.querySelectorAll("td[class*='today']");
    expect(marked).toHaveLength(1);
    expect(within(marked[0] as HTMLElement).getByText("16")).toBeInTheDocument();
  });

  it("draws the neighbouring days so a week is never cut in half", () => {
    // 1 September 2026 is a Tuesday, so the first row has to reach back into
    // August or Monday's column is empty and the week reads as starting late.
    const { container } = render(<PlanCalendar data={grid()} today={TODAY} />);

    const firstRow = container.querySelectorAll("tbody tr")[0];
    const firstCell = firstRow.querySelector("td") as HTMLElement;
    expect(firstCell.className).toMatch(/out/);
    expect(within(firstCell).getByText("31")).toBeInTheDocument();
  });

  it("says why an undated scratchpad has no calendar", () => {
    // Rather than drawing an empty grid, which reads as "nothing planned".
    const undated = WEEKS.map((w) => ({ ...w, starts_on: null }));
    render(<PlanCalendar data={grid({ weeks: undated })} today={TODAY} />);

    expect(screen.getByText(/engar dagsettar vikur/)).toBeInTheDocument();
  });

  it("never draws a half week", () => {
    // Trimming stopped as soon as it passed day 35 and left the month, which
    // cut the final row mid-week: March 2026 rendered a last row of two cells.
    // Checked across a run of months rather than one, because whether it
    // happens at all depends on which weekday the 1st falls on.
    for (let month = 0; month < 30; month++) {
      const first = new Date(2026, month, 1);
      const weeks = [{ index: 1, starts_on: isoOf(first), label: "Vika 1" }];
      const { container, unmount } = render(<PlanCalendar data={grid({ weeks })} today={first} />);

      for (const row of container.querySelectorAll("tbody tr")) {
        expect(row.querySelectorAll("td")).toHaveLength(7);
      }
      unmount();
    }
  });

  it("does not draw a sixth row that belongs entirely to the next month", () => {
    // February 2027 starts on a Monday and has 28 days: exactly four rows.
    const feb = new Date(2027, 1, 1);
    const { container } = render(
      <PlanCalendar
        data={grid({ weeks: [{ index: 1, starts_on: "2027-02-01", label: "Vika 1" }] })}
        today={feb}
      />
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("gives each flokkur the colour it has in the Rist", () => {
    // A flokkur keeps one colour across all three views, or the eye cannot
    // track it. The chip has the props; the calendar used to leave them empty,
    // so every patrol came out the same.
    const dated = [
      { ...flokksfundur, starts_at: "2026-09-16T19:30:00" },
      {
        ...flokksfundur,
        event_id: "e2",
        patrol_id: "p2",
        title: "Arnafundur",
        starts_at: "2026-09-17T19:30:00",
      },
    ];
    const { container } = render(<PlanCalendar data={grid({ cells: dated })} today={TODAY} />);

    const accents = [...container.querySelectorAll("td [style*='--ev']")].map((node) =>
      (node as HTMLElement).style.getPropertyValue("--ev")
    );
    expect(accents).toHaveLength(2);
    expect(accents[0]).not.toBe(accents[1]);
  });

  it("counts a single out-of-month fundur in the singular", () => {
    const dated = [{ ...flokksfundur, starts_at: "2026-10-07T19:30:00" }];
    render(<PlanCalendar data={grid({ cells: dated })} today={TODAY} />);

    expect(screen.getByText(/1 fundur í öðrum mánuðum/)).toBeInTheDocument();
  });
});

/** Local `YYYY-MM-DD` — `toISOString` would shift the date west of UTC. */
function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
