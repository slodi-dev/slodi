import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import PlanGrid from "@/components/plan/PlanGrid";
import PlanGridLab, {
  ElementStates,
  GearChecklistCloseUp,
  LOOK_NAME,
  type FundurLook,
} from "./PlanGridLab";
import { busySeason, emptySeason } from "./planGridLabData";

/**
 * The Rist with A · Two columns (picked 2026-10-19): Endurmat from last time and a Búnaður
 * checklist gathered from the week's liðir. B, C and D were removed. The variations A1–A4
 * change the fundur element in each cell, so routine weeks read quietly and the exceptions
 * (a moved fundur, a fös–sun útilega, a Saturday dagsferð, a cancelled week) stand out.
 * See the Docs page (PlanGridLab.mdx) for the data note and the reasoning.
 */

const LOOK_OPTIONS: FundurLook[] = ["chip", "stada", "merki", "vardeldur", "stimpill"];

const meta = {
  title: "Lab/PlanGrid side columns",
  component: PlanGridLab,
  // The docs page is PlanGridLab.mdx, so no autodocs page.
  tags: ["!autodocs", "skip-visual"],
  args: {
    look: "stada",
    season: busySeason(),
    onOpenLidur: fn(),
    onSelectEvent: fn(),
  },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    season: { control: false },
  },
} satisfies Meta<typeof PlanGridLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const IDEA: Record<FundurLook, string> = {
  chip: "A as picked: Endurmat and Búnaður columns, with today's PlanEntryChip in the cells.",
  stada:
    "Status first, like the Dagatal's Staða: the tile wears the state, with a glyph and a word; the flokkur is a small initial.",
  merki:
    "Each fundur is a scout patch in the flokkur's colour: sewn on once staðfest, outlined in drög, an empty ring while “?”. An útilega is a shield.",
  vardeldur: "A fire that grows as the liðir are decided, with a tally and the minutes beside it.",
  stimpill:
    "A passport stamp once a fundur is ready, “Klárt”; a dotted empty stamp, with the liðir left, until then.",
};

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;

/** The real grid first, then A with today's chip, then each variation, all with the same season. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          PlanGrid today: ATH is the free week note and Innkaup the union of the fundir&apos;s
          `needs` strings. Every fundur is the same card.
        </p>
        <PlanGrid data={args.season.grid} onSelectEvent={args.onSelectEvent} />
      </section>
      {LOOK_OPTIONS.map((look) => (
        <section key={look}>
          <h3 style={heading}>{LOOK_NAME[look]}</h3>
          <p style={idea}>{IDEA[look]}</p>
          <PlanGridLab {...args} look={look} />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per variation ── */

const phone = { viewport: { value: "phone", isRotated: false } };

function storiesFor(look: FundurLook) {
  const name = LOOK_NAME[look];
  return {
    busy: { name, args: { look } } satisfies Story,
    empty: {
      name: `${name} — empty season`,
      args: { look, season: emptySeason() },
    } satisfies Story,
    phone: { name: `${name} — phone`, args: { look }, globals: phone } satisfies Story,
  };
}

const a1 = storiesFor("stada");
export const Stada: Story = a1.busy;
export const StadaEmpty: Story = a1.empty;
export const StadaPhone: Story = a1.phone;

const a2 = storiesFor("merki");
export const Merki: Story = a2.busy;
export const MerkiEmpty: Story = a2.empty;
export const MerkiPhone: Story = a2.phone;

const a3 = storiesFor("vardeldur");
export const Vardeldur: Story = a3.busy;
export const VardeldurEmpty: Story = a3.empty;
export const VardeldurPhone: Story = a3.phone;

const a4 = storiesFor("stimpill");
export const Stimpill: Story = a4.busy;
export const StimpillEmpty: Story = a4.empty;
export const StimpillPhone: Story = a4.phone;

/* ── The fundur element, state by state ── */

const STATES = [
  { id: "lab-cell-mock-refir-1", label: "Routine, past" },
  { id: "lab-cell-mock-ernir-2", label: "Moved to fimmtudag, past" },
  { id: "lab-cell-mock-birnir-3", label: "Routine, this week" },
  { id: "lab-cell-mock-refir-3", label: "Joint útilega, fös–sun" },
  { id: "lab-band-4", label: "Whole sveit, over budget" },
  { id: "lab-cell-mock-refir-5", label: "Routine, drög" },
  { id: "lab-cell-mock-uglur-5", label: "Cancelled" },
  { id: "lab-cell-mock-birnir-7", label: "Dagsferð on a Saturday" },
  { id: "lab-cell-mock-refir-7", label: "Routine, óvíst" },
  { id: "lab-cell-mock-birnir-8", label: "Nothing decided (“?”)" },
];

/** Every variation's element for the same ten fundir, side by side. */
export const FundurElementStates: Story = {
  name: "Fundur element states",
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-lg)" }}>
      {LOOK_OPTIONS.map((look) => (
        <section key={look}>
          <h3 style={heading}>{LOOK_NAME[look]}</h3>
          <ElementStates look={look} season={args.season} ids={STATES} />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The accessible name tells the whole story, exceptions included.
    const cancelled = canvas.getAllByRole("button", {
      name: /^Uglur: .*fellur niður: Skólaferðalag/,
    });
    // Four lab elements; today's chip doesn't say either.
    await expect(cancelled).toHaveLength(LOOK_OPTIONS.length - 1);
    const moved = canvas.getAllByRole("button", {
      name: /^Ernir: .*færður af venjulegum fundartíma/,
    });
    await expect(moved.length).toBe(LOOK_OPTIONS.length - 1);
  },
};

/* ── The checklist on its own ── */

/**
 * One week's búnaður: vantar first, owned folded away. Ticking Vasaljós from vantar to eigum
 * drops the badge from 3 to 2 and is announced.
 */
export const GearChecklist: Story = {
  name: "Búnaður checklist",
  render: () => <GearChecklistCloseUp season={busySeason()} week={1} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 vantar")).toBeVisible();

    const vasaljos = canvas.getByRole("checkbox", { name: "Eigum Vasaljós ×6" });
    await expect(vasaljos).not.toBeChecked();
    await expect(vasaljos).toHaveAccessibleDescription("Fyrir: Ratleikur í Öskjuhlíð");
    await userEvent.click(vasaljos);
    await expect(vasaljos).toBeChecked();
    await expect(canvas.getByText("2 vantar")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Vasaljós ×6: eigum");

    // The owned items fold away until asked for.
    await userEvent.click(canvas.getByRole("button", { name: "Sýna 5 hluti sem við eigum" }));
    await expect(canvas.getByRole("checkbox", { name: "Eigum Prímus ×3" })).toBeChecked();
  },
};

/** Any variation, with controls. Changing the look remounts it with fresh state. */
export const Playground: Story = {
  name: "Playground",
  render: (args) => <PlanGridLab key={args.look} {...args} />,
};
