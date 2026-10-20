import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, LiveSplit } from "@/stories/vinnubekkur/benchHarness";
import SplitGridLab, { type CardLook, type SplitGridLabProps } from "./SplitGridLab";
import { FIXTURES, LAB_FUNDUR, type FixtureName } from "./splitGridLabData";

/**
 * The split band built from the bank's own cards. Each liður is the BlockPalette card it came
 * from, and the card is where a foringi changes it for one flokkur: length, status, who leads,
 * the adaptation, búnaður, another block, or back to the sveit's version. The form stays the
 * current SplitGrid's (time down the side, a column per flokkur, "Lengsti flokkur ræður", the
 * merge proposal); K1–K4 differ in how a card is edited. Purpose and trade-offs: Lab →
 * SplitGrid → Purpose and directions.
 */

type LabArgs = Omit<SplitGridLabProps, "data"> & { fixture: FixtureName };

const LOOK_OPTIONS: CardLook[] = ["face", "flip", "panel", "sync"];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const wide = { maxWidth: "72rem" } as const;

const meta = {
  title: "Lab/SplitGrid",
  tags: ["skip-visual"],
  args: { look: "face", fixture: "uneven" },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    fixture: { control: "select", options: Object.keys(FIXTURES) },
  },
  render: ({ fixture, ...args }) => (
    <div style={wide}>
      <SplitGridLab {...args} data={FIXTURES[fixture]()} />
    </div>
  ),
} satisfies Meta<LabArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: CardLook; name: string; idea: string }[] = [
  {
    look: "face",
    name: "K1 · On the card",
    idea: "The open card grows in place with length and status on its face; “Fleira…” opens the rest under it.",
  },
  {
    look: "flip",
    name: "K2 · Flip it over",
    idea: "The card turns over: its back is the whole editor, with its picture and name still on top.",
  },
  {
    look: "panel",
    name: "K3 · Editor panel",
    idea: "The grid stays still; the open card heads a panel beside it, a bottom sheet on a phone.",
  },
  {
    look: "sync",
    name: "K4 · Follows the sveit",
    idea: "Every card says “Sveitin” or “Breytt”; an edit goes to this flokkur or to every flokkur that still follows the sveit.",
  },
];

/** The current SplitGrid first, then each direction, all with the same uneven stöðvaleikur. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h2 style={heading}>Current</h2>
        <p style={idea}>
          What the app uses today: text blocks, and nothing to change but the order and the flokkur.
        </p>
        <Bench data={FIXTURES.uneven()}>
          <LiveSplit fundurId={LAB_FUNDUR} band="kjarni" />
        </Bench>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h2 style={heading}>{l.name}</h2>
          <p style={idea}>{l.idea}</p>
          <SplitGridLab look={l.look} data={FIXTURES.uneven()} />
        </section>
      ))}
    </div>
  ),
};

/* ── Helpers for the play tests ── */

const phone = { viewport: { value: "phone", isRotated: false } };
const dark = { theme: "dark" };

/** Lane totals as shown in each column header (`data-lane-total`). */
function totalOf(root: HTMLElement, patrolId: string): string | null | undefined {
  return root.querySelector(`[data-lane-total="${patrolId}"]`)?.textContent;
}

/** A card by flokkur and liður name. */
function card(canvas: ReturnType<typeof within>, patrol: string, name: string) {
  return canvas.getByRole("button", {
    name: new RegExp(`^${patrol} kl\\. \\d\\d:\\d\\d: ${name}`),
  });
}

/** Opens Refir's Hnútar og bönd and makes it 5 minutes longer: Refir's total goes 70 → 75. */
async function lengthen(canvasElement: HTMLElement, look: CardLook) {
  const canvas = within(canvasElement);
  await expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín");
  await userEvent.click(card(canvas, "Refir", "Hnútar og bönd"));
  if (look !== "face") {
    // K2–K4 move focus to the editor's heading so a screen reader hears what opened.
    await waitFor(() => expect(document.activeElement?.textContent).toContain("Hnútar og bönd"));
  }
  const [longer] = await canvas.findAllByRole("button", { name: "Lengra um 5 mín" });
  await userEvent.click(longer);
  await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("75 mín"));
}

