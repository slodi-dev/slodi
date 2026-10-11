import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SkeletonCard from "./SkeletonCard";

const meta = {
  title: "Design system/Primitives/SkeletonCard",
  component: SkeletonCard,
  // Clean under axe in all four forms: a new violation fails CI (docs/ui-quality-pipeline.md).
} satisfies Meta<typeof SkeletonCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export const Grid: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  ),
};
