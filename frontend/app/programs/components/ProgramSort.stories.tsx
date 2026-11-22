import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import ProgramSort, { type SortOption } from "./ProgramSort";

const meta = {
  title: "Components/Dagskrárbanki/ProgramSort",
  component: ProgramSort,
  args: { value: "newest", onChange: fn() },
  argTypes: {
    value: { control: "select", options: ["newest", "oldest", "most-liked", "alphabetical"] },
  },
} satisfies Meta<typeof ProgramSort>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Newest: Story = {};

export const MostLiked: Story = { args: { value: "most-liked" } };

export const Interactive: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<SortOption>(args.value);
    return (
      <ProgramSort
        {...args}
        value={value}
        onChange={(v) => {
          setValue(v);
          args.onChange(v);
        }}
      />
    );
  },
};
