import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { formatIcelandicMonthYear } from "@/lib/format";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import {
  BUSY_MONTH,
  CALENDAR_TODAY,
  QUIET_MONTH,
  calendarGrid,
} from "@/stories/vinnubekkur/calendarFixtures";
import { longTextGrid, partlyDatedGrid } from "@/stories/vinnubekkur/planFixtures";
import { coversDay, placeEntries, type CalendarEntry } from "./calendar/calendarEntries";
import { STAMP_MEANING, STAMP_STATES, Stamp } from "./calendar/Stamp";
import { StampKey, sampleEntry } from "./calendar/StampEntry";
import PlanCalendar, { DayCell } from "./PlanCalendar";

/**
 * The Dagatal as a stamp book (D4 · Stimplar, picked in the Lab on 2026-10-20). A ready fundur
 * is stamped in ink with its theme's picture, a draft is ruled in dashes and pencilled, an
 * unsure one is a dotted sketch with "?", an undecided one an empty dotted box. The past fades
 * to a small grey "LOKIÐ"; a fundur that falls out is crossed out.
 *
 * The month is a **rhythm plus exceptions**: the usual weekly fundur is one quiet line (its time
 * is in "Fundir vikunnar"), anything that breaks the rhythm is a full block with its reason, and
 * a multi-day event is one perforated strip across its days. Rationale: the **Rationale** page.
 */
const meta = {
  title: "Components/Vinnubekkur/PlanCalendar",
  component: PlanCalendar,
  args: { data: mockGrid(MOCK_SEASON_ID), onSelect: fn() },
  argTypes: {
    data: { control: false },
    month: { control: false },
    today: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Dagatal: the same dataset as the Rist, by month, drawn as a stamp book. An entry " +
          "with a date is drawn on its day; one with only a week is listed under the month " +
          "instead of on an invented day. Rationale: the Rationale page. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { value: "desktop", isRotated: false } };
const PHONE = { viewport: { value: "phone", isRotated: false } };

/** The app's fixture season. Opens on this month, with the month name in Icelandic. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { level: 2 });
    await expect(heading).toHaveTextContent(formatIcelandicMonthYear(new Date()));
    await expect(heading.textContent).toMatch(/^[a-záðéíóúýþæö]+ \d{4}$/);
  },
};

/** Paging forward changes the month, still in Icelandic. */
export const NextMonth: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Næsti mánuður" }));
    const now = new Date();
    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatIcelandicMonthYear(new Date(now.getFullYear(), now.getMonth() + 1, 1))
    );
    await expect(canvas.getByText(/^\d+ viðburð(ur|ir) í mánuðinum/)).toBeInTheDocument();
  },
};

/**
 * October 2026: the routine fundur, the moved one, the one that falls out, the strip that
 * crosses a week row (one button, not two), and the fold on mið 28.
 */
export const BusyMonth: Story = {
  name: "Busy month",
  args: { data: calendarGrid(), today: CALENDAR_TODAY, month: BUSY_MONTH },
  globals: DESKTOP,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: /^Flokksfundur Arna: .+, 20\. október kl\. 19:30, Skátaheimilið, staðfest, 15 mínútur umfram$/,
      })
    );
    await expect(args.onSelect).toHaveBeenCalled();
    await expect(
      canvas.getByRole("button", {
        name: /^Flokksfundur Uglna: .+, 15\. október kl\. 19:30, .*fært frá 14\. október, lokið$/,
      })
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "Flokksfundur Bjarna fellur niður, 22. október: vetrarfrí",
      })
    ).toBeVisible();
    await expect(
      canvas.getAllByRole("button", {
        name: /^Vetrarmót skátafélaganna, lau 24\. okt\.–mán 26\. okt\./,
      })
    ).toHaveLength(1);
    await expect(
      canvas.getByRole("button", {
        name: "Haustútilega á Úlfljótsvatni, fös 30. okt.–sun 1. nóv., öll sveitin, Úlfljótsvatn, drög",
      })
    ).toBeVisible();

    const more = canvas.getByRole("button", { name: "+2 fleiri 28. október" });
    await userEvent.click(more);
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", {
        name: /^Skipulagsfundur, öll sveitin: .+, 28\. október kl\. 21:00/,
      })
    ).toBeVisible();
  },
};

/** December: two weeks of fundir, litlu jól, then jólafrí as week notes. */
export const QuietMonth: Story = {
  name: "Quiet month",
  args: { data: calendarGrid(), today: CALENDAR_TODAY, month: QUIET_MONTH },
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^\d+ viðburð(ur|ir) í mánuðinum/)).toBeVisible();
    await expect(canvas.getAllByText("Jólafrí: engir fundir fram yfir áramót")[0]).toBeVisible();
  },
};

/** Phone: the útilega's Saturday lists it with a full-size stamp as "Dagur 2 af 3". */
export const Phone: Story = {
  args: { data: calendarGrid(), today: CALENDAR_TODAY, month: BUSY_MONTH },
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = canvas.getByRole("button", { name: "31. október, 1 viðburður" });
    await userEvent.click(day);
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("heading", { name: "Laugardagur 31. október" })).toBeVisible();
    await expect(canvas.getByText(/^Dagur 2 af 3 · Öll sveitin/)).toBeVisible();
  },
};

