import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HowItWorks from "./HowItWorks";

/**
 * How Slóði works, as a list of feature cards. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/HowItWorks",
  component: HowItWorks,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HowItWorks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
