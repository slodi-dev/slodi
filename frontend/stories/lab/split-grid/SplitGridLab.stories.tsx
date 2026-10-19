import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, LiveSplit } from "@/stories/vinnubekkur/benchHarness";
import SplitGridLab, { type SplitGridLabProps, type SplitGridLook } from "./SplitGridLab";
import { FIXTURES, LAB_FUNDUR, type FixtureName } from "./splitGridLabData";

/**
 * SplitGrid variations: one section of a fundur split by flokkur, one lane per flokkur. The
 * current grid puts time down the side and a column per flokkur; at six flokkar on a phone the
 * columns are 50px wide, "Sameina í eitt" quietly keeps only the first flokkur's plan, and a
 * stöðvaleikur (the commonest reason to split) can't be read as one. Four directions, all on the
 * real bench reducer, with a merge that says what it keeps. Purpose and trade-offs: the
 * SplitGrid lab page (SplitGridLab.mdx). See Lab → About the lab.
 */

type LabArgs = Omit<SplitGridLabProps, "data"> & { fixture: FixtureName };

const LOOK_OPTIONS: SplitGridLook[] = ["timaas", "stodvar", "fylki", "spjold"];

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
  args: { look: "timaas", fixture: "uneven" },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    fixture: { control: "select", options: Object.keys(FIXTURES) },
    defaultLane: { control: { type: "number", min: 0, max: 5 } },
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
    look: "timaas",
    name: "A · Time axis",
    idea: "One row per flokkur on a shared clock; a liður is as wide as it is long, so waits show as hatched gaps.",
  },
  {
    look: "stodvar",
    name: "B · Stations",
    idea: "Stations as rows, time as columns, flokkar as coloured tokens moving through them. Clashes are flagged.",
  },
  {
    look: "fylki",
    name: "C · Matrix",
    idea: "Flokkar as rows and fixed time slots as columns, like the Rist. Dense, text first, totals at the end.",
  },
  {
    look: "spjold",
    name: "D · Cards",
    idea: "One flokkur at a time as a list of cards, with a switcher that shows every flokkur's total.",
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
          What the app uses today: time down the side, a column per flokkur, “Sameina í eitt” keeps
          the first flokkur only.
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

/* ── One set of stories per direction ── */

const phone = { viewport: { value: "phone", isRotated: false } };
const dark = { theme: "dark" };

/** Lane totals as shown on screen; every direction marks them with `data-lane-total`. */
function totalOf(root: HTMLElement, patrolId: string): string | null | undefined {
  return root.querySelector(`[data-lane-total="${patrolId}"]`)?.textContent;
}

function storiesFor(look: SplitGridLook, name: string) {
  return {
    even: { name: `${name}: even`, args: { look, fixture: "even" } } satisfies Story,
    uneven: { name: `${name}: uneven`, args: { look, fixture: "uneven" } } satisfies Story,
    six: { name: `${name}: 6 flokkar`, args: { look, fixture: "six" } } satisfies Story,
    empty: { name: `${name}: empty lane`, args: { look, fixture: "empty" } } satisfies Story,
    /** Two flokkar; and three with long titles, a long flokkur name and no date. */
    edge: {
      name: `${name}: 2 flokkar, long titles, undated`,
      render: () => (
        <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-lg)" }}>
          <SplitGridLab look={look} data={FIXTURES.two()} />
          <SplitGridLab look={look} data={FIXTURES.longUndated()} defaultLane={2} />
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

const a = storiesFor("timaas", "A · Time axis");
export const TimeAxisEven: Story = a.even;
export const TimeAxisUneven: Story = a.uneven;
export const TimeAxisSix: Story = a.six;
export const TimeAxisEmptyLane: Story = a.empty;
export const TimeAxisEdge: Story = a.edge;
export const TimeAxisPhone: Story = a.phone;
export const TimeAxisDark: Story = a.dark;
export const TimeAxisKeyboard: Story = a.keyboard;

const b = storiesFor("stodvar", "B · Stations");
export const StationsEven: Story = b.even;
export const StationsUneven: Story = b.uneven;
export const StationsSix: Story = b.six;
export const StationsEmptyLane: Story = b.empty;
export const StationsEdge: Story = b.edge;
export const StationsPhone: Story = b.phone;
export const StationsDark: Story = b.dark;
export const StationsKeyboard: Story = b.keyboard;

/** Right after "Skipta á flokka" every lane is a copy, so every flokkur is at every station at once. */
export const StationsCopied: Story = {
  name: "B · Stations: just split (all clash)",
  args: { look: "stodvar", fixture: "copied" },
};

const c = storiesFor("fylki", "C · Matrix");
export const MatrixEven: Story = c.even;
export const MatrixUneven: Story = c.uneven;
export const MatrixSix: Story = c.six;
export const MatrixEmptyLane: Story = c.empty;
export const MatrixEdge: Story = c.edge;
export const MatrixPhone: Story = c.phone;
export const MatrixDark: Story = c.dark;
export const MatrixKeyboard: Story = c.keyboard;

const d = storiesFor("spjold", "D · Cards");
export const CardsEven: Story = d.even;
export const CardsUneven: Story = d.uneven;
export const CardsSix: Story = d.six;
export const CardsEmptyLane: Story = { ...d.empty, args: { ...d.empty.args, defaultLane: 2 } };
export const CardsEdge: Story = d.edge;
export const CardsPhone: Story = d.phone;
export const CardsDark: Story = d.dark;
export const CardsKeyboard: Story = d.keyboard;

/* ── Merge ── */

/**
 * The merge proposal. Lanes that differ get a confirmation that lists the result: keep
 * everything in sequence (the default), or keep one flokkur's plan and see what is dropped.
 * Either way "Afturkalla" follows.
 */
export const Merge: Story = {
  name: "Merge",
  args: { look: "timaas", fixture: "uneven", defaultMergeOpen: true },
};

/** The same confirmation, with "Halda einni dagskrá" chosen: what falls out is listed in red. */
export const MergeKeepOne: Story = {
  name: "Merge: keep one flokkur",
  args: { look: "fylki", fixture: "uneven", defaultMergeOpen: true },
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
  args: { look: "stodvar", fixture: "uneven" },
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
  args: { look: "timaas", fixture: "copied" },
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
