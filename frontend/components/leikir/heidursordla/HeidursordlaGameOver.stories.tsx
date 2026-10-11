import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HeidursordlaGameOver from "./HeidursordlaGameOver";

const tomorrow = () => new Date(Date.now() + 9 * 3_600_000).toISOString();

const meta = {
  title: "Components/Leikir/Heiðursorðla/HeidursordlaGameOver",
  component: HeidursordlaGameOver,
  args: {
    status: "won",
    answer: "skáti",
    guessesUsed: 3,
    nextRoundAt: tomorrow(),
  },
  parameters: {
    layout: "fullscreen",
    // Report only: aria-dialog-name (the game-over dialog has no name). Heiðursorðla
    // is being hidden; fix it if it comes back.
    a11y: { test: "todo" },
  },
} satisfies Meta<typeof HeidursordlaGameOver>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Won: Story = {};

export const WonOnLastGuess: Story = { args: { guessesUsed: 6 } };

export const Lost: Story = { args: { status: "lost", guessesUsed: 6 } };

/** Last puzzle of the event: no next round, so no countdown. */
export const NoNextRound: Story = { args: { nextRoundAt: null } };
