import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ParticipantFilter from "./ParticipantFilter";

const meta = {
  title: "Components/Síur/ParticipantFilter",
  component: ParticipantFilter,
  args: { minValue: undefined, maxValue: undefined, onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParticipantFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Range: Story = {
  args: { minValue: 8, maxValue: 24 },
};

export const MinimumOnly: Story = { args: { minValue: 10 } };
