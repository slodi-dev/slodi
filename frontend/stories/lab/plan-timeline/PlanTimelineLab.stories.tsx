import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import PlanTimeline from "@/components/plan/PlanTimeline";
import { longTextGrid, nothingPlannedGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanTimelineLab, { type TimelineLook } from "./PlanTimelineLab";
import { entryName, timelineEntries } from "./timelineEntries";
import { AFTER_SEASON, busyGrid, quietGrid } from "./timelineFixtures";

/**
 * PlanTimeline variations. The current timeline is one flokkur's season as a list of the
 * same rounded chips the other views use, grouped by month, so it reads like any list and
 * says nothing about *where in the term* the flokkur is. These four draw the season as a
 * shape: a trail, a ruler, a diary and swimlanes. Each says the weekly rhythm once, keeps the
 * routine fundir quiet and puts the exceptions forward, with the calendar Staða's status
 * marks. The reasoning for each is in Lab → PlanTimeline → Rationale.
 */

const LOOKS: { look: TimelineLook; name: string; story: string }[] = [
  {
    look: "slod",
    name: "A · Slóð (trail)",
    story:
      "The term as a route: walked is solid, ahead is dashed, the flokkur's flag at Í dag. The weekly fundur is a small waypoint; an útilega or dagsferð is a camp with its icon. First read: today and next. Then the camps. Then the routine.",
  },
  {
    look: "kvardi",
    name: "B · Kvarði (ruler)",
    story:
      "Time left to right, as Signý drew it. Fundir hang off their week: a thin string for the weekly fundur, a heavy tagged one for an exception, coloured by status. Honest spacing, but sideways scrolling on a phone.",
  },
  {
    look: "dagbok",
    name: "C · Dagbók (diary)",
    story:
      "A ruled line per week, so an empty week is an empty line. The usual time is a ditto mark (〃); anything else gets its icon, type and span. The only look with the week's ATH notes. Dense, and least about the term's shape.",
  },
  {
    look: "brautir",
    name: "D · Brautir (swimlanes)",
    story:
      "Every flokkur on one axis. The weekly fundur is a pale tint, exceptions and moved fundir are full colour, so the rhythm reads as a band and the breaks jump out. It's close to the grid turned sideways.",
  },
];

const LOOK_OPTIONS = LOOKS.map((l) => l.look);

const meta = {
  title: "Lab/PlanTimeline",
  component: PlanTimelineLab,
  tags: ["skip-visual"],
  args: { look: "slod", data: busyGrid(), onSelect: fn() },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    data: { control: false },
    today: { control: false },
    defaultPatrolId: {
      control: "select",
      options: mockGrid(MOCK_SEASON_ID).patrols.map((p) => p.id),
    },
  },
} satisfies Meta<typeof PlanTimelineLab>;

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
const wide = { maxWidth: "72rem" } as const;
const stack = { ...wide, display: "grid", gap: "var(--sl-spacing-xl)" } as const;

/** The current component first, then each direction with the same season. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={stack}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          What the app uses today: rounded chips with a left stripe, grouped by month. No sense of
          where today is, of gaps, or of the term&apos;s shape.
        </p>
        <PlanTimeline data={args.data} today={args.today} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.story}</p>
          <PlanTimelineLab {...args} look={l.look} />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per direction ── */

const phone = { viewport: { value: "phone", isRotated: false } };

/** Every fundur of the flokkur is a button whose name carries title, date and state. */
async function everyEntryIsNamed(canvasElement: HTMLElement, look: TimelineLook) {
  const data = busyGrid();
  const expected = timelineEntries(data, data.patrols[0].id, new Date());
  const canvas = within(canvasElement);
  const scope =
    look === "brautir" ? within(canvas.getByRole("list", { name: data.patrols[0].name })) : canvas;
  const own = expected.filter((e) => look !== "brautir" || !e.isTroopWide);
  for (const entry of own) {
    await expect(scope.getAllByRole("button", { name: entryName(entry) }).length).toBeGreaterThan(
      0
    );
  }
}

