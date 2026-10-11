import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { tags } from "@/stories/fixtures";
import TagPicker from "./TagPicker";

type Props = React.ComponentProps<typeof TagPicker>;

function Stateful(props: Props) {
  const [selected, setSelected] = useState(props.selected);
  return (
    <TagPicker
      {...props}
      selected={selected}
      onToggle={(tag) => {
        props.onToggle(tag);
        setSelected((prev) =>
          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
      }}
    />
  );
}

const names = tags.map((t) => t.name);

const meta = {
  title: "Components/Búa til/TagPicker",
  component: TagPicker,
  render: (args) => <Stateful {...args} />,
  args: {
    available: names,
    selected: ["útivist", "rötun"],
    onToggle: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Listbox for merkimiðar. Known issue sc-549 (story " +
          "`components-búa-til-tagpicker--default`): the picker's `:focus-within` ring uses " +
          "`--sl-shadow-focus`, which resolves to an invalid box-shadow, so focusing the search " +
          "field shows only the border-colour change.",
      },
    },
  },
} satisfies Meta<typeof TagPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoneSelected: Story = { args: { selected: [] } };

export const EmptyVocabulary: Story = { args: { available: [], selected: [] } };

export const LongVocabulary: Story = {
  args: {
    available: [
      ...names,
      "kvöldvaka",
      "söngur",
      "eldamennska",
      "hnútar",
      "sund",
      "fjallganga",
      "útilega",
      "vetrarstarf",
      "umhverfisvernd",
      "samfélagsverkefni",
      "alþjóðastarf",
      "leiðtogaþjálfun",
    ],
    selected: ["útivist", "hnútar", "leiðtogaþjálfun"],
  },
};
