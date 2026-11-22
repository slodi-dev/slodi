import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import DecisionModal from "./DecisionModal";

const meta = {
  title: "Components/Yfirferð/DecisionModal",
  component: DecisionModal,
  args: {
    action: "needs_changes",
    authorName: "Sigríður Jónsdóttir",
    note: "Gætirðu bætt við leiðbeiningum um framkvæmdina? Það vantar líka aldursbil.",
    sending: false,
    onConfirm: fn(),
    onClose: fn(),
  },
  parameters: { auth: "moderator" },
} satisfies Meta<typeof DecisionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsChanges: Story = { name: "Þarfnast lagfæringar" };

export const Reject: Story = { name: "Hafna", args: { action: "reject" } };

export const ToAuthor: Story = { name: "Senda höfundi", args: { action: "to_author" } };

export const Sending: Story = { args: { sending: true } };
