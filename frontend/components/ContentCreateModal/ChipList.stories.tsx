import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { tags } from "@/stories/fixtures";
import ChipList from "./ChipList";

type Props = React.ComponentProps<typeof ChipList>;

/** ChipList is controlled; this keeps the items in story state so add/remove work. */
function Stateful(props: Props) {
  const [items, setItems] = useState(props.items);
  return (
    <ChipList
      {...props}
      items={items}
      onAdd={(v) => {
        props.onAdd(v);
        setItems((prev) => [...prev, v]);
      }}
      onRemove={(v) => {
        props.onRemove(v);
        setItems((prev) => prev.filter((x) => x !== v));
      }}
    />
  );
}

const meta = {
  title: "Components/Búa til/ChipList",
  component: ChipList,
  render: (args) => <Stateful {...args} />,
  args: {
    label: "Búnaður",
    addLabel: "Bæta búnaði á lista",
    placeholder: "t.d. áttaviti",
    items: ["Kort af hverfinu", "Áttavitar", "Blýantar"],
    onAdd: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChipList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { items: [] } };

export const WithSuggestions: Story = {
  args: {
    label: "Merkimiðar",
    addLabel: "Bæta við merkimiða",
    placeholder: "Byrjaðu að skrifa…",
    items: ["útivist"],
    known: tags.map((t) => t.name),
  },
};

export const OnlyKnownValues: Story = {
  args: {
    label: "Merkimiðar",
    addLabel: "Bæta við merkimiða",
    placeholder: "Veldu úr lista",
    items: [],
    known: tags.map((t) => t.name),
    onlyKnown: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Type a value that is not in the list (e.g. „sund“) and press Enter: it is refused, " +
          "because the tag vocabulary is managed by Dagskrárstjórnarteymið.",
      },
    },
  },
};

export const LongItems: Story = {
  args: {
    items: [
      "Sjúkrakassi með teygjubindum, plástrum og sótthreinsiklútum",
      "Tveir lítrar af vatni á hvern þátttakanda",
      "Vasaljós",
      "Hlý föt",
      "Endurskinsvesti fyrir alla",
      "Talstöðvar",
    ],
  },
};
