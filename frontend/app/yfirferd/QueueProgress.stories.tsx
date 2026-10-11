import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import QueueProgress from "./QueueProgress";

const meta = {
  title: "Components/Yfirferð/QueueProgress",
  component: QueueProgress,
  args: { done: 12, waiting: 38, loaded: 20 },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QueueProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const JustStarted: Story = { args: { done: 0, waiting: 50, loaded: 25 } };

export const BatchCleared: Story = { args: { done: 25, waiting: 0, loaded: 0 } };

export const HugeQueue: Story = {
  name: "Huge queue (Icelandic thousands separator)",
  args: { done: 41, waiting: 5002, loaded: 9 },
};

export const NothingAtAll: Story = {
  name: "Nothing done, nothing waiting (renders nothing)",
  args: { done: 0, waiting: 0, loaded: 0 },
};
