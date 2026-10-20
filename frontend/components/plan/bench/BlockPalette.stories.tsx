import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, benchData, mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import { IconMappingSheet } from "@/stories/vinnubekkur/BlockPaletteIconSheet";
import shellStyles from "@/stories/vinnubekkur/blockPaletteStories.module.css";
import { LIBRARY_FOLDERS, type FolderIconName, type LibraryFolder } from "@/lib/mock/folders.mock";
import { LIBRARY, type LibraryBlock } from "@/lib/mock/library.mock";
import type { PlanBenchData } from "@/services/plan.service";
import BlockPalette from "./BlockPalette";
import PlanBench from "./PlanBench";

/* ── Story data ── */

/** Long Icelandic names, to test wrapping in a 296px rail. */
const LONG_BLOCKS: LibraryBlock[] = [
  {
    id: "lb-long-1",
    name: "Endurlífgunaræfingar með æfingabrúðum og sáraumbúðaþjálfun í litlum hópum",
    kind: "dagskra",
    minutes: 90,
    theme: "Umhyggja",
    source: "merki",
    timesUsed: 21,
    endurmat: "Krakkarnir vildu meiri tíma með brúðunum — skiptum hópnum í tvennt næst.",
  },
  {
    id: "lb-long-2",
    name: "Næturratleikur með vasaljósum og áttavitum um Heiðmerkurskógarstíga",
    kind: "leikur",
    minutes: 120,
    theme: "Ratleikni",
    source: "felagid",
    timesUsed: 11,
    image: "/mock/bank/ratleikur.svg",
  },
  {
    id: "lb-long-3",
    name: "Hátíðleg fánahylling, skátaheitið og skátalögin lesin upp saman",
    kind: "setning",
    minutes: 15,
    theme: "Hefðir",
    source: "sveitin",
    timesUsed: 1,
  },
];

const MORE_NAMES = [
  "Fundir þegar helmingur sveitarinnar er á handboltamóti",
  "Vetrarstarf",
  "Foreldrafundur",
  "Þegar rafmagnið fer",
  "Sumardagurinn fyrsti",
  "Nýliðar í september",
  "Stuttir fundir (undir klukkutíma)",
  "Varðeldur",
  "Prófað einu sinni, prófa aftur",
];

/** Fourteen möppur, some with long names, for the scrolling and wrapping states. */
const MANY_FOLDERS: LibraryFolder[] = [
  ...LIBRARY_FOLDERS,
  ...MORE_NAMES.map((name, i) => ({
    id: `mappa-more-${i}`,
    name,
    icon: (["BookMarked", "Star", "Leaf", "Flame"] as FolderIconName[])[i % 4],
    shared: i % 3 === 0,
    blockIds: LIBRARY.slice(i % 5, (i % 5) + (i % 4)).map((block) => block.id),
  })),
];

/* ── Meta ── */

/** The rail's real width (PlanShell: 296px) and a laptop-ish height. */
const railFrame = {
  width: "18.5rem",
  height: "46rem",
  display: "flex",
  flexDirection: "column",
  border: "1px solid hsl(var(--sl-color-border))",
} as const;
const phoneFrame = { ...railFrame, width: "100%", height: "42rem" } as const;

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

const meta = {
  title: "Components/Vinnubekkur/BlockPalette",
  component: BlockPalette,
  // The bank and the möppur are fixtures only (lib/mock/library.mock.ts, folders.mock.ts),
  // shown unless mock mode is "off", which is what a production build is.
  beforeEach: () => mockModeIs("auto"),
  argTypes: {
    defaultKind: {
      control: "select",
      options: ["allt", "dagskra", "leikur", "setning", "slit", "endurmat"],
    },
    blocks: { control: false },
    folders: { control: false },
    defaultSelection: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The dagskrárbankinn rail: the built-in sources as tabs, the leader's möppur " +
          "(folders) as covers, search, a type select, and the blocks as cards — each " +
          "draggable onto a sheet by its picture and addable with “Bæta við”. Möppur are in " +
          "memory until sc-620. The add flow itself is tested in PlanBench › AddFromBank. " +
          "The reasoning is on the BlockPalette docs page.",
      },
    },
  },
  render: (args) => (
    <Rail>
      <BlockPalette {...args} />
    </Rail>
  ),
} satisfies Meta<typeof BlockPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── Helpers for the play functions ── */

