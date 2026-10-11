import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import EquipmentFilter from "./EquipmentFilter";

const items = ["Áttavitar", "Kort af hverfinu", "Sjúkrakassi", "Teygjubindi", "Vasaljós", "Reipi"];

const meta = {
  title: "Components/Síur/EquipmentFilter",
  component: EquipmentFilter,
  args: { availableItems: items, selected: [], onChange: fn(), defaultOpen: true },
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
      <EquipmentFilter
        {...args}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          args.onChange(next);
        }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "Type a name and press Enter, or pick from the browser's datalist. The selection is shown " +
          "as chips in ActiveFilterBar, not here — this component only shows the count badge.",
      },
    },
  },
} satisfies Meta<typeof EquipmentFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const WithSelection: Story = { args: { selected: ["Áttavitar", "Vasaljós"] } };

export const NoSuggestions: Story = { args: { availableItems: [] } };
