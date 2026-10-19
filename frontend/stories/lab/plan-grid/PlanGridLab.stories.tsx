import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import PlanGrid from "@/components/plan/PlanGrid";
import PlanGridLab, { GearChecklistCloseUp, type PlanGridLook } from "./PlanGridLab";
import { busySeason, emptySeason } from "./planGridLabData";

/**
 * The Rist's ATH and Innkaup columns, reconnected to the plan: endurmat from the week's liðir,
 * the leader's reminders, and the búnaður the week's liðir need, with Eigum / Vantar / Óvíst.
 * See the Docs page (PlanGridLab.mdx) for the data note and the reasoning, and Lab → About the lab.
 */

const LOOK_OPTIONS: PlanGridLook[] = ["dalkar", "minnismidi", "vikan", "spjald"];

const meta = {
  title: "Lab/PlanGrid side columns",
  component: PlanGridLab,
  // The docs page is PlanGridLab.mdx, so no autodocs page.
  tags: ["!autodocs", "skip-visual"],
  args: {
    look: "dalkar",
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

const LOOKS: { look: PlanGridLook; name: string; idea: string }[] = [
  {
    look: "dalkar",
    name: "A · Two columns",
    idea: "The same two columns, re-sourced: Endurmat from last time, and a Búnaður checklist where a tick means “eigum”.",
  },
  {
    look: "minnismidi",
    name: "B · Reminders and kit",
    idea: "ATH holds the leader's reminders pinned above the endurmat; each búnaður item steps Vantar → Eigum → Óvíst.",
  },
  {
    look: "vikan",
    name: "C · One Vikan cell",
    idea: "One quiet cell of counts per week; the details open in a dialog.",
  },
  {
    look: "spjald",
    name: "D · Week panel",
    idea: "The same counts pick a week; a docked panel beside the grid shows it and takes new reminders.",
  },
];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;

/** The real grid first, with the same season's notes and needs, then each direction. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          PlanGrid today: ATH is the free week note, Innkaup the union of the fundir&apos;s `needs`
          strings, with no quantities, no owner state and no link back to a liður.
        </p>
        <PlanGrid data={args.season.grid} onSelectEvent={args.onSelectEvent} />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.idea}</p>
          <PlanGridLab {...args} look={l.look} />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per look ── */

const phone = { viewport: { value: "phone", isRotated: false } };

function storiesFor(look: PlanGridLook, name: string, defaultWeek?: number) {
  return {
    busy: { name, args: { look, defaultWeek } } satisfies Story,
    empty: {
      name: `${name} — empty season`,
      args: { look, season: emptySeason() },
    } satisfies Story,
    phone: {
      name: `${name} — phone`,
      args: { look, defaultWeek },
      globals: phone,
    } satisfies Story,
  };
}

const a = storiesFor("dalkar", "A · Two columns");
export const TwoColumns: Story = a.busy;
export const TwoColumnsEmpty: Story = a.empty;
export const TwoColumnsPhone: Story = a.phone;

const b = storiesFor("minnismidi", "B · Reminders and kit");
export const Reminders: Story = b.busy;
export const RemindersEmpty: Story = b.empty;
export const RemindersPhone: Story = b.phone;

const c = storiesFor("vikan", "C · One Vikan cell");
export const OneCell: Story = c.busy;
export const OneCellEmpty: Story = c.empty;
export const OneCellPhone: Story = c.phone;

/** C with week 3 opened: the dialog takes focus and gives it back to the cell on close. */
export const OneCellOpen: Story = {
  name: "C · One Vikan cell — open",
  args: { look: "vikan" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole("button", { name: /^Vika 3: .*Opna vikuna$/ });
    await userEvent.click(opener);
    const dialog = await canvas.findByRole("dialog", { name: /Vika 3/ });
    // The Modal fades in.
    await waitFor(() =>
      expect(within(dialog).getByRole("heading", { name: /Búnaður/ })).toBeVisible()
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(opener).not.toBeNull();
  },
};

const d = storiesFor("spjald", "D · Week panel", 1);
export const WeekPanel: Story = d.busy;
export const WeekPanelEmpty: Story = d.empty;
export const WeekPanelPhone: Story = d.phone;

/** D: picking a week fills the panel; an empty reminder is refused inline, a real one is added. */
export const WeekPanelAddReminder: Story = {
  name: "D · Week panel — add a reminder",
  args: { look: "spjald", defaultWeek: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Vika 5:/ }));
    const panel = canvas.getByRole("complementary", { name: /Vika 5/ });
    await userEvent.click(within(panel).getByRole("button", { name: "Bæta við" }));
    await expect(within(panel).getByRole("alert")).toHaveTextContent(
      "Skrifaðu minnismiðann fyrst."
    );
    await userEvent.type(
      within(panel).getByLabelText("Nýr minnismiði"),
      "Sækja fánann í geymsluna"
    );
    await userEvent.click(within(panel).getByRole("button", { name: "Bæta við" }));
    await expect(within(panel).getByText("Sækja fánann í geymsluna")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Vika 5: .*2 minnismiðar/ })).toBeVisible();
  },
};

/* ── The checklist on its own ── */

/**
 * One week's búnaður in the three-way form C and D use. Vantar first; each item names the liðir
 * that need it. Ticking Vasaljós from Vantar to Eigum drops the badge from 3 to 2.
 */
export const GearChecklist: Story = {
  name: "Búnaður checklist",
  render: () => <GearChecklistCloseUp season={busySeason()} week={1} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 vantar")).toBeVisible();

    const vasaljos = canvas.getByRole("group", { name: "Vasaljós ×6" });
    await expect(within(vasaljos).getByRole("radio", { name: "Vantar" })).toBeChecked();
    await userEvent.click(within(vasaljos).getByRole("radio", { name: "Eigum" }));
    await expect(within(vasaljos).getByRole("radio", { name: "Eigum" })).toBeChecked();
    await expect(canvas.getByText("2 vantar")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Vasaljós ×6: eigum");

    // Which liðir need it.
    const more = canvas.getByRole("button", { name: /^Vasaljós ×6/ });
    await userEvent.click(more);
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const sources = canvasElement.querySelector(
      `#${CSS.escape(more.getAttribute("aria-controls") ?? "")}`
    );
    await expect(sources).toBeVisible();
    await expect(sources).toHaveTextContent("Ratleikur í Öskjuhlíð");
  },
};

/** Any look, with controls. Changing the look remounts it with fresh state. */
export const Playground: Story = {
  name: "Playground",
  args: { defaultWeek: 1 },
  render: (args) => <PlanGridLab key={args.look} {...args} />,
};
