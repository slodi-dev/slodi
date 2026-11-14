import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import PrepTimeFilter from "./PrepTimeFilter";

const meta = {
  title: "Components/Síur/PrepTimeFilter",
  component: PrepTimeFilter,
  args: { minValue: undefined, maxValue: undefined, onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PrepTimeFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Range: Story = {
  args: { minValue: 15, maxValue: 45 },
};

export const MinimumOnly: Story = { args: { minValue: 10 } };