function storiesFor(look: TimelineLook, name: string) {
  const render: Story["render"] = (args) => (
    <div style={wide}>
      <PlanTimelineLab {...args} />
    </div>
  );
  return {
    busy: {
      name: `${name} — busy`,
      args: { look },
      render,
      play: ({ canvasElement }) => everyEntryIsNamed(canvasElement, look),
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

const slod = storiesFor("slod", "A · Slóð");
export const TrailBusy: Story = slod.busy;
export const TrailQuiet: Story = slod.quiet;
export const TrailPhone: Story = slod.phone;
export const TrailDark: Story = slod.dark;

const kvardi = storiesFor("kvardi", "B · Kvarði");
export const RulerBusy: Story = kvardi.busy;
export const RulerQuiet: Story = kvardi.quiet;
export const RulerPhone: Story = kvardi.phone;
export const RulerDark: Story = kvardi.dark;

const dagbok = storiesFor("dagbok", "C · Dagbók");
export const DiaryBusy: Story = dagbok.busy;
export const DiaryQuiet: Story = dagbok.quiet;
export const DiaryPhone: Story = dagbok.phone;
export const DiaryDark: Story = dagbok.dark;

const brautir = storiesFor("brautir", "D · Brautir");
export const LanesBusy: Story = brautir.busy;
export const LanesQuiet: Story = brautir.quiet;
export const LanesPhone: Story = brautir.phone;
export const LanesDark: Story = brautir.dark;

/* ── Edge states, every direction side by side ── */

function allLooks(note: string): Story["render"] {
  return function AllLooks(args) {
    return (
      <div style={stack}>
        <p style={idea}>{note}</p>
        {LOOKS.map((l) => (
          <section key={l.look}>
            <h3 style={heading}>{l.name}</h3>
            <PlanTimelineLab {...args} look={l.look} />
          </section>
        ))}
      </div>
    );
  };
}

/** The scratchpad: no dates, so no Í dag, no past, and the axes count weeks instead. */
export const Undated: Story = {
  name: "Edge — undated",
  args: { data: mockGrid(MOCK_SCRATCHPAD_ID) },
  render: allLooks(
    "Krot og krass: the same plan with no dates. Nothing is done, nothing is today."
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/^Í dag/)).toBeNull();
  },
};

/** The whole season is behind: Í dag sits at the end, and each look says nothing is ahead. */
export const NothingAhead: Story = {
  name: "Edge — nothing ahead",
  args: { today: AFTER_SEASON },
  render: allLooks("Every fundur is over. Í dag sits after the last one."),
  play: async ({ canvasElement }) => {
    const said = within(canvasElement).getAllByText("Ekkert skráð framundan.");
    await expect(said.length).toBeGreaterThanOrEqual(LOOKS.length);
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
              <PlanTimelineLab
                {...args}
                look={l.look}
                data={{ ...mockGrid(MOCK_SEASON_ID), patrols: [] }}
              />
              <PlanTimelineLab {...args} look={l.look} data={nothingPlannedGrid()} />
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

/** Long titles, a long flokkur name and a long ATH note. */
export const LongTitles: Story = {
  name: "Edge — long titles",
  args: { data: longTextGrid() },
  globals: phone,
  render: allLooks("At phone width, with the longest Icelandic the fixture has."),
};

/** Some fundir known only by their week. */
export const PartlyDated: Story = {
  name: "Edge — week only",
  args: {
    data: {
      ...busyGrid(),
      cells: busyGrid().cells.map((c, i) => (i % 4 === 0 ? { ...c, starts_at: null } : c)),
    },
  },
  render: allLooks("A quarter of the fundir have a week but no day yet."),
};

export const Playground: Story = {
  name: "Playground",
  render: (args) => (
    <div style={wide}>
      <PlanTimelineLab key={`${args.look}-${args.defaultPatrolId}`} {...args} />
    </div>
  ),
};
