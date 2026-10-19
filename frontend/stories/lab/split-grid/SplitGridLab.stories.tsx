import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, LiveSplit } from "@/stories/vinnubekkur/benchHarness";
import SplitGridLab, { type SplitGridLabProps, type SplitGridLook } from "./SplitGridLab";
import { FIXTURES, LAB_FUNDUR, type FixtureName } from "./splitGridLabData";

/**
 * SplitGrid style variations. The form is the current SplitGrid's: time down the side, a column
 * per flokkur with its liðir stacked, "← → færa milli flokka", the summary line and "Sameina í
 * eitt". Four styles change only the look, and every one carries the merge proposal (say what
 * is kept, keep everything by default, Afturkalla). All moves go through the real bench
 * reducer. Purpose and trade-offs: Lab → SplitGrid → Purpose and styles.
 */

type LabArgs = Omit<SplitGridLabProps, "data"> & { fixture: FixtureName };

const LOOK_OPTIONS: SplitGridLook[] = ["ren", "stimplar", "veifur", "blad"];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const wide = { maxWidth: "64rem" } as const;

const meta = {
  title: "Lab/SplitGrid",
  tags: ["skip-visual"],
  args: { look: "ren", fixture: "uneven" },
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

const LOOKS: { look: SplitGridLook; name: string; idea: string }[] = [
  {
    look: "ren",
    name: "S1 · Clean",
    idea: "The patrol colour as a full header band with name and minutes; liðir as plain ruled rows.",
  },
  {
    look: "stimplar",
    name: "S2 · Stamped",
    idea: "The Dagatal's Stimplar language: ink-stamped column labels and each liður's status as a stamp.",
  },
  {
    look: "veifur",
    name: "S3 · Patrol flags",
    idea: "Each column under its flokkur's swallowtail pennant; the total as a tally; “ræður lengd” inked.",
  },
  {
    look: "blad",
    name: "S4 · Paper",
    idea: "A printed sheet: ruled every 5 minutes, typewriter times, a margin rule. For printing and the meeting.",
  },
];

/** The current SplitGrid first, then each style, all with the same uneven stöðvaleikur. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h2 style={heading}>Current</h2>
        <p style={idea}>What the app uses today. “Sameina í eitt” keeps the first flokkur only.</p>
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

/* ── One set of stories per style ── */

const phone = { viewport: { value: "phone", isRotated: false } };
const dark = { theme: "dark" };

/** Lane totals as shown in each column header (`data-lane-total`). */
function totalOf(root: HTMLElement, patrolId: string): string | null | undefined {
  return root.querySelector(`[data-lane-total="${patrolId}"]`)?.textContent;
}

function storiesFor(look: SplitGridLook, name: string) {
  return {
    even: { name: `${name}: even`, args: { look, fixture: "even" } } satisfies Story,
    uneven: { name: `${name}: uneven`, args: { look, fixture: "uneven" } } satisfies Story,
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
      name: `${name}: phone`,
      args: { look, fixture: "six" },
      globals: phone,
    } satisfies Story,
    dark: {
      name: `${name}: dark`,
      args: { look, fixture: "uneven" },
      globals: dark,
    } satisfies Story,
    /** → on Refir's first liður sends it to Ernir; both totals change and focus follows. */
    keyboard: {
      name: `${name}: keyboard move`,
      args: { look, fixture: "uneven" },
      play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín");
        await expect(totalOf(canvasElement, "mock-ernir")).toBe("45 mín");

        const block = canvas.getByRole("button", { name: /^Refir kl\. \d\d:\d\d: Hnútar og bönd/ });
        block.focus();
        await userEvent.keyboard("{ArrowRight}");

        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín"));
        await expect(totalOf(canvasElement, "mock-ernir")).toBe("60 mín");
        await waitFor(() =>
          expect(document.activeElement).toHaveAccessibleName(/^Ernir kl\. .*Hnútar og bönd/)
        );
        await waitFor(() =>
          expect(canvasElement.textContent).toContain("Fyrri flokkur: Refir. Nýr flokkur: Ernir.")
        );

        // ← takes it back.
        await userEvent.keyboard("{ArrowLeft}");
        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
        await expect(totalOf(canvasElement, "mock-ernir")).toBe("45 mín");
      },
    } satisfies Story,
  };
}

