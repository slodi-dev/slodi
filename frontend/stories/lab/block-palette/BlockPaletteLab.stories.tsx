import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import BlockPalette from "@/components/plan/bench/BlockPalette";
import PlanBench from "@/components/plan/bench/PlanBench";
import { Bench, benchData, mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import type { PlanBenchData } from "@/services/plan.service";
import BlockPaletteLab, { IconMappingSheet, type BlockPaletteLook } from "./BlockPaletteLab";
import { LONG_BLOCKS } from "./blockPaletteLabData";
import styles from "./BlockPaletteLab.module.css";

/**
 * BlockPalette variations: the dagskrárbankinn rail on the left of the Vinnubekkur. The shell
 * stays as it is (collections top left, blocks below, the plan in the main body); what changes
 * is what each block shows and how the list is organised. Every direction keeps "Bæta við",
 * dragging, the search and the collections. Lab → BlockPalette → About has the inventory: why
 * each element is or is not there.
 */

/* ── Meta ── */

const LOOK_OPTIONS: BlockPaletteLook[] = ["merki", "listi", "spjold", "hlutar"];

const meta = {
  title: "Lab/BlockPalette/Directions",
  component: BlockPaletteLab,
  tags: ["skip-visual"],
  // The bank is mock fixtures; shown unless mock mode is "off".
  beforeEach: () => mockModeIs("auto"),
  args: { look: "merki" },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    defaultKind: {
      control: "select",
      options: ["allt", "dagskra", "leikur", "setning", "slit", "endurmat"],
    },
    defaultFolder: { control: "select", options: ["allt", "sveitin", "felagid", "merki"] },
    blocks: { control: false },
  },
} satisfies Meta<typeof BlockPaletteLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: BlockPaletteLook; name: string; idea: string }[] = [
  {
    look: "merki",
    name: "A · Icons",
    idea: "Every block has a picture: its own image, or its theme's icon on its type's tint. Tell them apart before reading.",
  },
  {
    look: "listi",
    name: "B · Minimal list",
    idea: "Title and minutes only, so a leader who knows the bank finds it fastest. Details on hover, focus and expand.",
  },
  {
    look: "spjold",
    name: "C · Card grid",
    idea: "Two columns of small cards with a picture, for browsing when you don't yet know what you want.",
  },
  {
    look: "hlutar",
    name: "D · By section",
    idea: "Grouped by where a block fits in the fundur (Setning, Verkefni fundar, Slit). The grouping replaces the type chips.",
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
  minHeight: "4.5em",
} as const;
/** The rail's real width (PlanShell: 296px) and a laptop-ish height. */
const railFrame = {
  width: "18.5rem",
  height: "44rem",
  display: "flex",
  flexDirection: "column",
  border: "1px solid hsl(var(--sl-color-border))",
} as const;
const phoneFrame = { ...railFrame, width: "100%", height: "40rem" } as const;

/** Each rail gets its own bench: two rails under one DndContext would share drag ids. */
function Rail({
  data = benchData(),
  frame = railFrame,
  children,
}: {
  data?: PlanBenchData;
  frame?: typeof railFrame | typeof phoneFrame;
  children: ReactNode;
}) {
  return (
    <Bench data={data}>
      <div style={frame}>{children}</div>
    </Bench>
  );
}

/** The current rail first, then the four directions on the same bank. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, 18.5rem)",
        gap: "var(--sl-spacing-xl) var(--sl-spacing-lg)",
      }}
    >
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          What the Vinnubekkur uses today: a colour stripe, title and one meta line.
        </p>
        <Rail>
          <BlockPalette />
        </Rail>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.idea}</p>
          <Rail>
            <BlockPaletteLab look={l.look} instanceName={l.name} />
          </Rail>
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per direction ── */

function railOf(canvasElement: HTMLElement): HTMLElement {
  const rail = canvasElement.querySelector<HTMLElement>("[data-look]");
  if (!rail) throw new Error("No lab rail");
  return rail;
}

function itemOf(rail: HTMLElement, name: string): HTMLElement {
  const item = within(rail).getByText(name).closest("li");
  if (!item) throw new Error(`No item for ${name}`);
  return item as HTMLElement;
}

function storiesFor(look: BlockPaletteLook, name: string) {
  const args = { look };
  const rail: Story["render"] = (a) => (
    <Rail>
      <BlockPaletteLab {...a} />
    </Rail>
  );
  return {
    /** In the shell: the rail beside the bench, under one provider, as PlanShell mounts them. */
    default: {
      name,
      args,
      render: (a) => (
        <Bench data={benchData()}>
          <div className={styles.shell}>
            <BlockPaletteLab {...a} />
            <div className={styles.shellBench}>
              <PlanBench />
            </div>
          </div>
        </Bench>
      ),
      play: async ({ canvasElement }) => {
        const r = railOf(canvasElement);
        const canvas = within(r);
        await expect(canvas.getByText(/^Bætist við:/)).toBeVisible();
        const create = canvas.getByRole("button", { name: /Búa til nýja blokk/ });
        await expect(create).toBeDisabled();
        await expect(create).toHaveTextContent("Kemur síðar");
        const item = itemOf(r, "Ratleikur um hverfið");
        await userEvent.click(within(item).getByRole("button", { name: "Bæta við" }));
        // The block is now on the active fundur, and the rail says so.
        await waitFor(() =>
          expect(
            within(itemOf(r, "Ratleikur um hverfið")).getByText("Þegar á fundinum")
          ).toBeInTheDocument()
        );
      },
    } satisfies Story,
    filtered: {
      name: `${name} — filtered`,
      args,
      render: rail,
      play: async ({ canvasElement }) => {
        const canvas = within(railOf(canvasElement));
        await userEvent.click(canvas.getByRole("button", { name: /^Færnimerki/ }));
        await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
        await expect(canvas.queryByText("Kötturinn og músin")).toBeNull();
        await expect(canvas.getByRole("status")).toHaveTextContent("3 blokkir passa");
        if (look === "hlutar") {
          // The sections replace the type chips.
          await expect(canvas.queryByRole("group", { name: "Sía eftir tegund" })).toBeNull();
        }
      },
    } satisfies Story,
    noResults: {
      name: `${name} — no results`,
      args,
      render: rail,
      play: async ({ canvasElement }) => {
        const canvas = within(railOf(canvasElement));
        await userEvent.type(canvas.getByRole("searchbox", { name: "Leita í dagskrá" }), "kajak");
        await expect(canvas.getByText(/Ekkert fannst fyrir „kajak“/)).toBeVisible();
        await expect(canvas.getByRole("status")).toHaveTextContent("0 blokkir");
      },
    } satisfies Story,
    noFundur: {
      name: `${name} — no fundur selected`,
      args,
      render: (a) => (
        <Rail data={{ ...benchData(), fundir: [] }}>
          <BlockPaletteLab {...a} />
        </Rail>
      ),
      play: async ({ canvasElement }) => {
        const canvas = within(railOf(canvasElement));
        const reason = canvas.getByText(/Veldu fund á bekknum/);
        await expect(reason).toBeVisible();
        for (const button of canvas.getAllByRole("button", { name: "Bæta við" })) {
          await expect(button).toBeDisabled();
          await expect(button).toHaveAccessibleDescription(reason.textContent ?? "");
        }
      },
    } satisfies Story,
    long: {
      name: `${name} — long titles`,
      args: { ...args, blocks: LONG_BLOCKS },
      render: rail,
      play: async ({ canvasElement }) => {
        const r = railOf(canvasElement);
        const body = r.querySelector<HTMLElement>("ul")?.parentElement ?? r;
        await expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
      },
    } satisfies Story,
    phone: {
      name: `${name} — phone`,
      args,
      globals: { viewport: { value: "phone", isRotated: false } },
      render: (a) => (
        <Rail frame={phoneFrame}>
          <BlockPaletteLab {...a} />
        </Rail>
      ),
      play: async ({ canvasElement }) => {
        const canvas = within(railOf(canvasElement));
        for (const button of canvas.getAllByRole("button", { name: "Bæta við" }).slice(0, 4)) {
          const box = button.getBoundingClientRect();
          await expect(box.height).toBeGreaterThanOrEqual(44);
          await expect(box.width).toBeGreaterThanOrEqual(44);
        }
      },
    } satisfies Story,
    dark: {
      name: `${name} — dark`,
      args,
      globals: { theme: "dark" },
      render: rail,
    } satisfies Story,
  };
}

const icons = storiesFor("merki", "A · Icons");
export const Icons: Story = icons.default;
export const IconsFiltered: Story = icons.filtered;
export const IconsNoResults: Story = icons.noResults;
export const IconsNoFundur: Story = icons.noFundur;
export const IconsLongTitles: Story = icons.long;
export const IconsPhone: Story = icons.phone;
export const IconsDark: Story = icons.dark;

const minimal = storiesFor("listi", "B · Minimal list");
export const Minimal: Story = minimal.default;
export const MinimalFiltered: Story = minimal.filtered;
export const MinimalNoResults: Story = minimal.noResults;
export const MinimalNoFundur: Story = minimal.noFundur;
export const MinimalLongTitles: Story = minimal.long;
export const MinimalPhone: Story = minimal.phone;
export const MinimalDark: Story = minimal.dark;

/** B's details live behind the title: one press opens them, the next closes them. */
export const MinimalExpand: Story = {
  name: "B · Minimal list — expand",
  args: { look: "listi" },
  render: (a) => (
    <Rail>
      <BlockPaletteLab {...a} />
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const r = railOf(canvasElement);
    const item = itemOf(r, "Eldamennska á prímus");
    const summary = within(item).getByRole("button", { name: /Eldamennska á prímus/ });
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(summary);
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await expect(within(item).getByText("Prímus og eldsneyti")).toBeVisible();
    await expect(within(item).getByText(/Vantaði annan prímus/)).toBeVisible();
  },
};

const cards = storiesFor("spjold", "C · Card grid");
export const Cards: Story = cards.default;
export const CardsFiltered: Story = cards.filtered;
export const CardsNoResults: Story = cards.noResults;
export const CardsNoFundur: Story = cards.noFundur;
export const CardsLongTitles: Story = cards.long;
export const CardsPhone: Story = cards.phone;
export const CardsDark: Story = cards.dark;

const sections = storiesFor("hlutar", "D · By section");
export const Sections: Story = sections.default;
export const SectionsFiltered: Story = sections.filtered;
export const SectionsNoResults: Story = sections.noResults;
export const SectionsNoFundur: Story = sections.noFundur;
export const SectionsLongTitles: Story = sections.long;
export const SectionsPhone: Story = sections.phone;
export const SectionsDark: Story = sections.dark;

/* ── Reference ── */

/** Every type and theme icon, on the tint it gets in the rail, with why that picture. */
export const IconMapping: Story = {
  name: "Icon mapping",
  render: () => <IconMappingSheet />,
};

/** One direction, with controls. Changing a control remounts it. */
export const Playground: Story = {
  name: "Playground",
  render: (a) => (
    <Rail>
      <BlockPaletteLab key={JSON.stringify({ ...a, blocks: undefined })} {...a} />
    </Rail>
  ),
};
