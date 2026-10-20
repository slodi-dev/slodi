import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import BlockPalette from "@/components/plan/bench/BlockPalette";
import PlanBench from "@/components/plan/bench/PlanBench";
import { Bench, benchData, mockModeIs } from "@/stories/vinnubekkur/benchHarness";
import type { PlanBenchData } from "@/services/plan.service";
import BlockPaletteLab, { IconMappingSheet } from "./BlockPaletteLab";
import { LAB_BLOCKS, LONG_BLOCKS, MANY_FOLDERS } from "./blockPaletteLabData";
import styles from "./BlockPaletteLab.module.css";

/**
 * BlockPalette: C · Card grid was picked (2026-10-19), and A Icons, B Minimal list and D By
 * section were removed. The cards lost the side stripe. For the collections area, C2 · Covers
 * was picked (2026-10-20): the built-in sources as tabs and the leader's own folders as covers.
 * C1, C3 and C4 were removed. Lab → BlockPalette → About has why, the folder concept and the API.
 */

/* ── Meta ── */

const meta = {
  title: "Lab/BlockPalette/Directions",
  component: BlockPaletteLab,
  tags: ["skip-visual"],
  // The bank is mock fixtures; shown unless mock mode is "off".
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
} satisfies Meta<typeof BlockPaletteLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const COVERS = "C2 · Covers";

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

/** The current rail beside C2 · Covers. */
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
      <section>
        <h3 style={heading}>{COVERS}</h3>
        <p style={idea}>
          Sources as four tabs, folders as covers made of the blocks inside, like photo folders.
        </p>
        <Rail>
          <BlockPaletteLab instanceName={COVERS} />
        </Rail>
      </section>
    </div>
  ),
};

/* ── Helpers for the play functions ── */

type Canvas = ReturnType<typeof within>;

function railOf(canvasElement: HTMLElement): Canvas {
  const rail = canvasElement.querySelector<HTMLElement>("[data-rail]");
  if (!rail) throw new Error("No lab rail");
  return within(rail);
}

/** Rename or delete a folder: select its cover, then use the bar under the covers. */
async function folderAction(canvas: Canvas, folder: string, action: string) {
  await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^${folder}`) }));
  await userEvent.click(canvas.getByRole("button", { name: action }));
}

function cardOf(canvas: Canvas, name: string): HTMLElement {
  const card = canvas.getByText(name).closest("li");
  if (!card) throw new Error(`No card for ${name}`);
  return card as HTMLElement;
}

/* ── C2 · Covers ── */

function coverStories(name: string) {
  const args = {};
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
      name: `${name} — many folders`,
      args: { ...args, folders: MANY_FOLDERS, blocks: [...LAB_BLOCKS, ...LONG_BLOCKS.slice(0, 3)] },
      render: rail,
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
    } satisfies Story,
    empty: {
      name: `${name} — empty folder`,
      args: { ...args, defaultSelection: { type: "folder", id: "al-5" } },
      render: rail,
      play: async ({ canvasElement }) => {
        const canvas = railOf(canvasElement);
        await expect(canvas.getByText("Mappan „Jólafundur“ er tóm.")).toBeVisible();
        await userEvent.click(canvas.getByRole("button", { name: "Sýna allan bankann" }));
        await expect(canvasElement.querySelector("[data-showing]")).toHaveTextContent(
          "Allt: 13 blokkir"
        );
      },
    } satisfies Story,
    create: {
      name: `${name} — create folder`,
      args,
      parameters: {
        // In the rename step, React's act() finds leftover work after a synthetic event and
        // warns. The same steps with real input in Playwright (from :6008) log nothing, so this
        // is the test harness, not the component. Allowed here and nowhere else.
        allowedConsoleErrors: [/^A component suspended inside an `act` scope/],
      },
      render: rail,
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
          ...canvas.getAllByRole("button", { name: /^Setja í möppu/ }).slice(0, 2),
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

const covers = coverStories(COVERS);
export const Covers: Story = covers.default;
export const CoversManyFolders: Story = covers.many;
export const CoversEmptyFolder: Story = covers.empty;
export const CoversCreateFolder: Story = covers.create;
export const CoversPhone: Story = covers.phone;
export const CoversDark: Story = covers.dark;

/* ── The card's "Setja í möppu…" ── */

/** The picker lists every folder, ticks the ones the block is in, and can start a new one. */
export const PutInFolder: Story = {
  name: "Setja í möppu",
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
        within(card).getByRole("button", { name: "Setja í möppu…, í 2 möppum" })
      );
      const picker = within(
        await canvas.findByRole("dialog", { name: "Setja Kötturinn og músin í möppu" })
      );
      await expect(picker.getByRole("checkbox", { name: "Uppáhalds leikir" })).toBeChecked();
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).not.toBeChecked();
    });
    await step("ticking a folder adds the block to it", async () => {
      const picker = within(
        canvas.getByRole("dialog", { name: "Setja Kötturinn og músin í möppu" })
      );
      await userEvent.click(picker.getByRole("checkbox", { name: "Rigningardagar" }));
      await expect(picker.getByRole("checkbox", { name: "Rigningardagar" })).toBeChecked();
      await expect(
        canvas.getByRole("button", { name: /^Rigningardagar.*4 blokkir/ })
      ).toBeInTheDocument();
    });
    await step("a new folder from the picker already holds the block", async () => {
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
        key={JSON.stringify({ ...a, blocks: undefined, folders: undefined })}
        {...a}
      />
    </Rail>
  ),
};
