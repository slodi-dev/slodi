import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import PlanCalendar from "@/components/plan/PlanCalendar";
import PlanCalendarLab, {
  DayCellLab,
  LOOKS,
  LOOK_LABEL,
  StatusKey,
  type StatusLook,
} from "./PlanCalendarLab";
import {
  BUSY_MONTH,
  LAB_TODAY,
  QUIET_MONTH,
  coversDay,
  currentGrid,
  labGrid,
  placeEntries,
  type LabEntry,
} from "./planCalendarLabData";

/**
 * The Staða family: the Dagatal's day entries as a planning-status map, the direction the user
 * picked from the first round (A Fáni, B Dagbók, C Miði and E Tákn were removed on 2026-10-19).
 * Four variations differ in the mark each entry wears for its status: D1 the plain glyph, D2 a
 * sewn-on badge, D3 a campfire that grows, D4 a passport stamp.
 *
 * Every variation draws the month as a **rhythm plus exceptions**: the usual weekly fundur per
 * flokkur is one quiet line (its time is in the "Fundir vikunnar" legend), anything that breaks
 * the rhythm is a full block, a fundur that falls out says so, and a multi-day event is one bar
 * across its days, continuing onto the next week row. Rationale: the **Rationale** page beside
 * these stories. See Lab → About the lab.
 */
const meta = {
  title: "Lab/PlanCalendar",
  component: PlanCalendarLab,
  tags: ["skip-visual"],
  parameters: { layout: "padded" },
  args: { look: "stada", month: BUSY_MONTH, today: LAB_TODAY, onSelect: fn() },
  argTypes: {
    look: { control: "inline-radio", options: LOOKS },
    data: { control: false },
    month: { control: false },
    today: { control: false },
  },
} satisfies Meta<typeof PlanCalendarLab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The short rationale on the Comparison story; the full one is on the Rationale page. */
const STORY: Record<StatusLook, string> = {
  stada:
    "Where the planning work is: green is sorted, blue drafted, amber unsure, dashed grey a '?'. " +
    "A check, pencil, hourglass or '?' says the same without colour.",
  merki:
    "Every fundur earns a sewn-on badge as it is planned: a stitched check, a pencil, a question " +
    "mark, or an empty dashed badge. The flokkur is the little flag on its shoulder.",
  vardeldur:
    "The fire grows with the plan: unlit sticks, a spark, a flame, a full campfire. The month " +
    "shows where the fires are already lit. Útilegur and mót wear a tent badge.",
  stimplar:
    "A passport of fundir: a ready fundur is stamped (rotated, with its theme's icon), drafts are " +
    "lined up but not pressed, and undecided ones are empty dotted boxes with '?'.",
};

const section: CSSProperties = {
  paddingBottom: "var(--sl-spacing-xl)",
  marginBottom: "var(--sl-spacing-lg)",
  borderBottom: "1px solid hsl(var(--sl-color-border))",
};
const heading: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-body)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const idea: CSSProperties = {
  margin: "0 0 var(--sl-spacing-md)",
  fontSize: "var(--sl-text-body-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
};

/** The current calendar, then every variation, on the same October. */
export const Comparison: Story = {
  render: () => (
    <div>
      <section style={section} aria-labelledby="pc-current">
        <h2 id="pc-current" style={heading}>
          Current
        </h2>
        <p style={idea}>
          PlanEntryChip in the Dagatal. Every fundur is the same white card, so the weekly rhythm is
          a wall of cards. A cancelled fundur can only be deleted, and the útilega and the mót
          appear on their first day only.
        </p>
        <PlanCalendar data={currentGrid()} today={LAB_TODAY} />
      </section>
      {LOOKS.map((look) => (
        <section key={look} style={section} aria-labelledby={`pc-${look}`}>
          <h2 id={`pc-${look}`} style={heading}>
            {LOOK_LABEL[look]}
          </h2>
          <p style={idea}>{STORY[look]}</p>
          <PlanCalendarLab look={look} />
        </section>
      ))}
    </div>
  ),
};

const DESKTOP = { viewport: { value: "desktop", isRotated: false } };
const PHONE = { viewport: { value: "phone", isRotated: false } };

/**
 * Desktop October: the routine fundur, the moved one, the one that falls out, the span that
 * crosses a week row (one button, not two), and the fold on mið 28.
 */
const busy = (look: StatusLook): Story => ({
  args: { look },
  globals: DESKTOP,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const routine = canvas.getByRole("button", {
      name: /^Flokksfundur Arna: .+, 20\. október kl\. 19:30, Skátaheimilið, staðfest, 15 mínútur umfram$/,
    });
    await userEvent.click(routine);
    await expect(args.onSelect).toHaveBeenCalled();

    await expect(
      canvas.getByRole("button", {
        name: /^Flokksfundur Uglna: .+, 15\. október kl\. 19:30, .*fært frá 14\. október/,
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
});

const quiet = (look: StatusLook): Story => ({
  args: { look, month: QUIET_MONTH },
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/^\d+ viðburð(ur|ir) í mánuðinum/)).toBeVisible();
    await expect(canvas.getAllByText("Jólafrí: engir fundir fram yfir áramót")[0]).toBeVisible();
  },
});

