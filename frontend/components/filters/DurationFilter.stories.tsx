import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import DurationFilter from "./DurationFilter";

const meta = {
  title: "Components/Síur/DurationFilter",
  component: DurationFilter,
  args: { minValue: undefined, maxValue: undefined, onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DurationFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Range: Story = {
  args: { minValue: 30, maxValue: 60 },
};

export const MinimumOnly: Story = { args: { minValue: 90 } };
