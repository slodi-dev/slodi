import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PlanCalendar from "../PlanCalendar";
import type { PlanGrid as PlanGridData } from "@/services/plan.service";

/**
 * The month view is the whole troop, not one flokkur, drawn as a stamp book
 * (D4 · Stimplar). Its load-bearing honesty is about dates: `starts_at` is optional, so an entry that has one is
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

/** The week rows: the children of the grid after its weekday heading. */
function weekRows(container: HTMLElement): Element[] {
  const grid = container.querySelector("[role='group']") as HTMLElement;
  return [...grid.children].slice(1);
}

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
    expect(entry.closest("[role='group']")).toBeNull();
    expect(screen.getByText(/Skráð á viku, ekki á dag/)).toBeInTheDocument();
    // And it still says which week it belongs to.
    expect(screen.getByText("Vika 2")).toBeInTheDocument();
  });

  it("places a dated entry on its own day", () => {
    const dated = { ...flokksfundur, starts_at: "2026-09-16T19:30:00" };
    render(<PlanCalendar data={grid({ cells: [dated] })} today={TODAY} />);

    // The 16th, not the Monday of its week.
    const entry = screen.getAllByRole("button", { name: /Refafundur, 16\. september/ })[0];
    expect(entry.closest("[role='group']")).not.toBeNull();
    expect(screen.queryByText(/Skráð á viku, ekki á dag/)).not.toBeInTheDocument();
  });

  it("shows the clock a dated entry carries, and names its venue", () => {
    const dated = {
      ...flokksfundur,
      starts_at: "2026-09-16T19:30:00",
      venue: "Skátaheimilið",
    };
    render(<PlanCalendar data={grid({ cells: [dated] })} today={TODAY} />);

    const entry = screen.getAllByRole("button", { name: /Refafundur/ })[0];
    expect(within(entry).getByText("19:30")).toBeInTheDocument();
    expect(entry).toHaveAccessibleName(/kl\. 19:30, Skátaheimilið, drög$/);
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
    const { container } = render(<PlanCalendar data={grid()} today={TODAY} />);

    const marked = container.querySelectorAll("[role='group'] span[aria-current='date']");
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toMatch(/^16\./);
  });

  it("draws the neighbouring days so a week is never cut in half", () => {
    // 1 September 2026 is a Tuesday, so the first row has to reach back into
    // August or Monday's column is empty and the week reads as starting late.
    const { container } = render(<PlanCalendar data={grid()} today={TODAY} />);

    const firstRow = weekRows(container)[0];
    expect(firstRow.querySelector("[class*='dayBg']")?.className).toMatch(/out/);
    expect(firstRow.querySelector("[class*='dayNumber']")?.textContent).toMatch(/^31\./);
  });

  it("says why an undated scratchpad has no calendar", () => {
    // Rather than drawing an empty grid, which reads as "nothing planned".
    const undated = WEEKS.map((w) => ({ ...w, starts_on: null }));
    render(<PlanCalendar data={grid({ weeks: undated })} today={TODAY} />);

    expect(screen.getByText(/engar dagsettar vikur/)).toBeInTheDocument();
  });

  it("never draws a half week", () => {
    // Trimming once stopped as soon as it passed day 35 and left the month,
    // which cut the final row mid-week: March 2026 rendered a last row of two
    // cells. Checked across a run of months, because whether it happens at all
    // depends on which weekday the 1st falls on.
    for (let month = 0; month < 30; month++) {
      const first = new Date(2026, month, 1);
      const weeks = [{ index: 1, starts_on: isoOf(first), label: "Vika 1" }];
      const { container, unmount } = render(<PlanCalendar data={grid({ weeks })} today={first} />);

      for (const row of weekRows(container)) {
        expect(row.querySelectorAll("[class*='dayBg']")).toHaveLength(7);
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

    expect(weekRows(container)).toHaveLength(4);
  });

  it("gives each flokkur the colour it has in the Rist", () => {
    // A flokkur keeps one colour across all three views, or the eye cannot
    // track it. Neither patrol has an accent, so both fall back to the Rist's
    // rotation by column, which has to differ.
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
    render(<PlanCalendar data={grid({ cells: dated })} today={TODAY} />);

    const colour = (name: RegExp) =>
      (screen.getAllByRole("button", { name })[0] as HTMLElement).style.getPropertyValue("--pc");
    expect(colour(/Refafundur/)).toMatch(/--sl-color-patrol-/);
    expect(colour(/Refafundur/)).not.toBe(colour(/Arnafundur/));
  });

  it("counts the month's entries in the singular", () => {
    const dated = [{ ...flokksfundur, starts_at: "2026-09-16T19:30:00" }];
    render(<PlanCalendar data={grid({ cells: dated })} today={TODAY} />);

    expect(screen.getByText(/^1 viðburður í mánuðinum/)).toBeInTheDocument();
  });

  it("draws a multi-day event as one strip, announced once", () => {
    // A fös–sun útilega is one thing; three buttons for it would read as three.
    const span = {
      ...utilega,
      starts_at: "2026-09-18T17:00:00",
      ends_at: "2026-09-20T14:00:00",
    };
    render(<PlanCalendar data={grid({ bands: [span] })} today={TODAY} />);

    const strips = screen.getAllByRole("button", {
      name: /^Útilega, fös 18\. sept\.–sun 20\. sept\./,
    });
    expect(strips).toHaveLength(1);
    expect(strips[0]).toHaveAccessibleName(/öll sveitin, staðfest$/);
  });

  it("keeps a fundur that falls out, crossed out with its reason", () => {
    // Deleting it would look the same as "not planned yet".
    const off = {
      ...flokksfundur,
      starts_at: "2026-09-16T19:30:00",
      cancelled: { reason: "vetrarfrí" },
    };
    const patrols = [{ id: "p1", name: "Refir", name_genitive: "Refa" }];
    render(<PlanCalendar data={grid({ patrols, cells: [off] })} today={TODAY} />);

    expect(
      screen.getAllByRole("button", {
        name: "Flokksfundur Refa fellur niður, 16. september: vetrarfrí",
      })
    ).not.toHaveLength(0);
    expect(screen.getAllByText("Refir fellur niður")).not.toHaveLength(0);
  });

  it("prints each flokkur's usual evening once, and keeps its usual fundir quiet", () => {
    // Three Wednesdays at 19:30 make a rhythm; the cells then drop the time.
    const weeks = [
      { index: 1, starts_on: "2026-09-07", label: "Vika 1" },
      { index: 2, starts_on: "2026-09-14", label: "Vika 2" },
      { index: 3, starts_on: "2026-09-21", label: "Vika 3" },
    ];
    const cells = ["09", "16", "23"].map((d, i) => ({
      ...flokksfundur,
      event_id: `r${i}`,
      week_index: i + 1,
      title: `Fundur ${d}`,
      starts_at: `2026-09-${d}T19:30:00`,
    }));
    render(<PlanCalendar data={grid({ weeks, cells })} today={TODAY} />);

    expect(screen.getByText("Fundir vikunnar")).toBeInTheDocument();
    expect(screen.getByText(/Refir mið 19:30/)).toBeInTheDocument();
    const routine = screen.getAllByRole("button", { name: /Fundur 16/ })[0];
    expect(within(routine).queryByText("19:30")).not.toBeInTheDocument();
  });

  it("says when a fundur was moved off its usual day", () => {
    const weeks = [
      { index: 1, starts_on: "2026-09-07", label: "Vika 1" },
      { index: 2, starts_on: "2026-09-14", label: "Vika 2" },
      { index: 3, starts_on: "2026-09-21", label: "Vika 3" },
      { index: 4, starts_on: "2026-09-28", label: "Vika 4" },
    ];
    const cells = [
      ...["09", "16", "23"].map((d, i) => ({
        ...flokksfundur,
        event_id: `r${i}`,
        week_index: i + 1,
        title: `Fundur ${d}`,
        starts_at: `2026-09-${d}T19:30:00`,
      })),
      // Week 4's fundur on the Thursday instead of the Wednesday.
      {
        ...flokksfundur,
        event_id: "moved",
        week_index: 4,
        title: "Færður fundur",
        starts_at: "2026-10-01T19:30:00",
      },
    ];
    render(
      <PlanCalendar data={grid({ weeks, cells })} today={TODAY} month={new Date(2026, 9, 1)} />
    );

    expect(
      screen.getAllByRole("button", { name: /Færður fundur.*fært frá 30\. september/ })
    ).not.toHaveLength(0);
  });
});

/** Local `YYYY-MM-DD` — `toISOString` would shift the date west of UTC. */
function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
