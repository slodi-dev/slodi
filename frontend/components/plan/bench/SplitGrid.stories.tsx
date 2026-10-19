import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Bench,
  FUNDUR,
  LiveSplit,
  afterIntents,
  splitBenchData,
  undatedBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import SplitGrid from "./SplitGrid";

const meta: Meta<typeof SplitGrid> = {
  title: "Components/Vinnubekkur/SplitGrid",
  component: SplitGrid,
  parameters: {
    docs: {
      description: {
        component:
          "A band split across the flokkar: time down the side, one column per flokkur, " +
          "running at the same time. A short lane's idle tail is offered as “N mín laus”. " +
          "← → move a verkefni to the next flokkur. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: () => (
    <Bench data={splitBenchData()}>
      <LiveSplit fundurId={FUNDUR.overTime} band="kjarni" />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof SplitGrid>;

/** Every lane starts as a copy of what the band held. */
export const Default: Story = {};

/** One flokkur has moved a verkefni to another, so the lanes are uneven. */
export const Uneven: Story = {
  render: () => {
    const split = splitBenchData();
    const lanes = split.fundir.find((f) => f.event_id === FUNDUR.overTime)?.split?.kjarni ?? [];
    const first = lanes[0]?.items[0]?.id ?? "";
    return (
      <Bench
        data={afterIntents(split, [
          {
            t: "laneMoveAcross",
            fundurId: FUNDUR.overTime,
            band: "kjarni",
            fromLane: 0,
            toLane: 1,
            id: first,
          },
        ])}
      >
        <LiveSplit fundurId={FUNDUR.overTime} band="kjarni" />
      </Bench>
    );
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("button", { name: /^Bæta verkefni við hjá/ }).length
    ).toBeGreaterThan(0);
  },
};

/** On the scratchpad there is no clock, so the axis counts minutes. */
export const Undated: Story = {
  render: () => (
    <Bench
      data={afterIntents(undatedBenchData(), [
        { t: "splitBand", fundurId: FUNDUR.overTime, band: "kjarni" },
      ])}
    >
      <LiveSplit fundurId={FUNDUR.overTime} band="kjarni" />
    </Bench>
  ),
};

/** Selecting a verkefni shows its ← → ↑ ✕ strip; → moves it to the next flokkur. */
export const MoveAcrossFlokkar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole("button", { name: /^Refir kl\. .*Áttavitinn/ });
    await userEvent.click(first);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Færa Áttavitinn: undirstöður til Ernir" })
    );
    await waitFor(() =>
      expect(canvas.getAllByRole("button", { name: /^Ernir kl\. .*Áttavitinn/ })).toHaveLength(2)
    );
  },
};

/** The keyboard path: → on a focused verkefni moves it sideways. */
export const MoveWithArrowKeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [block] = canvas.getAllByRole("button", { name: /^Uglur kl\. .*Kortalestur/ });
    block.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getAllByRole("button", { name: /^Birnir kl\. .*Kortalestur/ })).toHaveLength(2)
    );
  },
};
