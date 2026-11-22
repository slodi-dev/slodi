import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import VisionMission from "./VisionMission";

/**
 * Vision and mission cards. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/VisionMission",
  component: VisionMission,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VisionMission>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
