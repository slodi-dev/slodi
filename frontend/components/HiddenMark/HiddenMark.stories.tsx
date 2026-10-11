import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HiddenChip, hiddenDimClass } from "./HiddenMark";

/**
 * How a hidden item is marked for the people who can still see it
 * (Dagskrárstjórnarteymið, platform admins and the item's author): the
 * "Falið" chip, plus greyed-out imagery and heading.
 */
const meta = {
  title: "Components/Sameiginlegt/HiddenMark",
  component: HiddenChip,
} satisfies Meta<typeof HiddenChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chip: Story = {};

export const DimmedItem: Story = {
  name: "Chip with a dimmed item",
  render: () => (
    <div style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
      <div
        className={hiddenDimClass}
        style={{
          height: 120,
          borderRadius: 8,
          background: "hsl(var(--sl-color-primary))",
        }}
      />
      <h3 className={hiddenDimClass} style={{ margin: 0 }}>
        Kötturinn og músin
      </h3>
      <HiddenChip />
    </div>
  ),
};
