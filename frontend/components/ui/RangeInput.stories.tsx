import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import RangeInput from "./RangeInput";

const meta = {
  title: "Design system/Primitives/RangeInput",
  component: RangeInput,
  args: {
    minValue: undefined,
    maxValue: undefined,
    onMinChange: fn(),
    onMaxChange: fn(),
    minLabel: "Lágmarkstími í mínútum",
    maxLabel: "Hámarkstími í mínútum",
    minPlaceholder: "Frá",
    maxPlaceholder: "Til",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RangeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: { minValue: 10, maxValue: 30, hint: "10–30 mínútur" },
};

export const Interactive: Story = {
  render: function Render(args) {
    const [min, setMin] = useState<number | undefined>(15);
    const [max, setMax] = useState<number | undefined>(undefined);
    const hint =
      min === undefined && max === undefined
        ? "Hvaða lengd sem er"
        : `${min ?? 0}–${max ?? "∞"} mínútur`;
    return (
      <RangeInput
        {...args}
        minValue={min}
        maxValue={max}
        onMinChange={setMin}
        onMaxChange={setMax}
        hint={hint}
      />
    );
  },
};

export const FocusRing: Story = {
  args: { minValue: 10 },
  parameters: {
    docs: {
      description: {
        story:
          "Known issue sc-549 (story `design-system-primitives-rangeinput--focus-ring`): tab into " +
          "a field. `.rangeInputField:focus-visible` sets `outline: none` and relies on " +
          "`--sl-input-shadow-focus`, which resolves to `0 0 0 3px 142 50% 42% / 0.3` — not a " +
          "colour — so the box-shadow is dropped and there is no visible focus ring.",
      },
    },
  },
};
