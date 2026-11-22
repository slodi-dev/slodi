import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import QueueEmpty from "./QueueEmpty";

const meta = {
  title: "Components/Yfirferð/QueueEmpty",
  component: QueueEmpty,
  args: {
    filtered: false,
    done: 0,
    openReports: 0,
    onClearFilter: fn(),
    onShowReports: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QueueEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QueueClear: Story = { name: "Queue empty" };

export const ClearedThisSitting: Story = { args: { done: 37 } };

export const ClearedOne: Story = { name: "Cleared one (singular)", args: { done: 1 } };

export const FilteredEmpty: Story = { args: { filtered: true } };

export const WithOpenReports: Story = { args: { done: 12, openReports: 5, filtered: true } };

export const LargeNumbers: Story = { args: { done: 5003, openReports: 1204 } };
