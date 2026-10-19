import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import PlanCalendar from "@/components/plan/PlanCalendar";
import PlanCalendarLab, { DayCellLab, LOOK_LABEL, type DayEntryLook } from "./PlanCalendarLab";
import { BUSY_MONTH, LAB_TODAY, QUIET_MONTH, labGrid, placeEntries } from "./planCalendarLabData";

/**
 * Variations on the Dagatal's day entries (PlanEntryChip as the calendar draws it). The grid is
 * fine; the entries are the generic card: white, rounded, a thin coloured left stripe, small grey
 * meta text, a bar at the bottom. Each look here gives a sveitarforingi a different story at a
 * glance. Rationale for every look, with the information ranking: the **Rationale** page beside
 * these stories (PlanCalendarLab.mdx). See Lab → About the lab.
 *
 * Fixed fixtures (October and December 2026, today = mánudagur 19. október), so the hard cases
 * stay on the same days: 1, 2, 4 and 5 entries in a day, long titles, troop-wide events, past days.
 */
const meta = {
  title: "Lab/PlanCalendar",
  component: PlanCalendarLab,
  tags: ["skip-visual"],
  parameters: { layout: "padded" },
  args: { look: "ribbon", month: BUSY_MONTH, today: LAB_TODAY, onSelect: fn() },
  argTypes: {
    look: {
      control: "inline-radio",
      options: ["ribbon", "agenda", "ticket", "readiness", "icons"],
    },
    data: { control: false },
    month: { control: false },
    today: { control: false },
  },
} satisfies Meta<typeof PlanCalendarLab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The short rationale shown on the Comparison story; the full one is on the Rationale page. */
const LOOKS: { look: DayEntryLook; story: string; reads: string }[] = [
  {
    look: "ribbon",
    story: "Who meets when: every flokkur's evening is a flag in its own colour.",
    reads: "Flokkur (colour) → title → time. Dashed stitching = not decided yet; pale = over.",
  },
  {
    look: "agenda",
    story: "What the week holds, read like a diary: time, then what.",
    reads: "Time → title → flokkur (disc). Ink = decided, pencil (italic) = not yet.",
  },
  {
    look: "ticket",
    story: "Each evening is a ticket: when it starts, what it is, and whether it is stamped.",
    reads: "Time (stub) → title → missing step on the stub (drög / óvíst / ?).",
  },
  {
    look: "readiness",
    story: "Where the planning work is: the month as a heatmap of what is still undecided.",
    reads: "Status (tint + glyph) → title → flokkur initial and time; over budget in red.",
  },
  {
    look: "icons",
    story: "What kind of month it is: the útilega, the dagsferð and the fundir by shape.",
    reads: "Type (icon) → flokkur (tile colour) → time and title.",
  },
];

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

/** The current calendar, then every look, on the same busy October. */
export const Comparison: Story = {
  render: () => (
    <div>
      <section style={section} aria-labelledby="pc-current">
        <h2 id="pc-current" style={heading}>
          Current
        </h2>
        <p style={idea}>
          PlanEntryChip in the Dagatal: a white card with the flokkur as a 3px left stripe, the
          title, grey time and venue, and the liðir bar. Every entry looks alike, so the month reads
          as a wall of cards.
        </p>
        <PlanCalendar data={labGrid()} today={LAB_TODAY} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look} style={section} aria-labelledby={`pc-${l.look}`}>
          <h2 id={`pc-${l.look}`} style={heading}>
            {LOOK_LABEL[l.look]}
          </h2>
          <p style={idea}>
            <strong>Story:</strong> {l.story} <strong>Reads:</strong> {l.reads}
          </p>
          <PlanCalendarLab look={l.look} />
        </section>
      ))}
    </div>
  ),
};

const DESKTOP = { viewport: { value: "desktop", isRotated: false } };
const PHONE = { viewport: { value: "phone", isRotated: false } };

/** The 21st has one Ernir entry; the 28th has five and folds. Desktop width, both checked. */
const busy = (look: DayEntryLook): Story => ({
  args: { look },
  globals: DESKTOP,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const ernir = canvas.getByRole("button", {
      name: "Flokksfundur Arna: Hnútar og bönd, 21. október kl. 19:30, Skátaheimilið, drög",
    });
    await userEvent.click(ernir);
    await expect(args.onSelect).toHaveBeenCalled();

    const more = canvas.getByRole("button", { name: /^\+\d fleiri 28\. október$/ });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("button", {
        name: /^Skipulagsfundur, öll sveitin: Skipulagsfundur foringja, 28\. október kl\. 20:30/,
      })
    ).toBeVisible();
  },
});