function storiesFor(look: CardLook, name: string) {
  return {
    uneven: { name: `${name}: uneven`, args: { look, fixture: "uneven" } } satisfies Story,
    open: {
      name: `${name}: a changed card, open`,
      args: {
        look,
        fixture: "uneven",
        defaultOpen: { patrolId: "mock-refir", name: "Áttaviti og kort" },
      },
    } satisfies Story,
    six: { name: `${name}: 6 flokkar`, args: { look, fixture: "six" } } satisfies Story,
    /** An empty lane; two flokkar; three with long titles, a long name and no date. */
    edge: {
      name: `${name}: empty lane, 2 flokkar, long titles, undated`,
      render: () => (
        <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-lg)" }}>
          <SplitGridLab look={look} data={FIXTURES.empty()} />
          <SplitGridLab look={look} data={FIXTURES.two()} />
          <SplitGridLab look={look} data={FIXTURES.longUndated()} />
        </div>
      ),
    } satisfies Story,
    phone: {
      name: `${name}: phone, a card open`,
      args: {
        look,
        fixture: "uneven",
        defaultOpen: { patrolId: "mock-refir", name: "Áttaviti og kort" },
      },
      globals: phone,
    } satisfies Story,
    dark: {
      name: `${name}: dark, a card open`,
      args: {
        look,
        fixture: "uneven",
        defaultOpen: { patrolId: "mock-birnir", name: "Hnútar og bönd" },
      },
      globals: dark,
    } satisfies Story,
    /** Length, status, leader, a swap and the way back: every edit lands on the card. */
    edit: {
      name: `${name}: edit a card`,
      args: { look, fixture: "uneven" },
      play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);

        await step("length: + makes the card and the column 5 minutes longer", async () => {
          await lengthen(canvasElement, look);
        });

        await step("status: Drög is on the card at once", async () => {
          await userEvent.click(canvas.getByRole("radio", { name: "Drög" }));
          await expect(canvas.getByRole("radio", { name: "Drög" })).toBeChecked();
          // K2's card is turned over while it's open; the others show the change on the card.
          if (look !== "flip") {
            await waitFor(() =>
              expect(card(canvas, "Refir", "Hnútar og bönd")).toHaveAccessibleName(/drög/)
            );
          }
        });

        if (look === "face") {
          await userEvent.click(canvas.getByRole("button", { name: "Fleira…" }));
        }

        await step("who leads it", async () => {
          const leader = canvas.getByRole("textbox", { name: "Hver stýrir" });
          await userEvent.clear(leader);
          await userEvent.type(leader, "Dóra");
          await expect(leader).toHaveValue("Dóra");
        });

        await step("búnaður: add one with Enter, remove one with its ✕", async () => {
          await userEvent.type(
            canvas.getByRole("textbox", { name: "Búnaður" }),
            "Karabínur{Enter}"
          );
          await expect(
            canvas.getByRole("button", { name: "Taka Karabínur af lista" })
          ).toBeVisible();
          await userEvent.click(
            canvas.getByRole("button", { name: "Taka Reipi og bönd af lista" })
          );
          await expect(
            canvas.queryByRole("button", { name: "Taka Reipi og bönd af lista" })
          ).not.toBeInTheDocument();
        });

        await step("the changes are listed against the sveit's version", async () => {
          await expect(canvas.getByText("Breytt fyrir þennan flokk")).toBeVisible();
          await expect(canvas.getByText("(sveitin: 15 mín)")).toBeInTheDocument();
        });

        await step("Nota útgáfu sveitarinnar puts it all back", async () => {
          await userEvent.click(canvas.getByRole("button", { name: "Nota útgáfu sveitarinnar" }));
          await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
          await expect(canvas.queryByText("Breytt fyrir þennan flokk")).not.toBeInTheDocument();
        });

        await step("swap for another block from the bank", async () => {
          await userEvent.selectOptions(
            canvas.getByRole("combobox", { name: "Skipta út fyrir aðra blokk" }),
            "st-tjald"
          );
          await waitFor(() =>
            look === "flip"
              ? expect(canvas.getByRole("heading", { name: /Tjaldreising/ })).toBeVisible()
              : expect(card(canvas, "Refir", "Tjaldreising")).toBeInTheDocument()
          );
          await expect(canvas.getByText("Önnur blokk")).toBeInTheDocument();
        });

        await step("Lokið closes it and gives focus back to the card", async () => {
          const [done] = canvas.getAllByRole("button", { name: "Lokið" });
          await userEvent.click(done);
          await waitFor(() =>
            expect(document.activeElement).toHaveAccessibleName(/^Refir kl\. .*Tjaldreising/)
          );
        });
      },
    } satisfies Story,
    /** Removing a card is the one step with an Afturkalla. Moving still works from the card. */
    removeAndMove: {
      name: `${name}: remove, undo, move`,
      args: { look, fixture: "uneven" },
      play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);

        await step("remove: the card goes, Afturkalla brings it back", async () => {
          await userEvent.click(card(canvas, "Refir", "Hnútar og bönd"));
          if (look === "face")
            await userEvent.click(canvas.getByRole("button", { name: "Fleira…" }));
          await userEvent.click(canvas.getByRole("button", { name: "Fjarlægja úr flokknum" }));
          await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín"));
          const undo = canvas.getByRole("button", { name: "Afturkalla" });
          await waitFor(() => expect(undo).toHaveFocus());
          await userEvent.click(undo);
          await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
        });

        await step("→ on a card still sends it to the next flokkur", async () => {
          card(canvas, "Refir", "Hnútar og bönd").focus();
          await userEvent.keyboard("{ArrowRight}");
          await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín"));
          await expect(totalOf(canvasElement, "mock-ernir")).toBe("60 mín");
          await waitFor(() =>
            expect(document.activeElement).toHaveAccessibleName(/^Ernir kl\. .*Hnútar og bönd/)
          );
        });

        await step("and the editor's Færa til buttons send it anywhere in one tap", async () => {
          // Ernir now have two: their own and the one that just came over. Open the new one.
          const ernir = canvas.getAllByRole("button", {
            name: /^Ernir kl\. \d\d:\d\d: Hnútar og bönd/,
          });
          await userEvent.click(ernir[ernir.length - 1]);
          if (look === "face")
            await userEvent.click(canvas.getByRole("button", { name: "Fleira…" }));
          await userEvent.click(
            canvas.getByRole("button", { name: "Færa Hnútar og bönd til Birnir" })
          );
          await waitFor(() => expect(totalOf(canvasElement, "mock-ernir")).toBe("45 mín"));
          await expect(totalOf(canvasElement, "mock-birnir")).toBe("75 mín");
        });
      },
    } satisfies Story,
  };
}

