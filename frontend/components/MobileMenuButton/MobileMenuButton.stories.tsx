import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { MobileMenuButton } from "./MobileMenuButton";

const meta = {
  title: "Components/Sameiginlegt/MobileMenuButton",
  component: MobileMenuButton,
  args: { isOpen: false, onClick: fn() },
  // The button only exists below 768px (it is `display: none` on desktop), so its stories
  // open at phone width. At desktop width the canvas is empty on purpose.
  globals: { viewport: { value: "phone" } },
} satisfies Meta<typeof MobileMenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { isOpen: true } };

export const Toggle: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return <MobileMenuButton isOpen={open} onClick={() => setOpen((o) => !o)} />;
  },
};
