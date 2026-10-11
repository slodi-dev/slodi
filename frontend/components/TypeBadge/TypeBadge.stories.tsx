import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TypeBadge from "./TypeBadge";

const meta = {
  title: "Design system/Primitives/TypeBadge",
  component: TypeBadge,
  args: { type: "program", size: "sm" },
  argTypes: {
    type: { control: "inline-radio", options: ["task", "event", "program"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
  // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
  parameters: { a11y: { test: "error" } },
} satisfies Meta<typeof TypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Program: Story = {};
export const Event: Story = { args: { type: "event" } };
export const Task: Story = { args: { type: "task" } };
export const Medium: Story = { args: { size: "md" } };

export const AllTypes: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {(["sm", "md"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <TypeBadge type="task" size={size} />
          <TypeBadge type="event" size={size} />
          <TypeBadge type="program" size={size} />
        </div>
      ))}
    </div>
  ),
};
