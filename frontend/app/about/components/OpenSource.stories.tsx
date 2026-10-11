import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import OpenSource from "./OpenSource";

/**
 * Why Slóði is open source, and how to contribute. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/OpenSource",
  component: OpenSource,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OpenSource>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
