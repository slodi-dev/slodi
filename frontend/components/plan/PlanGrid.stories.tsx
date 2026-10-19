import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import { longTextGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanGrid from "./PlanGrid";

const meta = {
  title: "Components/Vinnubekkur/PlanGrid",
  component: PlanGrid,
  args: { data: mockGrid(MOCK_SEASON_ID), onSelectEvent: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Rist: the dagskrárhringur as a table — weeks down, flokkar across, troop-wide " +
          "bands spanning every column, plus the ATH and Innkaup columns. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The scratchpad: the same plan with no dates. */
export const Undated: Story = { args: { data: mockGrid(MOCK_SCRATCHPAD_ID) } };

export const Empty: Story = {
  args: { data: { ...mockGrid(MOCK_SEASON_ID), patrols: [], weeks: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/hvorki flokka né vikur/)).toBeVisible();
  },
};

export const LongIcelandicText: Story = { args: { data: longTextGrid() } };

/** Two fundir competing for one slot: the hidden one is counted, not dropped. */
export const Clash: Story = {
  args: {
    data: (() => {
      const data = mockGrid(MOCK_SEASON_ID);
      const cell = data.cells.find((c) => c.week_index === 2);
      if (!cell) return data;
      return {
        ...data,
        cells: [...data.cells, { ...cell, event_id: "clash", title: "Aukafundur" }],
      };
    })(),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/1 flokkafundur á sama tíma/)).toBeVisible();
  },
};

export const SelectEvent: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Skipulagsfundur foringja/ }));
    await expect(args.onSelectEvent).toHaveBeenCalledWith("mock-band-1");
  },
};
