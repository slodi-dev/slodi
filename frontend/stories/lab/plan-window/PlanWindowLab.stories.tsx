import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import PlanWindow from "@/components/plan/PlanWindow";
import { longTextGrid, nothingPlannedGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanWindowLab, { type WindowLook } from "./PlanWindowLab";
import { entryName, sliceWindow, windowEntries } from "./windowEntries";
import { AFTER_SEASON, busyGrid, quietGrid, undatedGrid } from "./windowFixtures";

/**
 * PlanWindow variations: the rolling "next N fundir" (A7), the paper Fundarhugmyndir sheet
 * made live. The current window is the timeline cut short: the same rounded chips, with
 * nothing on them about what is left to do. These four make **readiness** the content: what
 * is settled about each fundur (efni, dagur, staður, liðir, tími) and what is still open. The
 * reasoning for each is in Lab → PlanWindow → Rationale. Routine weekly fundir stay quiet and
 * exceptions (útilega, dagsferð, a moved fundur) are tagged, in the calendar Staða's marks.
 */

const LOOKS: { look: WindowLook; name: string; story: string }[] = [
  {
    look: "spjold",
    name: "A · Spjöld (index cards)",
    story:
      "The Fundarhugmyndir sheet as a box of index cards, tabbed by date. One fundur at a time: what is settled and what is open on ruled lines, then the kit. Closest to paper; comparing means flipping.",
  },
  {
    look: "verkefni",
    name: "B · Verkefni (to-do)",
    story:
      "The open items are the content: a box per thing still to do (\u201C2 liðir óákveðnir\u201D, \u201CVantar staðsetningu\u201D). A ready weekly fundur shrinks to one line. Most direct, but the boxes look tickable and aren't.",
  },
  {
    look: "rod",
    name: "C · Röð (strip)",
    story:
      "The next few side by side, the top rule in the fundur's status colour. Readiness is a tally: a stroke per settled check, the fifth closes the gate. Compare at a glance; only the first open item is written.",
  },
  {
    look: "naest",
    name: "D · Næst (focus)",
    story:
      "The next fundur as a front page with its full checklist and kit; the rest are one line each with a small tally. Matches A8 (detail near, skeleton far), but a far útilega gets little room.",
  },
];

const meta = {
  title: "Lab/PlanWindow",
  component: PlanWindowLab,
  tags: ["skip-visual"],
  args: { look: "spjold", data: busyGrid(), ahead: 4, onSelect: fn() },
  argTypes: {
    look: { control: "inline-radio", options: LOOKS.map((l) => l.look) },
    data: { control: false },
    today: { control: false },
    ahead: { control: { type: "range", min: 1, max: 8 } },
    defaultPatrolId: {
      control: "select",
      options: mockGrid(MOCK_SEASON_ID).patrols.map((p) => p.id),
    },
  },
} satisfies Meta<typeof PlanWindowLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  maxWidth: "48rem",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const wide = { maxWidth: "64rem" } as const;
const stack = { ...wide, display: "grid", gap: "var(--sl-spacing-xl)" } as const;

/** The current component first, then each direction with the same term. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={stack}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          What the app uses today: the last fundur and the next four as rounded chips. It says what
          is coming, not what is left to do for it.
        </p>
        <PlanWindow data={mockGrid(MOCK_SEASON_ID)} today={args.today} ahead={args.ahead} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.story}</p>
          <PlanWindowLab {...args} look={l.look} />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per direction ── */

const phone = { viewport: { value: "phone", isRotated: false } };

/** Every fundur in the window can be reached, and its name carries its readiness in words. */
async function everyFundurIsNamed(canvasElement: HTMLElement, look: WindowLook, ahead: number) {
  const data = busyGrid();
  const { behind, ahead: next } = sliceWindow(
    windowEntries(data, data.patrols[0].id, new Date()),
    ahead
  );
  const canvas = within(canvasElement);
  const role = look === "spjold" ? "tab" : "button";
  for (const entry of behind ? [behind, ...next] : next) {
    await expect(canvas.getAllByRole(role, { name: entryName(entry) }).length).toBeGreaterThan(0);
  }
}

function storiesFor(look: WindowLook, name: string) {
  const render: Story["render"] = (args) => (
    <div style={wide}>
      <PlanWindowLab {...args} />
    </div>
  );
  return {
    busy: {
      name: `${name} — busy`,
      args: { look, ahead: 5 },
      render,
      play: ({ canvasElement }) => everyFundurIsNamed(canvasElement, look, 5),
    } satisfies Story,
    quiet: { name: `${name} — quiet`, args: { look, data: quietGrid() }, render } satisfies Story,
    phone: { name: `${name} — phone`, args: { look }, globals: phone, render } satisfies Story,
    dark: {
      name: `${name} — dark`,
      args: { look },
      globals: { theme: "dark" },
      render,
    } satisfies Story,
  };
}

const spjold = storiesFor("spjold", "A · Spjöld");
export const CardsBusy: Story = spjold.busy;
export const CardsQuiet: Story = spjold.quiet;
export const CardsPhone: Story = spjold.phone;
export const CardsDark: Story = spjold.dark;

/** The tabs are one Tab stop; ← → Home End flip the cards and move focus with them. */
export const CardsKeyboard: Story = {
  name: "A · Spjöld — keyboard",
  args: { look: "spjold" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole("tab");
    await expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    // Opens on the next fundur, not on the one behind it.
    await expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    tabs[1].focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(tabs[2]).toHaveFocus();
    await expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    await expect(tabs[tabs.length - 1]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(tabs[0]).toHaveFocus();
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Búið");

    await userEvent.click(canvas.getByRole("button", { name: "Næsti fundur" }));
    await expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  },
};

const verkefni = storiesFor("verkefni", "B · Verkefni");
export const TodoBusy: Story = verkefni.busy;
export const TodoQuiet: Story = verkefni.quiet;
export const TodoPhone: Story = verkefni.phone;
export const TodoDark: Story = verkefni.dark;

const rod = storiesFor("rod", "C · Röð");
export const StripBusy: Story = rod.busy;
export const StripQuiet: Story = rod.quiet;
export const StripPhone: Story = rod.phone;
export const StripDark: Story = rod.dark;

const naest = storiesFor("naest", "D · Næst");
export const FocusBusy: Story = naest.busy;
export const FocusQuiet: Story = naest.quiet;
export const FocusPhone: Story = naest.phone;
export const FocusDark: Story = naest.dark;

/* ── Edge states, every direction side by side ── */

function allLooks(note: string): Story["render"] {
  return function AllLooks(args) {
    return (
      <div style={stack}>
        <p style={idea}>{note}</p>
        {LOOKS.map((l) => (
          <section key={l.look}>
            <h3 style={heading}>{l.name}</h3>
            <PlanWindowLab {...args} look={l.look} />
          </section>
        ))}
      </div>
    );
  };
}

/** The scratchpad: nothing is done and nothing has a day, so readiness skips "dagur". */
export const Undated: Story = {
  name: "Edge — undated",
  args: { data: undatedGrid() },
  render: allLooks(
    "Krot og krass: no dates, so the window starts at the top and readiness has four checks, not five."
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Vantar dag/)).toBeNull();
  },
};

