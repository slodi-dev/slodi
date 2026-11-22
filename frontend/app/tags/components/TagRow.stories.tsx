import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { tags } from "@/stories/fixtures";
import TagRow from "./TagRow";

const meta = {
  title: "Components/Stjórnun/TagRow",
  component: TagRow,
  args: {
    tag: tags[0],
    isEditing: false,
    isDeleting: false,
    contentCount: 12,
    onEdit: fn(),
    onRequestDelete: fn(),
    onSave: fn(async () => {}),
    onDelete: fn(async () => {}),
    onCancel: fn(),
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
          "One row of the tag table: view, edit and confirm-delete states. Known issue sc-549 " +
          "(story `components-stjórnun-tagrow--editing`): the edit input's focus ring uses " +
          "`--sl-input-shadow-focus`, which resolves to an invalid box-shadow.",
      },
    },
  },
} satisfies Meta<typeof TagRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Unused: Story = { args: { contentCount: 0 } };

export const CountUnknown: Story = { args: { contentCount: undefined } };

export const Editing: Story = { args: { isEditing: true } };

export const ConfirmDelete: Story = { args: { isDeleting: true } };

export const ConfirmDeleteUnused: Story = { args: { isDeleting: true, contentCount: 0 } };

export const LongName: Story = {
  args: {
    tag: { id: "t-long", name: "samfélagsverkefni-og-umhverfisvernd-í-nærumhverfinu-2026" },
  },
};
