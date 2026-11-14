import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MOCK_SCRATCHPAD_ID, MOCK_SEASON_ID, mockSeasons } from "@/lib/mock/plan.mock";
import SeasonSwitcher from "./SeasonSwitcher";

const meta = {
  title: "Components/Vinnubekkur/SeasonSwitcher",
  component: SeasonSwitcher,
  args: { seasons: mockSeasons(), selectedId: MOCK_SEASON_ID, onSelect: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Picks the season the plan views show. Starfsár and scratchpads (“Krot”) share one " +
          "list, because a scratchpad is a season without dates. Renders nothing when there " +
          "are no seasons.",
      },
    },
  },
} satisfies Meta<typeof SeasonSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ScratchpadSelected: Story = { args: { selectedId: MOCK_SCRATCHPAD_ID } };

export const LongIcelandicText: Story = {
  args: {
    seasons: mockSeasons().map((s, i) =>
      i === 0 ? { ...s, name: "Starfsárið 2026–27 hjá Skátafélaginu Hraunbúum" } : s
    ),
  },
};

/** No seasons: nothing renders (the shell shows the empty state instead). */
export const Empty: Story = {
  args: { seasons: [], selectedId: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("navigation")).toBeNull();
  },
};

export const SelectSeason: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Krot og krass/ }));
    await expect(args.onSelect).toHaveBeenCalledWith(MOCK_SCRATCHPAD_ID);
  },
};
