import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  Bench,
  FUNDUR,
  LiveSheet,
  benchData,
  longTextBenchData,
  splitBenchData,
  undatedBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import FundurSheet from "./FundurSheet";

const meta: Meta<typeof FundurSheet> = {
  title: "Components/Vinnubekkur/FundurSheet",
  component: FundurSheet,
  parameters: {
    docs: {
      description: {
        component:
          "One fundur on the bench: its header (theme, venue, time, budget) and the three " +
          "beinagrind bands — Setning, Verkefni fundar, Slit. Rendered from live bench state, " +
          "so every button works. Spec: `docs/design/vinnubekkurinn/SPEC.md` on " +
          "`origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: () => (
    <Bench data={benchData()}>
      <LiveSheet fundurId={FUNDUR.nextUglur} />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof FundurSheet>;

/** Under budget, one liður still undecided. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/4 liðir/)).toBeInTheDocument();
    await expect(canvas.getByText("1 liður enn óákveðinn")).toBeInTheDocument();
  },
};

/** The liðir add up to more than the budget, and the footer says by how much. */
export const OverTime: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveSheet fundurId={FUNDUR.overTime} />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("100 / 90 mín · 10 yfir")).toBeInTheDocument();
    await expect(canvas.getByText(/5 liðir/)).toBeInTheDocument();
  },
};

/** A scratchpad fundur has no date or clock. */
export const Undated: Story = {
  render: () => (
    <Bench data={undatedBenchData()}>
      <LiveSheet fundurId={FUNDUR.overTime} />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Ódagsett")).toBeInTheDocument();
  },
};

/** A fundur that has happened, recessed. */
export const Past: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveSheet fundurId={FUNDUR.pastRefir} isPast />
    </Bench>
  ),
};

/** Troop-wide ("Öll sveitin") and over budget. */
export const TroopWide: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveSheet fundurId={FUNDUR.pastSveit} />
    </Bench>
  ),
};

/** Nothing on it yet: every band shows its blank slot. */
export const Empty: Story = {
  render: () => {
    const data = benchData();
    return (
      <Bench
        data={{
          ...data,
          fundir: data.fundir.map((f) =>
            f.event_id === FUNDUR.skeleton ? { ...f, items: [] } : f
          ),
        }}
      >
        <LiveSheet fundurId={FUNDUR.skeleton} />
      </Bench>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Ekkert skráð hér enn.")).toHaveLength(3);
    await expect(canvas.getByText("Allir liðir ákveðnir")).toBeInTheDocument();
  },
};

export const LongIcelandicText: Story = {
  render: () => (
    <Bench data={longTextBenchData()}>
      <LiveSheet fundurId={FUNDUR.overTime} />
    </Bench>
  ),
};

/** Verkefni fundar dealt out to the four flokkar. */
export const SplitSection: Story = {
  render: () => (
    <Bench data={splitBenchData()}>
      <LiveSheet fundurId={FUNDUR.overTime} />
    </Bench>
  ),
};

export const EditorOpen: Story = {
  render: () => (
    <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-3-1" }]}>
      <LiveSheet fundurId={FUNDUR.nextUglur} />
    </Bench>
  ),
};

/** "Skipta á flokka" deals a band into lanes; "Sameina í eitt" folds it back. */
export const SplitAndMerge: Story = {
  render: () => (
    <Bench data={benchData()}>
      <LiveSheet fundurId={FUNDUR.overTime} />
    </Bench>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    // One toggle per band; the second is Verkefni fundar.
    const kjarni = () =>
      canvas.getAllByRole("button", { name: /Skipta á flokka|Sameina í eitt/ })[1];

    await step("split", async () => {
      await userEvent.click(kjarni());
      await expect(kjarni()).toHaveTextContent("Sameina í eitt");
      await expect(kjarni()).toHaveAttribute("aria-pressed", "true");
      for (const flokkur of ["Refir", "Ernir", "Uglur", "Birnir"]) {
        await expect(canvas.getByText(flokkur)).toBeInTheDocument();
      }
      await expect(canvas.getByText(/Lengsti flokkur ræður/)).toBeInTheDocument();
    });

    await step("merge", async () => {
      await userEvent.click(kjarni());
      await expect(kjarni()).toHaveTextContent("Skipta á flokka");
      await expect(canvas.queryByText(/Lengsti flokkur ræður/)).toBeNull();
      await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
    });
  },
};
