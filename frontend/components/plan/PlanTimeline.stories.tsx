import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import { longTextGrid, nothingPlannedGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanTimeline from "./PlanTimeline";

const meta = {
  title: "Components/Vinnubekkur/PlanTimeline",
  component: PlanTimeline,
  args: { data: mockGrid(MOCK_SEASON_ID) },
  parameters: {
    docs: {
      description: {
        component:
          "One flokkur's whole season, grouped by month; past fundir recede. Spec: " +
          "`docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Month headings and day labels are Icelandic ("október 2026", "21. okt."). */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    for (const heading of within(canvasElement).getAllByRole("heading", { level: 2 })) {
      await expect(heading.textContent).toMatch(/^[a-záðéíóúýþæö]+ \d{4}$/);
    }
  },
};

export const SwitchFlokkur: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("Flokkur"), "Uglur");
    await expect(canvas.getByLabelText("Flokkur")).toHaveValue("mock-uglur");
  },
};

/** The scratchpad: one undated run, no month headings. */
export const Undated: Story = {
  args: { data: mockGrid(MOCK_SCRATCHPAD_ID) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading")).toBeNull();
  },
};

export const NothingPlanned: Story = {
  args: { data: nothingPlannedGrid() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Ekkert skráð á þennan flokk enn.")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { data: { ...mockGrid(MOCK_SEASON_ID), patrols: [] } },
};

export const LongIcelandicText: Story = { args: { data: longTextGrid() } };
