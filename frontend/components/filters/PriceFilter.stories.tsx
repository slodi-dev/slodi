import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import PriceFilter from "./PriceFilter";

const focusNote =
  "Known issue sc-549: the max-price field's focus style is `var(--sl-input-shadow-focus, …)`. " +
  "The token exists, so the fallback never applies, but it resolves to an invalid shadow " +
  "(`142 50% 32% / 0.3` is not a colour) and is dropped — focus shows only as a border change.";

const meta = {
  title: "Components/Síur/PriceFilter",
  component: PriceFilter,
  args: { freeOnly: false, maxPrice: undefined, onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [freeOnly, setFreeOnly] = useState(args.freeOnly);
    const [maxPrice, setMaxPrice] = useState(args.maxPrice);
    return (
      <PriceFilter
        {...args}
        freeOnly={freeOnly}
        maxPrice={maxPrice}
        onChange={(f, m) => {
          setFreeOnly(f);
          setMaxPrice(m);
          args.onChange(f, m);
        }}
      />
    );
  },
  parameters: { docs: { description: { component: focusNote } } },
} satisfies Meta<typeof PriceFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const MaxPrice: Story = {
  args: { maxPrice: 2500 },
  parameters: {
    docs: {
      description: {
        story: `${focusNote} Tab into the field in story \`components-síur-pricefilter--max-price\`.`,
      },
    },
  },
};

export const FreeOnly: Story = {
  name: "Free only (price field hidden)",
  args: { freeOnly: true },
};
