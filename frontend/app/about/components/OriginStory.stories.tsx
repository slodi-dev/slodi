import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import OriginStory from "./OriginStory";

/**
 * Why Slóði exists: the problems leaders had with the old dagskrárvefur. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/OriginStory",
  component: OriginStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OriginStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