type Canvas = ReturnType<typeof within>;

function railOf(canvasElement: HTMLElement): Canvas {
  const rail = canvasElement.querySelector<HTMLElement>("[data-rail]");
  if (!rail) throw new Error("No rail");
  return within(rail);
}

/** Rename or delete a mappa: select its cover, then use the bar under the covers. */
async function folderAction(canvas: Canvas, folder: string, action: string) {
  await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^${folder}`) }));
  await userEvent.click(canvas.getByRole("button", { name: action }));
}

function cardOf(canvas: Canvas, name: string): HTMLElement {
  const card = canvas.getByText(name).closest("li");
  if (!card) throw new Error(`No card for ${name}`);
  return card as HTMLElement;
}

/* ── Stories ── */

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    // Not built yet (sc-148): disabled, and the reason is visible text.
    const create = canvas.getByRole("button", { name: /Búa til nýja blokk/ });
    await expect(create).toBeDisabled();
    await expect(create).toHaveTextContent("Kemur síðar");
    await expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
      "Allt: 13 blokkir"
    );
  },
};

/** In the shell: the rail beside the bench, under one provider, as PlanShell mounts them. */
export const InShell: Story = {
  name: "In the shell",
  render: (args) => (
    <Bench data={benchData()}>
      <div className={shellStyles.shell}>
        <BlockPalette {...args} />
        <div className={shellStyles.shellBench}>
          <PlanBench />
        </div>
      </div>
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await expect(canvas.getByText(/^Bætist við:/)).toBeVisible();
    const card = cardOf(canvas, "Ratleikur um hverfið");
    await userEvent.click(within(card).getByRole("button", { name: "Bæta við" }));
    await waitFor(() =>
      expect(
        within(cardOf(canvas, "Ratleikur um hverfið")).getByText("Þegar á fundinum")
      ).toBeInTheDocument()
    );
  },
};

/** No fundur to add to: "Bæta við" is disabled and the rail says why. */
export const NoFundur: Story = {
  render: (args) => (
    <Rail data={{ ...benchData(), fundir: [] }}>
      <BlockPalette {...args} />
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await expect(canvas.getByText(/Veldu fund á bekknum/)).toBeVisible();
    for (const button of canvas.getAllByRole("button", { name: "Bæta við" })) {
      await expect(button).toBeDisabled();
    }
    // Möppur don't need a fundur.
    await expect(canvas.getAllByRole("button", { name: /^Setja í möppu/ })[0]).not.toBeDisabled();
  },
};

/** Mock mode off — what production shows today: no bank and no möppur behind the rail. */
export const NoBank: Story = {
  beforeEach: () => mockModeIs("off"),
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await expect(canvas.getByText(/Dagskrárbankinn er ekki tengdur enn/)).toBeVisible();
    await expect(canvas.getByText("0 möppur")).toBeInTheDocument();
  },
};

/** The sources and the type select narrow the cards. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Færnimerki/ }));
    await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
    await expect(canvas.queryByText("Kötturinn og músin")).toBeNull();
  },
};

/** A search that finds nothing says so, names what was searched, and offers a way back. */
export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Leita í dagskrá" }), "kajak");
    await expect(canvas.getByText(/Ekkert fannst fyrir „kajak“/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Hreinsa leit og síur" }));
    await expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
      "Allt: 13 blokkir"
    );
  },
};

export const ManyFolders: Story = {
  name: "Many möppur",
  args: { folders: MANY_FOLDERS, blocks: [...LIBRARY, ...LONG_BLOCKS] },
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Fundir þegar helmingur/ }));
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
        /^Fundir þegar helmingur/
      )
    );
    // Long names wrap; nothing pushes the rail sideways.
    const railEl = canvasElement.querySelector<HTMLElement>("[data-rail]") as HTMLElement;
    await expect(railEl.scrollWidth).toBeLessThanOrEqual(railEl.clientWidth + 1);
  },
};

export const EmptyFolder: Story = {
  name: "Empty mappa",
  args: { defaultSelection: { type: "folder", id: "mappa-5" } },
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    await expect(canvas.getByText("Mappan „Jólafundur“ er tóm.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Sýna allan bankann" }));
    await expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
      "Allt: 13 blokkir"
    );
  },
};

/** Create (with a duplicate refused), rename, delete and Afturkalla. */
export const CreateFolder: Story = {
  name: "Create a mappa",
  // The steps change state; the screenshot would only catch a moment of them.
  tags: ["skip-visual"],
  parameters: {
    // In the rename step, React's act() finds leftover work after a synthetic event and
    // warns. The same steps with real input in Playwright log nothing, so this is the test
    // harness, not the component. Allowed here and nowhere else.
    allowedConsoleErrors: [/^A component suspended inside an `act` scope/],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = railOf(canvasElement);
    await step("a duplicate name is refused, and says why", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Ný mappa" }));
      const field = await canvas.findByLabelText("Heiti nýrrar möppu");
      await userEvent.type(field, "uppáhalds leikir {Enter}");
      await expect(await canvas.findByRole("alert")).toHaveTextContent(
        "Þú átt þegar möppu sem heitir „Uppáhalds leikir“."
      );
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await userEvent.clear(field);
      await userEvent.type(field, "Haustfundir{Enter}");
      await expect(await canvas.findByText("Mappan „Haustfundir“ er tóm.")).toBeVisible();
    });
    await step("rename", async () => {
      await folderAction(canvas, "Haustfundir", "Endurnefna");
      const field = await canvas.findByLabelText("Nýtt heiti á Haustfundir");
      await userEvent.clear(field);
      await userEvent.type(field, "Haustfundir 2026{Enter}");
      await expect(await canvas.findByText("Mappan „Haustfundir 2026“ er tóm.")).toBeVisible();
    });
    await step("delete, then Afturkalla", async () => {
      await folderAction(canvas, "Haustfundir 2026", "Eyða möppu");
      await expect(await canvas.findByText("Möppu eytt: Haustfundir 2026.")).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await expect(
        await canvas.findByText("Mappan Haustfundir 2026 er komin aftur.")
      ).toBeVisible();
    });
  },
};

/** The picker lists every mappa, ticks the ones the block is in, and can start a new one. */
export const PutInFolder: Story = {
  name: "Setja í möppu",
  tags: ["skip-visual"],
  play: async ({ canvasElement, step }) => {
    const canvas = railOf(canvasElement);
    const card = cardOf(canvas, "Kötturinn og músin");
    await step("shows where the block already is", async () => {
      await userEvent.click(
        within(card).getByRole("button", { name: "Setja í möppu…, í 2 möppum" })
      );
      const picker = within(
        await canvas.findByRole("dialog", { name: "Setja Kötturinn og músin í möppu" })
      );
      await expect(picker.getByRole("checkbox", { name: "Uppáhalds leikir" })).toBeChecked();
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).not.toBeChecked();
    });
    await step("ticking a mappa adds the block to it", async () => {
      const picker = within(
        canvas.getByRole("dialog", { name: "Setja Kötturinn og músin í möppu" })
      );
      await userEvent.click(picker.getByRole("checkbox", { name: "Rigningardagar" }));
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).toBeChecked();
      await expect(
        canvas.getByRole("button", { name: /^Rigningardagar.*4 blokkir/ })
      ).toBeInTheDocument();
    });
    await step("a new mappa from the picker already holds the block", async () => {
      const picker = within(
        canvas.getByRole("dialog", { name: "Setja Kötturinn og músin í möppu" })
      );
      await userEvent.click(picker.getByRole("button", { name: "Ný mappa" }));
      await userEvent.type(picker.getByLabelText("Heiti nýrrar möppu"), "Prófa næst{Enter}");
      await expect(await picker.findByRole("checkbox", { name: "Prófa næst" })).toBeChecked();
    });
    await step("Escape closes it and focus goes back to the card", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(
          within(card).getByRole("button", { name: "Setja í möppu…, í 4 möppum" })
        ).toHaveFocus()
      );
    });
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: (args) => (
    <Rail frame={phoneFrame}>
      <BlockPalette {...args} />
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = railOf(canvasElement);
    const targets = [
      ...canvas.getAllByRole("button", { name: "Bæta við" }).slice(0, 2),
      ...canvas.getAllByRole("button", { name: /^Setja í möppu/ }).slice(0, 2),
    ];
    for (const button of targets) {
      const box = button.getBoundingClientRect();
      await expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(box.width).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

/** Every type and theme icon, on the tint it gets on a card, with why that picture. */
export const IconMapping: Story = {
  name: "Icon mapping",
  render: () => <IconMappingSheet />,
};
