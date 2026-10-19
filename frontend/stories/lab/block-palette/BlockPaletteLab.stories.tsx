import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import BlockPalette from "@/components/plan/bench/BlockPalette";
import PlanBench from "@/components/plan/bench/PlanBench";
import { Bench, benchData, mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import type { PlanBenchData } from "@/services/plan.service";
import BlockPaletteLab, { IconMappingSheet, type CollectionsLook } from "./BlockPaletteLab";
import { LAB_BLOCKS, LONG_BLOCKS, MANY_ALBUMS } from "./blockPaletteLabData";
import styles from "./BlockPaletteLab.module.css";

/**
 * BlockPalette: C · Card grid was picked (2026-10-19), and A Icons, B Minimal list and D By
 * section were removed. The cards lost the side stripe. What's being compared now is the
 * collections area at the top left, which becomes the leader's own albums next to the built-in
 * sources. Lab → BlockPalette → About has why, the album concept and the API it needs.
 */

/* ── Meta ── */

const LOOK_OPTIONS: CollectionsLook[] = ["mappa", "kapur", "flogar", "tre"];

const meta = {
  title: "Lab/BlockPalette/Directions",
  component: BlockPaletteLab,
  tags: ["skip-visual"],
  // The bank is mock fixtures; shown unless mock mode is "off".
  beforeEach: () => mockModeIs("auto"),
  args: { look: "mappa" },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    defaultKind: {
      control: "select",
      options: ["allt", "dagskra", "leikur", "setning", "slit", "endurmat"],
    },
    blocks: { control: false },
    albums: { control: false },
    defaultSelection: { control: false },
  },
} satisfies Meta<typeof BlockPaletteLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: CollectionsLook; name: string; idea: string }[] = [
  {
    look: "mappa",
    name: "C1 · Folder list",
    idea: "Two groups, Bankinn and Mitt, one row per collection with its count. Everything is in view, and the albums scroll.",
  },
  {
    look: "kapur",
    name: "C2 · Album covers",
    idea: "Sources as four tabs, albums as covers made of the blocks inside, like photo albums.",
  },
  {
    look: "flogar",
    name: "C3 · Chips + Öll albúm…",
    idea: "One row of chips: the sources and the first albums, with the rest in a panel. The most room for cards.",
  },
  {
    look: "tre",
    name: "C4 · Tabs",
    idea: "Bankinn · Mitt as tabs. Mitt lists Sveitin mín and the albums, which can be dragged into order.",
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
  height: "46rem",
  display: "flex",
  flexDirection: "column",
  border: "1px solid hsl(var(--sl-color-border))",
} as const;
const phoneFrame = { ...railFrame, width: "100%", height: "42rem" } as const;

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

/** The current rail first, then the four collections variations, all with C's cards. */
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
        <p style={idea}>What the Vinnubekkur uses today: four fixed folders and a list.</p>
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

/* ── Helpers for the play functions ── */

type Canvas = ReturnType<typeof within>;

function railOf(canvasElement: HTMLElement): Canvas {
  const rail = canvasElement.querySelector<HTMLElement>("[data-look]");
  if (!rail) throw new Error("No lab rail");
  return within(rail);
}

/** Make the album list visible: C3 keeps it in a panel, C4 under the "Mitt" tab. */
async function showAlbums(canvas: Canvas, look: CollectionsLook) {
  if (look === "flogar") {
    const more = canvas.getByRole("button", { name: /^Öll albúm/ });
    if (more.getAttribute("aria-expanded") !== "true") await userEvent.click(more);
    await canvas.findByRole("dialog", { name: "Öll albúm" });
  }
  if (look === "tre") await userEvent.click(canvas.getByRole("tab", { name: "Mitt" }));
}

/** Rename or delete an album: from its "…" menu, or, in C2, from the bar under the covers. */
async function albumAction(canvas: Canvas, look: CollectionsLook, album: string, action: string) {
  if (look === "kapur") {
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^${album}`) }));
    await userEvent.click(canvas.getByRole("button", { name: action }));
    return;
  }
  await showAlbums(canvas, look);
  await userEvent.click(canvas.getByRole("button", { name: `Aðgerðir fyrir ${album}` }));
  await userEvent.click(await canvas.findByRole("button", { name: action }));
}

function cardOf(canvas: Canvas, name: string): HTMLElement {
  const card = canvas.getByText(name).closest("li");
  if (!card) throw new Error(`No card for ${name}`);
  return card as HTMLElement;
}

/* ── One set of stories per variation ── */

function storiesFor(look: CollectionsLook, name: string) {
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
        const canvas = railOf(canvasElement);
        await expect(canvas.getByText(/^Bætist við:/)).toBeVisible();
        await expect(canvas.getByRole("button", { name: /Búa til nýja blokk/ })).toBeDisabled();
        const card = cardOf(canvas, "Ratleikur um hverfið");
        await userEvent.click(within(card).getByRole("button", { name: "Bæta við" }));
        await waitFor(() =>
          expect(
            within(cardOf(canvas, "Ratleikur um hverfið")).getByText("Þegar á fundinum")
          ).toBeInTheDocument()
        );
      },
    } satisfies Story,
    many: {
      name: `${name} — many albums`,
      args: { ...args, albums: MANY_ALBUMS, blocks: [...LAB_BLOCKS, ...LONG_BLOCKS.slice(0, 3)] },
      render: rail,
      play: async ({ canvasElement }) => {
        const canvas = railOf(canvasElement);
        await showAlbums(canvas, look);
        await userEvent.click(canvas.getByRole("button", { name: /^Fundir þegar helmingur/ }));
        await waitFor(() =>
          expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
            /^Fundir þegar helmingur/
          )
        );
        // Long names wrap; nothing pushes the rail sideways.
        const railEl = canvasElement.querySelector<HTMLElement>("[data-look]") as HTMLElement;
        await expect(railEl.scrollWidth).toBeLessThanOrEqual(railEl.clientWidth + 1);
      },
    } satisfies Story,
    empty: {
      name: `${name} — empty album`,
      args: { ...args, defaultSelection: { type: "album", id: "al-5" } },
      render: rail,
      play: async ({ canvasElement }) => {
        const canvas = railOf(canvasElement);
        await expect(canvas.getByText("„Jólafundur“ er tómt.")).toBeVisible();
        await userEvent.click(canvas.getByRole("button", { name: "Sýna allan bankann" }));
        await expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
          "Allt: 13 blokkir"
        );
      },
    } satisfies Story,
    create: {
      name: `${name} — create album`,
      args,
      parameters: {
        // In C1 and C4's rename step, React's act() finds leftover work after a synthetic event
        // and warns. The same steps with real input in Playwright (from :6008) log nothing, so
        // this is the test harness, not the component. Allowed here and nowhere else.
        // C4 also gets one from dnd-kit's DndContext, which re-measures its sortable albums
        // after the list changes, outside any act().
        allowedConsoleErrors: [
          /^A component suspended inside an `act` scope/,
          /^An update to %s inside a test was not wrapped in act[\s\S]*DndContext\d*$/,
        ],
      },
      render: rail,
      play: async ({ canvasElement, step }) => {
        const canvas = railOf(canvasElement);
        await step("a duplicate name is refused, and says why", async () => {
          await showAlbums(canvas, look);
          await userEvent.click(canvas.getByRole("button", { name: "Nýtt albúm" }));
          const field = await canvas.findByLabelText("Heiti nýs albúms");
          await userEvent.type(field, "uppáhalds leikir {Enter}");
          await expect(await canvas.findByRole("alert")).toHaveTextContent(
            "Þú átt þegar albúm sem heitir „Uppáhalds leikir“."
          );
          await expect(field).toHaveAttribute("aria-invalid", "true");
          await userEvent.clear(field);
          await userEvent.type(field, "Haustfundir{Enter}");
          await expect(await canvas.findByText("„Haustfundir“ er tómt.")).toBeVisible();
        });
        await step("rename", async () => {
          await albumAction(canvas, look, "Haustfundir", "Endurnefna");
          const field = await canvas.findByLabelText("Nýtt heiti á Haustfundir");
          await userEvent.clear(field);
          await userEvent.type(field, "Haustfundir 2026{Enter}");
          await expect(await canvas.findByText("„Haustfundir 2026“ er tómt.")).toBeVisible();
        });
        await step("delete, then Afturkalla", async () => {
          await albumAction(canvas, look, "Haustfundir 2026", "Eyða albúmi");
          await expect(await canvas.findByText("Albúmi eytt: Haustfundir 2026.")).toBeVisible();
          await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
          await expect(
            await canvas.findByText("Albúmið Haustfundir 2026 er komið aftur.")
          ).toBeVisible();
        });
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
        const canvas = railOf(canvasElement);
        const targets = [
          ...canvas.getAllByRole("button", { name: "Bæta við" }).slice(0, 2),
          ...canvas.getAllByRole("button", { name: /^Setja í albúm/ }).slice(0, 2),
        ];
        for (const button of targets) {
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

const folders = storiesFor("mappa", "C1 · Folder list");
export const FolderList: Story = folders.default;
export const FolderListManyAlbums: Story = folders.many;
export const FolderListEmptyAlbum: Story = folders.empty;
export const FolderListCreateAlbum: Story = folders.create;
export const FolderListPhone: Story = folders.phone;
export const FolderListDark: Story = folders.dark;

const covers = storiesFor("kapur", "C2 · Album covers");
export const AlbumCovers: Story = covers.default;
export const AlbumCoversManyAlbums: Story = covers.many;
export const AlbumCoversEmptyAlbum: Story = covers.empty;
export const AlbumCoversCreateAlbum: Story = covers.create;
export const AlbumCoversPhone: Story = covers.phone;
export const AlbumCoversDark: Story = covers.dark;

const chips = storiesFor("flogar", "C3 · Chips + Öll albúm…");
export const Chips: Story = chips.default;
export const ChipsManyAlbums: Story = chips.many;
export const ChipsEmptyAlbum: Story = chips.empty;
export const ChipsCreateAlbum: Story = chips.create;
export const ChipsPhone: Story = chips.phone;
export const ChipsDark: Story = chips.dark;

const tabs = storiesFor("tre", "C4 · Tabs");
export const Tabs: Story = tabs.default;
export const TabsManyAlbums: Story = tabs.many;
export const TabsEmptyAlbum: Story = tabs.empty;
export const TabsCreateAlbum: Story = tabs.create;
export const TabsPhone: Story = tabs.phone;
export const TabsDark: Story = tabs.dark;

/** C4: the albums reorder with the arrow keys on their handle (and by dragging it). */
export const TabsReorder: Story = {
  name: "C4 · Tabs — reorder",
  args: { look: "tre" },
  render: (a) => (
    <Rail>
      <BlockPaletteLab {...a} />
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Mitt" }));
    const handle = canvas.getByRole("button", { name: "Færa Rigningardagar, sæti 2 af 5" });
    handle.focus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(await canvas.findByText("Rigningardagar fært í sæti 1 af 5.")).toBeVisible();
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Færa Rigningardagar, sæti 1 af 5" })).toHaveFocus()
    );
  },
};

/* ── The card's "Setja í albúm…" ── */

/** The picker lists every album, ticks the ones the block is in, and can start a new one. */
export const PutInAlbum: Story = {
  name: "Setja í albúm",
  args: { look: "mappa" },
  render: (a) => (
    <Rail>
      <BlockPaletteLab {...a} />
    </Rail>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = railOf(canvasElement);
    const card = cardOf(canvas, "Kötturinn og músin");
    await step("shows where the block already is", async () => {
      await userEvent.click(
        within(card).getByRole("button", { name: "Setja í albúm…, í 2 albúmum" })
      );
      const picker = within(
        await canvas.findByRole("dialog", { name: "Setja Kötturinn og músin í albúm" })
      );
      await expect(picker.getByRole("checkbox", { name: "Uppáhalds leikir" })).toBeChecked();
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).not.toBeChecked();
    });
    await step("ticking an album adds the block to it", async () => {
      const picker = within(
        canvas.getByRole("dialog", { name: "Setja Kötturinn og músin í albúm" })
      );
      await userEvent.click(picker.getByRole("checkbox", { name: "Rigningardagar" }));
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).toBeChecked();
      await expect(
        canvas.getByRole("button", { name: /^Rigningardagar.*4 blokkir/ })
      ).toBeInTheDocument();
    });
    await step("a new album from the picker already holds the block", async () => {
      const picker = within(
        canvas.getByRole("dialog", { name: "Setja Kötturinn og músin í albúm" })
      );
      await userEvent.click(picker.getByRole("button", { name: "Nýtt albúm" }));
      await userEvent.type(picker.getByLabelText("Heiti nýs albúms"), "Prófa næst{Enter}");
      await expect(await picker.findByRole("checkbox", { name: "Prófa næst" })).toBeChecked();
    });
    await step("Escape closes it and focus goes back to the card", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(
          within(card).getByRole("button", { name: "Setja í albúm…, í 4 albúmum" })
        ).toHaveFocus()
      );
    });
  },
};

/* ── Reference ── */

/** Every type and theme icon, on the tint it gets on a card, with why that picture. */
export const IconMapping: Story = {
  name: "Icon mapping",
  render: () => <IconMappingSheet />,
};

/** One variation, with controls. Changing a control remounts it. */
export const Playground: Story = {
  name: "Playground",
  render: (a) => (
    <Rail>
      <BlockPaletteLab
        key={JSON.stringify({ ...a, blocks: undefined, albums: undefined })}
        {...a}
      />
    </Rail>
  ),
};
