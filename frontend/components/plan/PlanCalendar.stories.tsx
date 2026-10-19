import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { formatIcelandicMonthYear } from "@/lib/format";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import { longTextGrid, partlyDatedGrid } from "@/stories/vinnubekkur/planFixtures";
import PlanCalendar from "./PlanCalendar";

const meta = {
  title: "Components/Vinnubekkur/PlanCalendar",
  component: PlanCalendar,
  args: { data: mockGrid(MOCK_SEASON_ID) },
  parameters: {
    docs: {
      description: {
        component:
          "Dagatal: the same dataset as the Rist, by month. An entry with a date is drawn on " +
          "its day; one with only a week is listed under the month instead of on an invented " +
          "day. Spec: `docs/design/vinnubekkurinn/SPEC.md` on `origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on this month, with the month name in Icelandic. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { level: 2 });
    await expect(heading).toHaveTextContent(formatIcelandicMonthYear(new Date()));
    await expect(heading.textContent).toMatch(/^[a-záðéíóúýþæö]+ \d{4}$/);
  },
};

/** Paging forward changes the month, still in Icelandic. */
export const NextMonth: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Næsti mánuður" }));
    const now = new Date();
    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent(
      formatIcelandicMonthYear(new Date(now.getFullYear(), now.getMonth() + 1, 1))
    );
    await expect(canvas.getByText(/\d+ fund(ur|ir) í öðrum mánuðum/)).toBeInTheDocument();
  },
};

/** Entries known only by their week are listed, not placed on a guessed day. */
export const PartlyDated: Story = {
  args: { data: partlyDatedGrid() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Skráð á viku, ekki á dag")).toBeVisible();
  },
};

/** The scratchpad has no dates at all, so there is no calendar to draw. */
export const Undated: Story = {
  args: { data: mockGrid(MOCK_SCRATCHPAD_ID) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/engar dagsettar vikur/)).toBeVisible();
  },
};

export const LongIcelandicText: Story = { args: { data: longTextGrid() } };
