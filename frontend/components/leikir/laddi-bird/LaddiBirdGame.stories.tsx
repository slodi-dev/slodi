import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import LaddiBirdGame from "./LaddiBirdGame";

/**
 * Minimal story: a canvas driven by `gameEngine.ts` in a requestAnimationFrame
 * loop, with no props-driven states. Click the canvas and press Space or ↑ to
 * fly. Sound starts only after that first gesture (Web Audio rules).
 */
const meta = {
  title: "Components/Leikir/Laddí-bird/LaddiBirdGame",
  component: LaddiBirdGame,
  args: {
    onGameOver: fn(),
    onRestart: fn(),
    onRunStart: fn(),
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
} satisfies Meta<typeof LaddiBirdGame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playable: Story = {};
