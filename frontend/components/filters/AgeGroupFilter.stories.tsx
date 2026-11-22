import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import AgeGroupFilter from "./AgeGroupFilter";

const meta = {
  title: "Components/Síur/AgeGroupFilter",
  component: AgeGroupFilter,
  args: { selected: [], onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selected);
    return (
      <AgeGroupFilter
        {...args}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof AgeGroupFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const WithSelection: Story = {
  args: { selected: ["Drekaskátar", "Fálkaskátar"] },
};

export const Collapsed: Story = {
  args: { defaultOpen: false, selected: ["Rekkaskátar"] },
};