/** The whole season is behind: each look says so and points at the last fundur. */
export const NothingAhead: Story = {
  name: "Edge — nothing ahead",
  args: { today: AFTER_SEASON },
  render: allLooks("Every fundur is over."),
  play: async ({ canvasElement }) => {
    const said = within(canvasElement).getAllByText("Ekkert skráð framundan hjá þessum flokki.");
    await expect(said).toHaveLength(LOOKS.length);
  },
};

/** No flokkar at all, and flokkar with nothing on them. */
export const Empty: Story = {
  name: "Edge — empty",
  render: function EmptyStates(args) {
    return (
      <div style={stack}>
        {LOOKS.map((l) => (
          <section key={l.look}>
            <h3 style={heading}>{l.name}</h3>
            <div style={{ display: "grid", gap: "var(--sl-spacing-md)" }}>
              <PlanWindowLab {...args} look={l.look} data={{ ...busyGrid(), patrols: [] }} />
              <PlanWindowLab {...args} look={l.look} data={nothingPlannedGrid()} />
            </div>
          </section>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Engir flokkar til að sýna enn.")).toHaveLength(LOOKS.length);
    await expect(canvas.getAllByText("Ekkert skráð á þennan flokk enn.")).toHaveLength(
      LOOKS.length
    );
  },
};

/** Long titles, a long flokkur name, at phone width. */
export const LongTitles: Story = {
  name: "Edge — long titles",
  args: { data: longTextGrid() },
  globals: phone,
  render: allLooks("At phone width, with the longest Icelandic the fixture has."),
};

/** Some fundir known only by their week: "Vantar dag" becomes an open item. */
export const WeekOnly: Story = {
  name: "Edge — week only",
  args: {
    data: {
      ...busyGrid(),
      cells: busyGrid().cells.map((c, i) => (i % 3 === 0 ? { ...c, starts_at: null } : c)),
    },
  },
  render: allLooks("A third of the fundir have a week but no day yet."),
};

export const Playground: Story = {
  name: "Playground",
  render: (args) => (
    <div style={wide}>
      <PlanWindowLab key={`${args.look}-${args.defaultPatrolId}`} {...args} />
    </div>
  ),
};
