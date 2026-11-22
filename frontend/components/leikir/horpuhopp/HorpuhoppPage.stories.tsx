import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HorpuhoppPage from "./HorpuhoppPage";

/**
 * The game plus its leaderboard, wired through `useGameScores`. Minimal: the
 * canvas has no static states, so the stories vary only who is playing and what
 * the board holds. The board slides up after a game over.
 */
const meta = {
  title: "Components/Leikir/Hörpuhopp/HorpuhoppPage",
  component: HorpuhoppPage,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "720px" } },
  },
} satisfies Meta<typeof HorpuhoppPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {
  parameters: {
    auth: "member",
    mockApi: [
      {
        match: /\/api\/leikir\/horpuhopp\/scores/,
        body: [
          { user_name: "Sigríður Jónsdóttir", score: 48 },
          { user_name: "Gunnar Þór Ólafsson", score: 37 },
        ],
      },
    ],
  },
};

export const Guest: Story = { parameters: { auth: "anonymous" } };
