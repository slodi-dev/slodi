import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ActiveChip from "./ActiveChip";

const meta = {
  title: "Design system/Primitives/ActiveChip",
  component: ActiveChip,
  args: { label: "Drekaskátar", onRemove: fn() },
} satisfies Meta<typeof ActiveChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongLabel: Story = {
  args: { label: "Staðsetning: Heiðmörk, upphaf við bílastæðið hjá Elliðavatnsbæ" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 260 }}>
        <Story />
      </div>
    ),
  ],
};

export const Row: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {["Drekaskátar", "útivist", "10–30 mín", "Ókeypis", "Leit: kötturinn"].map((label) => (
        <ActiveChip key={label} {...args} label={label} />
      ))}
    </div>
  ),
};
