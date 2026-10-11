import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TimelineSection from "./TimelineSection";

/**
 * Project timeline. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/TimelineSection",
  component: TimelineSection,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TimelineSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
