import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ActiveFilterBar from "./ActiveFilterBar";

const meta = {
  title: "Components/Síur/ActiveFilterBar",
  component: ActiveFilterBar,
  args: {
    onClearAll: fn(),
    chips: [
      { key: "search", label: "„ratleikur“", remove: fn() },
      { key: "age-Drekaskátar", label: "Drekaskátar", remove: fn() },
      { key: "tag-útivist", label: "útivist", remove: fn() },
      { key: "duration", label: "30–60 mín", remove: fn() },
    ],
  },
} satisfies Meta<typeof ActiveFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleChip: Story = {
  args: { chips: [{ key: "free", label: "Kostnaðarlaust", remove: fn() }] },
};

export const NoFilters: Story = {
  name: "No filters (renders nothing)",
  args: { chips: [] },
};

export const ManyChips: Story = {
  name: "Many chips (wrapping)",
  args: {
    chips: [
      "Hrefnuskátar",
      "Drekaskátar",
      "Fálkaskátar",
      "Dróttskátar",
      "útivist",
      "rötun",
      "hópefli",
      "Heiðmörk, upphaf við bílastæðið hjá Elliðavatnsbæ",
      "Upp að 2.500 kr.",
    ].map((label) => ({ key: label, label, remove: fn() })),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};