const face = storiesFor("face", "K1 · On the card");
export const FaceUneven: Story = face.uneven;
export const FaceOpen: Story = face.open;
export const FaceSix: Story = face.six;
export const FaceEdge: Story = face.edge;
export const FacePhone: Story = face.phone;
export const FaceDark: Story = face.dark;
export const FaceEdit: Story = face.edit;
export const FaceRemoveAndMove: Story = face.removeAndMove;

const flip = storiesFor("flip", "K2 · Flip it over");
export const FlipUneven: Story = flip.uneven;
export const FlipOpen: Story = flip.open;
export const FlipSix: Story = flip.six;
export const FlipEdge: Story = flip.edge;
export const FlipPhone: Story = flip.phone;
export const FlipDark: Story = flip.dark;
export const FlipEdit: Story = flip.edit;
export const FlipRemoveAndMove: Story = flip.removeAndMove;

const panel = storiesFor("panel", "K3 · Editor panel");
export const PanelUneven: Story = panel.uneven;
export const PanelOpen: Story = panel.open;
export const PanelSix: Story = panel.six;
export const PanelEdge: Story = panel.edge;
export const PanelPhone: Story = panel.phone;
export const PanelDark: Story = panel.dark;
export const PanelEdit: Story = panel.edit;
export const PanelRemoveAndMove: Story = panel.removeAndMove;

