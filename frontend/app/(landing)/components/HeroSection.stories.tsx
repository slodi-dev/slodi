import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import HeroSection from "./HeroSection";

const meta = {
  title: "Components/Forsíða/HeroSection",
  component: HeroSection,
  args: { onEmailSignupClick: fn() },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HeroSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Without a handler the signup button renders but does nothing. */
export const WithoutSignupHandler: Story = { args: { onEmailSignupClick: undefined } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
