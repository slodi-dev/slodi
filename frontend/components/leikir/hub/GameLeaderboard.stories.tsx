import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import GameLeaderboard from "./GameLeaderboard";

const entries = [
  { user_name: "Sigríður Jónsdóttir", score: 48 },
  { user_name: "Gunnar Þór Ólafsson", score: 37 },
  { user_name: "Aron Freyr Kristjánsson", score: 29 },
  { user_name: "Halla Björk Einarsdóttir", score: 21 },
  { user_name: "Kári Steinn", score: 12 },
];

const meta = {
  title: "Components/Leikir/Hub/GameLeaderboard",
  component: GameLeaderboard,
  args: {
    entries,
    visible: true,
    onClose: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          "In-game score panel: a sidebar on desktop, a bottom sheet on mobile (`visible` " +
          "slides it up). Purely presentational — `useGameScores` owns the data.",
      },
    },
  },
} satisfies Meta<typeof GameLeaderboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { entries: [] } };

/** Signed-out player: a login prompt under the list. */
export const SignedOut: Story = {
  args: { loginHref: "/auth/login?returnTo=%2Fleikir%2Fhorpuhopp" },
};

export const WithError: Story = {
  args: { errorMessage: "Ekki tókst að vista stigin. Við reynum aftur í næsta leik." },
};

/** Hidden: on mobile the sheet is off-screen; on desktop it still shows. */
export const Hidden: Story = { args: { visible: false } };

export const LongList: Story = {
  args: {
    entries: Array.from({ length: 20 }, (_, i) => ({
      user_name: i === 0 ? "Guðmundur Hrafnkell Þorvaldsson Kjerúlf" : `Skáti ${i + 1}`,
      score: 1000 - i * 37,
    })),
  },
};
