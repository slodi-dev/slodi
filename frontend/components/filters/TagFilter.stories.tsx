import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import TagFilter from "./TagFilter";
import { tags } from "@/stories/fixtures";

const meta = {
  title: "Components/Síur/TagFilter",
  component: TagFilter,
  args: {
    availableTags: tags.map((t) => t.name),
    selected: [],
    onChange: fn(),
    defaultOpen: true,
  },
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
      <TagFilter
        {...args}
        selected={selected}
        onChange={(next) => {
          setSelected(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof TagFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const WithSelection: Story = { args: { selected: ["útivist", "rötun"] } };

export const NoTags: Story = {
  name: "Empty — no tags in the bank",
  args: { availableTags: [] },
};

export const LongTagNames: Story = {
  args: {
    availableTags: [
      "skyndihjálp og öryggi í útivist",
      "náttúruvernd og umhverfismál",
      "alþjóðastarf",
      "sköpun",
    ],
  },
};
