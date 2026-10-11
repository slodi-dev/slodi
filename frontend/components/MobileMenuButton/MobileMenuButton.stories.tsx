import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { MobileMenuButton } from "./MobileMenuButton";

const meta = {
  title: "Components/Shared/MobileMenuButton",
  component: MobileMenuButton,
  args: { isOpen: false, onClick: fn() },
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
  parameters: {
    docs: {
      description: {
        story:
          "Known issue sc-549 (story `components-shared-mobilemenubutton--toggle`): tab to the " +
          "button. `:focus-visible` sets `outline: none` and `box-shadow: var(--sl-shadow-focus)`, " +
          "which is invalid (`--sl-color-focus-ring` is a bare `142 50% 42% / 0.3`), so the " +
          "focus ring is invisible.",
      },
    },
  },
};