const quiet = (look: DayEntryLook): Story => ({
  args: { look, month: QUIET_MONTH },
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("4 viðburðir í mánuðinum")).toBeVisible();
  },
});

/** Phone: days become buttons; picking the 28th lists its five entries under the grid. */
const phone = (look: DayEntryLook): Story => ({
  args: { look },
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = canvas.getByRole("button", { name: "28. október, 5 viðburðir" });
    await userEvent.click(day);
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("heading", { name: "Miðvikudagur 28. október" })).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: /, 28\. október kl\./ })).toHaveLength(5);
  },
});

const dark = (look: DayEntryLook): Story => ({
  args: { look },
  globals: { theme: "dark" },
});

export const RibbonBusy: Story = { name: "A · Fáni: busy month", ...busy("ribbon") };
export const RibbonQuiet: Story = { name: "A · Fáni: quiet month", ...quiet("ribbon") };
export const RibbonPhone: Story = { name: "A · Fáni: phone", ...phone("ribbon") };
export const RibbonDark: Story = { name: "A · Fáni: dark", ...dark("ribbon") };

export const AgendaBusy: Story = { name: "B · Dagbók: busy month", ...busy("agenda") };
export const AgendaQuiet: Story = { name: "B · Dagbók: quiet month", ...quiet("agenda") };
export const AgendaPhone: Story = { name: "B · Dagbók: phone", ...phone("agenda") };
export const AgendaDark: Story = { name: "B · Dagbók: dark", ...dark("agenda") };

export const TicketBusy: Story = { name: "C · Miði: busy month", ...busy("ticket") };
export const TicketQuiet: Story = { name: "C · Miði: quiet month", ...quiet("ticket") };
export const TicketPhone: Story = { name: "C · Miði: phone", ...phone("ticket") };
export const TicketDark: Story = { name: "C · Miði: dark", ...dark("ticket") };

export const ReadinessBusy: Story = { name: "D · Staða: busy month", ...busy("readiness") };
export const ReadinessQuiet: Story = { name: "D · Staða: quiet month", ...quiet("readiness") };
export const ReadinessPhone: Story = { name: "D · Staða: phone", ...phone("readiness") };
export const ReadinessDark: Story = { name: "D · Staða: dark", ...dark("readiness") };

export const IconsBusy: Story = { name: "E · Tákn: busy month", ...busy("icons") };
export const IconsQuiet: Story = { name: "E · Tákn: quiet month", ...quiet("icons") };
export const IconsPhone: Story = { name: "E · Tákn: phone", ...phone("icons") };
export const IconsDark: Story = { name: "E · Tákn: dark", ...dark("icons") };

/* ── One day, close up ── */

const CLOSE_DAYS: { label: string; day: Date }[] = [
  { label: "1 entry", day: new Date(2026, 9, 21) },
  { label: "2 entries", day: new Date(2026, 9, 27) },
  { label: "5 entries", day: new Date(2026, 9, 28) },
  { label: "Past, 2 entries", day: new Date(2026, 9, 6) },
  { label: "Today, long title", day: new Date(2026, 9, 19) },
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

/** Every look's single cell at desktop width, with 1, 2 and 5 entries, a past day and today. */
export const OneDayCloseUp: Story = {
  name: "One day, close up",
  globals: DESKTOP,
  render: (args) => {
    const entries = placeEntries(labGrid(), LAB_TODAY);
    return (
      <div style={{ display: "grid", gap: "var(--sl-spacing-lg)" }}>
        {LOOKS.map(({ look }) => (
          <section key={look} aria-labelledby={`close-${look}`}>
            <h2 id={`close-${look}`} style={heading}>
              {LOOK_LABEL[look]}
            </h2>
            <div style={closeGrid}>
              {CLOSE_DAYS.map(({ label, day }) => (
                <div key={label}>
                  <p style={cellLabel}>{label}</p>
                  <DayCellLab
                    look={look}
                    day={day}
                    entries={entries.filter((e) => e.day.getTime() === day.getTime())}
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
    const canvas = within(canvasElement);
    // Every look folds the five-entry day.
    await expect(
      canvas.getAllByRole("button", { name: /^\+\d fleiri 28\. október$/ })
    ).toHaveLength(5);
  },
};

/** Any look, with controls. */
export const Playground: Story = {};