export const Dark: Story = {
  args: { data: calendarGrid(), today: CALENDAR_TODAY, month: BUSY_MONTH },
  globals: { theme: "dark", ...DESKTOP },
};

/** Entries known only by their week are listed, not placed on a guessed day. */
export const PartlyDated: Story = {
  args: { data: partlyDatedGrid() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Skráð á viku, ekki á dag")).toBeVisible();
  },
};

/** The scratchpad has no dates at all, so there is no calendar to draw. */
export const Undated: Story = {
  args: { data: mockGrid(MOCK_SCRATCHPAD_ID) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/engar dagsettar vikur/)).toBeVisible();
  },
};

export const LongIcelandicText: Story = { args: { data: longTextGrid() } };

/* ── One day, close up ── */

const day = (d: number) => new Date(2026, 9, d);

/** A stress case the rhythm never makes: mið 28. with a fifth entry squeezed in. */
function fiveOn28(entries: CalendarEntry[]): CalendarEntry[] {
  const on28 = entries.filter((e) => coversDay(e, day(28)));
  const extra = entries.find((e) => e.kind === "routine" && coversDay(e, day(27)));
  return extra
    ? [...on28, { ...extra, id: `${extra.id}-copy`, day: day(28), endDay: day(28) }]
    : on28;
}

const onDay = (d: Date) => (all: CalendarEntry[]) => all.filter((e) => coversDay(e, d));

const CLOSE_DAYS: { label: string; date: Date; pick: (all: CalendarEntry[]) => CalendarEntry[] }[] =
  [
    { label: "1 routine fundur", date: day(21), pick: onDay(day(21)) },
    { label: "2: routine + troop (today)", date: day(19), pick: onDay(day(19)) },
    { label: "Past: moved fundur", date: day(15), pick: onDay(day(15)) },
    { label: "Falls out + strip", date: day(26), pick: onDay(day(26)) },
    { label: "5 entries", date: day(28), pick: fiveOn28 },
  ];

const closeGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, max-content))",
  gap: "var(--sl-spacing-md)",
  alignItems: "start",
};
const cellLabel: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-xs)",
  color: "hsl(var(--sl-color-text-secondary))",
};

/** Single cells at desktop width: 1, 2 and 5 entries, a past day, a cancellation and a strip. */
export const OneDayCloseUp: Story = {
  name: "One day, close up",
  globals: DESKTOP,
  render: (args) => {
    const entries = placeEntries(calendarGrid(), CALENDAR_TODAY);
    return (
      <div style={closeGrid}>
        {CLOSE_DAYS.map(({ label, date, pick }) => (
          <div key={label}>
            <p style={cellLabel}>{label}</p>
            <DayCell
              day={date}
              entries={pick(entries)}
              today={CALENDAR_TODAY}
              onSelect={args.onSelect}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "+3 fleiri 28. október" })
    ).toBeVisible();
  },
};

/* ── Stamp states ── */

const statesRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))",
};
const statesPanel: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))",
  gap: "var(--sl-spacing-lg) var(--sl-spacing-md)",
  padding: "var(--sl-spacing-lg)",
  background: "hsl(var(--sl-color-surface))",
  color: "hsl(var(--sl-color-text-primary))",
};
const stateCell: CSSProperties = { display: "grid", justifyItems: "center", gap: "6px" };
const stateName: CSSProperties = {
  fontSize: "var(--sl-text-body-sm)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const stateLooks: CSSProperties = {
  fontSize: "var(--sl-text-xs)",
  textAlign: "center",
  color: "hsl(var(--sl-color-text-secondary))",
};
const replay: CSSProperties = {
  marginBottom: "var(--sl-spacing-md)",
  minHeight: "2.75rem",
  padding: "0 var(--sl-spacing-md)",
  border: "1px solid hsl(var(--sl-color-border-strong))",
  borderRadius: "var(--sl-radius-button)",
  background: "hsl(var(--sl-color-surface))",
  color: "hsl(var(--sl-color-text-primary))",
  font: "inherit",
  cursor: "pointer",
};

function StampStates() {
  // Remounting the stamps is what replays the thunk: it never runs on a plain re-render.
  const [round, setRound] = useState(0);
  return (
    <div>
      <button type="button" style={replay} onClick={() => setRound((r) => r + 1)}>
        Stimpla aftur
      </button>
      <div style={statesRow}>
        {(["light", "dark"] as const).map((theme) => (
          <section
            key={theme}
            data-theme={theme === "dark" ? "dark" : undefined}
            aria-label={theme === "dark" ? "Dökkt" : "Ljóst"}
            style={statesPanel}
          >
            {STAMP_STATES.map((state) => (
              <div key={`${state}-${round}`} style={stateCell}>
                <Stamp entry={sampleEntry(state, `ástand-${round}`)} size="xl" />
                <span style={stateName}>{STAMP_MEANING[state].name}</span>
                <span style={stateLooks}>{STAMP_MEANING[state].looks}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Every stamp state, large, in light and dark side by side. "Stimpla aftur" replays the thunk. */
export const StampStatesStory: Story = {
  name: "Stamp states",
  globals: { theme: "light" },
  render: () => <StampStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Stimpla aftur" }));
    await expect(canvas.getAllByText("Fellur niður")).toHaveLength(2);
  },
};

/** Every stamp and picture, and what it means. */
export const Key: Story = {
  render: () => <StampKey />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Óákveðið")).toBeVisible();
  },
};
