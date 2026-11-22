import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import HorpuhoppGame from "./HorpuhoppGame";

/**
 * Minimal story: the game is a canvas driven by `gameEngine.ts` in a
 * requestAnimationFrame loop, so it has no props-driven states to show. Click
 * the canvas and use ← → or A / D to play; sprites come from
 * `public/leikir/horpuhopp/`.
 */
const meta = {
  title: "Components/Leikir/Hörpuhopp/HorpuhoppGame",
  component: HorpuhoppGame,
  args: {
    onGameOver: fn(),
    onRestart: fn(),
  },
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "640px" } },
  },
  decorators: [
    (Story) => (
      <div style={{ height: 600, display: "flex" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HorpuhoppGame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playable: Story = {};
