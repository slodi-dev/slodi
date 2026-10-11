import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LaddiBirdPage from "./LaddiBirdPage";

/**
 * The game plus its leaderboard, wired through `useGameScores`. Minimal: the
 * canvas has no static states, so the stories vary only who is playing and what
 * the board holds.
 */
const meta = {
  title: "Components/Leikir/Laddí-bird/LaddiBirdPage",
  component: LaddiBirdPage,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "720px" } },
  },
} satisfies Meta<typeof LaddiBirdPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {
  parameters: {
    auth: "member",
    mockApi: [
      {
        match: /\/api\/leikir\/laddi-bird\/scores/,
        body: [
          { user_name: "Aron Freyr Kristjánsson", score: 23 },
          { user_name: "Halla Björk Einarsdóttir", score: 11 },
        ],
      },
    ],
  },
};

export const Guest: Story = { parameters: { auth: "anonymous" } };
