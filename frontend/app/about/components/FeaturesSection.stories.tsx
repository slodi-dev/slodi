import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import FeaturesSection from "./FeaturesSection";

/**
 * Main features grid, with lucide icons. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/FeaturesSection",
  component: FeaturesSection,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FeaturesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