/** Phone: the útilega's Saturday lists it as "Dagur 2 af 3". */
const phone = (look: StatusLook): Story => ({
  args: { look },
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = canvas.getByRole("button", { name: "31. október, 1 viðburður" });
    await userEvent.click(day);
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("heading", { name: "Laugardagur 31. október" })).toBeVisible();
    await expect(canvas.getByText(/^Dagur 2 af 3 · Öll sveitin/)).toBeVisible();
  },
});

const dark = (look: StatusLook): Story => ({ args: { look }, globals: { theme: "dark" } });

export const StadaBusy: Story = { name: "D1 · Staða: busy month", ...busy("stada") };
export const StadaQuiet: Story = { name: "D1 · Staða: quiet month", ...quiet("stada") };
export const StadaPhone: Story = { name: "D1 · Staða: phone", ...phone("stada") };
export const StadaDark: Story = { name: "D1 · Staða: dark", ...dark("stada") };

export const MerkiBusy: Story = { name: "D2 · Merki: busy month", ...busy("merki") };
export const MerkiQuiet: Story = { name: "D2 · Merki: quiet month", ...quiet("merki") };
export const MerkiPhone: Story = { name: "D2 · Merki: phone", ...phone("merki") };
export const MerkiDark: Story = { name: "D2 · Merki: dark", ...dark("merki") };

export const VardeldurBusy: Story = { name: "D3 · Varðeldur: busy month", ...busy("vardeldur") };
export const VardeldurQuiet: Story = { name: "D3 · Varðeldur: quiet month", ...quiet("vardeldur") };
export const VardeldurPhone: Story = { name: "D3 · Varðeldur: phone", ...phone("vardeldur") };
export const VardeldurDark: Story = { name: "D3 · Varðeldur: dark", ...dark("vardeldur") };

export const StimplarBusy: Story = { name: "D4 · Stimplar: busy month", ...busy("stimplar") };
export const StimplarQuiet: Story = { name: "D4 · Stimplar: quiet month", ...quiet("stimplar") };
export const StimplarPhone: Story = { name: "D4 · Stimplar: phone", ...phone("stimplar") };
export const StimplarDark: Story = { name: "D4 · Stimplar: dark", ...dark("stimplar") };

/* ── The key ── */

/** Every mark of every variation and what it means. */
export const Key: Story = {
  name: "Key: every mark",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-lg)" }}>
      {LOOKS.map((look) => (
        <section key={look} aria-labelledby={`key-${look}`}>
          <h2 id={`key-${look}`} style={heading}>
            {LOOK_LABEL[look]}
          </h2>
          <StatusKey look={look} />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText("Fellur niður")).toHaveLength(LOOKS.length);
  },
};

/* ── One day, close up ── */

const day = (d: number) => new Date(2026, 9, d);

/** A stress case the fixture's rhythm never makes: mið 28. with a fifth entry squeezed in. */
function fiveOn28(entries: LabEntry[]): LabEntry[] {
  const on28 = entries.filter((e) => coversDay(e, day(28)));
  const extra = entries.find((e) => e.kind === "routine" && coversDay(e, day(27)));
  return extra
    ? [...on28, { ...extra, id: `${extra.id}-copy`, day: day(28), endDay: day(28) }]
    : on28;
}

const onDay = (d: Date) => (all: LabEntry[]) => all.filter((e) => coversDay(e, d));

const CLOSE_DAYS: { label: string; date: Date; pick: (all: LabEntry[]) => LabEntry[] }[] = [
  { label: "1 routine fundur", date: day(21), pick: onDay(day(21)) },
  { label: "2: routine + troop (today)", date: day(19), pick: onDay(day(19)) },
  { label: "Moved fundur", date: day(15), pick: onDay(day(15)) },
  { label: "Falls out + span", date: day(26), pick: onDay(day(26)) },
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

/** Every variation's single cell at desktop width, side by side. */
export const OneDayCloseUp: Story = {
  name: "One day, close up",
  globals: DESKTOP,
  render: (args) => {
    const entries = placeEntries(labGrid(), LAB_TODAY);
    return (
      <div style={{ display: "grid", gap: "var(--sl-spacing-lg)" }}>
        {LOOKS.map((look) => (
          <section key={look} aria-labelledby={`close-${look}`}>
            <h2 id={`close-${look}`} style={heading}>
              {LOOK_LABEL[look]}
            </h2>
            <div style={closeGrid}>
              {CLOSE_DAYS.map(({ label, date, pick }) => (
                <div key={label}>
                  <p style={cellLabel}>{label}</p>
                  <DayCellLab
                    look={look}
                    day={date}
                    entries={pick(entries)}
                    onSelect={args.onSelect}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("button", { name: /^\+\d fleiri 28\. október$/ })
    ).toHaveLength(LOOKS.length);
  },
};

/** Any variation, with controls. */
export const Playground: Story = {};
