import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AboutHero from "./AboutHero";

/**
 * Hero at the top of /about. Static content with no props or states, so a single story.
 */
const meta = {
  title: "Components/Um Slóða/AboutHero",
  component: AboutHero,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AboutHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