const sync = storiesFor("sync", "K4 · Follows the sveit");
export const SyncUneven: Story = sync.uneven;
export const SyncOpen: Story = sync.open;
export const SyncSix: Story = sync.six;
export const SyncEdge: Story = sync.edge;
export const SyncPhone: Story = sync.phone;
export const SyncDark: Story = sync.dark;
export const SyncEdit: Story = sync.edit;
export const SyncRemoveAndMove: Story = sync.removeAndMove;

/**
 * K4's own step: one change for every flokkur that still follows the sveit. Birnir have their
 * own leader for Hnútar, so they keep their card; the other three get the new length.
 */
export const SyncToAll: Story = {
  name: "K4 · Follows the sveit: change it for every flokkur",
  args: { look: "sync", fixture: "uneven" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2 spjöld breytt fyrir flokk")).toBeInTheDocument();
    await userEvent.click(card(canvas, "Refir", "Hnútar og bönd"));
    await userEvent.click(
      await canvas.findByRole("radio", { name: /Hjá öllum sem fylgja sveitinni \(3 flokkar\)/ })
    );
    await userEvent.click(canvas.getByRole("button", { name: "Lengra um 5 mín" }));
    await expect(await canvas.findByText("Breytt hjá 3 flokkum.")).toBeInTheDocument();
    await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("75 mín"));
    await expect(totalOf(canvasElement, "mock-ernir")).toBe("50 mín");
    await expect(totalOf(canvasElement, "mock-uglur")).toBe("80 mín");
    // Birnir's own card is left alone.
    await expect(totalOf(canvasElement, "mock-birnir")).toBe("60 mín");
    await expect(canvas.getByText("2 spjöld breytt fyrir flokk")).toBeInTheDocument();
  },
};

/* ── Merge ── */

/**
 * The merge proposal, unchanged from the earlier lab. Lanes that differ get a confirmation that
 * lists the result: keep everything in sequence (the default), or keep one flokkur's plan and
 * see what is dropped. Either way "Afturkalla" follows.
 */
export const Merge: Story = {
  name: "Merge",
  args: { look: "panel", fixture: "uneven", defaultMergeOpen: true },
};

/** The whole path: confirm, choose, merge, hear it, undo it. */
export const MergeFlow: Story = {
  name: "Merge: confirm and undo",
  args: { look: "sync", fixture: "uneven" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the default keeps everything, and says what it does to the clock", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt…" }));
      const title = await canvas.findByRole("heading", { name: "Sameina í eina röð?" });
      await waitFor(() => expect(title).toHaveFocus());
      await expect(canvas.getByRole("radio", { name: /Halda öllu/ })).toBeChecked();
    });

    await step("keeping one flokkur lists what is dropped and the button says so", async () => {
      await userEvent.click(canvas.getByRole("radio", { name: /Halda einni dagskrá/ }));
      await userEvent.selectOptions(
        canvas.getByRole("combobox", { name: "Flokkur" }),
        "mock-ernir"
      );
      await expect(canvas.getByText(/^Fellur út: \d liðir/)).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: /^Sameina og sleppa/ }));
    });

    await step("merged, announced, and undoable", async () => {
      await expect(await canvas.findByText(/^Sameinað\. \d liðir féllu út\.$/)).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
    });
  },
};

/** Lanes that are still identical lose nothing, so there is no question: merge, then Afturkalla. */
export const MergeIdentical: Story = {
  name: "Merge: identical lanes",
  args: { look: "flip", fixture: "copied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt" }));
    await expect(await canvas.findByText("Sameinað í eina röð. Ekkert féll út.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
    await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("80 mín"));
  },
};

/** Any direction with any fixture. Changing a control remounts it with fresh data. */
export const Playground: Story = {
  name: "Playground",
  render: ({ fixture, ...args }) => (
    <div style={wide}>
      <SplitGridLab
        key={JSON.stringify({ fixture, ...args })}
        {...args}
        data={FIXTURES[fixture]()}
      />
    </div>
  ),
};