const clean = storiesFor("ren", "S1 · Clean");
export const CleanEven: Story = clean.even;
export const CleanUneven: Story = clean.uneven;
export const CleanSix: Story = clean.six;
export const CleanEdge: Story = clean.edge;
export const CleanPhone: Story = clean.phone;
export const CleanDark: Story = clean.dark;
export const CleanKeyboard: Story = clean.keyboard;

const stamped = storiesFor("stimplar", "S2 · Stamped");
export const StampedEven: Story = stamped.even;
export const StampedUneven: Story = stamped.uneven;
export const StampedSix: Story = stamped.six;
export const StampedEdge: Story = stamped.edge;
export const StampedPhone: Story = stamped.phone;
export const StampedDark: Story = stamped.dark;
export const StampedKeyboard: Story = stamped.keyboard;

const flags = storiesFor("veifur", "S3 · Patrol flags");
export const FlagsEven: Story = flags.even;
export const FlagsUneven: Story = flags.uneven;
export const FlagsSix: Story = flags.six;
export const FlagsEdge: Story = flags.edge;
export const FlagsPhone: Story = flags.phone;
export const FlagsDark: Story = flags.dark;
export const FlagsKeyboard: Story = flags.keyboard;

const paper = storiesFor("blad", "S4 · Paper");
export const PaperEven: Story = paper.even;
export const PaperUneven: Story = paper.uneven;
export const PaperSix: Story = paper.six;
export const PaperEdge: Story = paper.edge;
export const PaperPhone: Story = paper.phone;
export const PaperDark: Story = paper.dark;
export const PaperKeyboard: Story = paper.keyboard;

/* ── Merge ── */

/**
 * The merge proposal. Lanes that differ get a confirmation that lists the result: keep
 * everything in sequence (the default), or keep one flokkur's plan and see what is dropped.
 * Either way "Afturkalla" follows.
 */
export const Merge: Story = {
  name: "Merge",
  args: { look: "ren", fixture: "uneven", defaultMergeOpen: true },
};

/** The same confirmation, with "Halda einni dagskrá" chosen: what falls out is listed in red. */
export const MergeKeepOne: Story = {
  name: "Merge: keep one flokkur",
  args: { look: "stimplar", fixture: "uneven", defaultMergeOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: /Halda einni dagskrá/ }));
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Flokkur" }), "mock-ernir");
    await expect(canvas.getByText("Fellur út: 3 liðir · 40 mín")).toBeInTheDocument();
  },
};

/** The whole path: confirm, choose, merge, hear it, undo it. */
export const MergeFlow: Story = {
  name: "Merge: confirm and undo",
  args: { look: "veifur", fixture: "uneven" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the default keeps everything, and says what it does to the clock", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt…" }));
      const title = await canvas.findByRole("heading", { name: "Sameina í eina röð?" });
      await waitFor(() => expect(title).toHaveFocus());
      await expect(canvas.getByRole("radio", { name: /Halda öllu/ })).toBeChecked();
      await expect(canvas.getByText(/Fundurinn lengist um 10 mín/)).toBeInTheDocument();
    });

    await step("keeping one flokkur lists what is dropped and the button says so", async () => {
      await userEvent.click(canvas.getByRole("radio", { name: /Halda einni dagskrá/ }));
      await userEvent.selectOptions(
        canvas.getByRole("combobox", { name: "Flokkur" }),
        "mock-ernir"
      );
      await expect(canvas.getByText("Fellur út: 3 liðir · 40 mín")).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: "Sameina og sleppa 3 liðum" }));
    });

    await step("merged, announced, and undoable", async () => {
      await expect(await canvas.findByText("Sameinað. 3 liðir féllu út.")).toBeInTheDocument();
      await waitFor(() => expect(canvasElement.textContent).toContain("Liðir sem falla út: 3."));
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
    });

    await step("Hætta við closes it and gives focus back", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt…" }));
      await userEvent.click(await canvas.findByRole("button", { name: "Hætta við" }));
      await expect(canvas.getByRole("button", { name: "Sameina í eitt…" })).toHaveFocus();
    });
  },
};

/** Lanes that are still identical lose nothing, so there is no question: merge, then Afturkalla. */
export const MergeIdentical: Story = {
  name: "Merge: identical lanes",
  args: { look: "blad", fixture: "copied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt" }));
    await expect(await canvas.findByText("Sameinað í eina röð. Ekkert féll út.")).toBeVisible();
    await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
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
