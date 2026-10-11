import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import NextPuzzleCountdown from "./NextPuzzleCountdown";

// Relative to when the story loads, so the clock is always ticking.
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const meta = {
  title: "Components/Leikir/Heiðursorðla/NextPuzzleCountdown",
  component: NextPuzzleCountdown,
  args: {
    targetIso: inHours(5.5),
    onExpire: fn(),
  },
} satisfies Meta<typeof NextPuzzleCountdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AlmostThere: Story = { args: { targetIso: inHours(10 / 3600) } };

/** Target already passed: shows 00:00:00 and calls `onExpire` once. */
export const Expired: Story = { args: { targetIso: inHours(-1) } };

export const CustomLabel: Story = {
  args: { label: "Skátaþingsorðla opnar eftir", targetIso: inHours(26) },
};
