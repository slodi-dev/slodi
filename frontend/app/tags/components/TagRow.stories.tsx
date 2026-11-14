import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import TagRow from "./TagRow";
import { SAMPLE_TAGS } from "./tagStoryMocks";

const meta = {
  title: "Components/Stjórnun/TagRow",
  component: TagRow,
  args: {
    tag: SAMPLE_TAGS[0],
    usageCount: 23,
    isEditing: false,
    onEdit: fn(),
    onCancelEdit: fn(),
    validateName: () => null,
    onRename: fn(async () => {}),
    onRequestDelete: fn(),
  },
  decorators: [
    (Story) => (
      <ul style={{ listStyle: "none", padding: 0, maxWidth: 640 }}>
        <Story />
      </ul>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "One tag on the tag page: its name and how many items use it, renamed in place. " +
          "„Eyða“ opens the page's confirmation dialog.",
      },
    },
  },
} satisfies Meta<typeof TagRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The search text marked in the name. */
export const SearchHit: Story = { args: { query: "líf" } };

/** Exactly what was typed in the field: highlighted and marked „Er til“. */
export const ExactMatch: Story = { args: { query: "Útilíf", isMatch: true } };

export const Unused: Story = { args: { usageCount: 0 } };

export const CountUnknown: Story = { args: { usageCount: null } };

export const Editing: Story = { args: { isEditing: true } };

export const LongName: Story = {
  args: { tag: SAMPLE_TAGS[12], usageCount: 2 },
};
