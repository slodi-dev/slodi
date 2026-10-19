import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import { longTextGrid, nothingPlannedGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanWindow from "./PlanWindow";

const meta = {
  title: "Components/Vinnubekkur/PlanWindow",
  component: PlanWindow,
  args: { data: mockGrid(MOCK_SEASON_ID) },
  parameters: {
    docs: {
      description: {
        component:
          "The rolling window: one flokkur's last fundur and the next few. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One done fundur for context ("Búið"), then four ahead. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
    await expect(canvas.getAllByText("Búið")).toHaveLength(1);
  },
};

/** The whole season is behind: the last few are shown, all done. */
export const AllDone: Story = { args: { today: new Date(2099, 0, 1) } };

/** Undated: never done, so the window starts at the top. */
export const Undated: Story = { args: { data: mockGrid(MOCK_SCRATCHPAD_ID) } };

export const NothingAhead: Story = {
  args: { data: nothingPlannedGrid() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Engir fundir framundan/)).toBeVisible();
  },
};

export const Empty: Story = { args: { data: { ...mockGrid(MOCK_SEASON_ID), patrols: [] } } };

export const LongIcelandicText: Story = { args: { data: longTextGrid() } };
