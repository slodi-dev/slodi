import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MOCK_PATROLS, MOCK_SEASON_ID, mockGrid } from "@/lib/mock/plan.mock";
import PlanEntryChip from "./PlanEntryChip";

const grid = mockGrid(MOCK_SEASON_ID);
const cell =
  grid.cells.find((c) => (c.item_count ?? 0) > 0 && c.status === "confirmed") ?? grid.cells[0];
const undecided = grid.cells.find((c) => c.status === "unknown") ?? grid.cells[0];
const band = grid.bands[1];

const meta = {
  title: "Components/Vinnubekkur/PlanEntryChip",
  component: PlanEntryChip,
  args: {
    entry: cell,
    patrol: MOCK_PATROLS[0],
    patrolIndex: 0,
    meta: "budget",
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "16rem" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "One event as the Rist and the Dagatal draw it. The left accent is the flokkur's " +
          "colour; the second line is the time budget on the Rist and the venue on the " +
          "Dagatal. Spec: `docs/design/vinnubekkurinn/SPEC.md` on " +
          "`origin/release/vinnubekkur-v1`.",
      },
    },
  },
} satisfies Meta<typeof PlanEntryChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rist: clock, minutes against budget, and the liðir count ("5 liðir"). */
export const Budget: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/^\d+ liði?(r|ur)$/)).toBeInTheDocument();
  },
};

/** Dagatal: clock and venue. */
export const Venue: Story = { args: { meta: "venue" } };

/** Troop-wide band: primary accent, no flokkur. */
export const TroopWide: Story = { args: { entry: band, patrol: undefined, isTroopWide: true } };

/** Undecided: dashed, with the "?" mark. */
export const Undecided: Story = { args: { entry: undecided } };

export const Current: Story = { args: { isCurrent: true } };

export const LongIcelandicText: Story = {
  args: {
    entry: {
      ...cell,
      title: "Skyndihjálparþjálfun með endurlífgunarbrúðum og sáraumbúðum",
      venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
    },
  },
};

export const Select: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onSelect).toHaveBeenCalledWith(cell.event_id);
  },
};
