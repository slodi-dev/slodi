import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TagRequestError } from "@/services/tags.service";
import TagDeleteDialog from "./TagDeleteDialog";
import { SAMPLE_TAGS } from "./tagStoryMocks";

const meta = {
  title: "Components/Stjórnun/TagDeleteDialog",
  component: TagDeleteDialog,
  args: {
    tag: SAMPLE_TAGS[0],
    usageCount: 23,
    onCancel: fn(),
    onConfirm: fn(async () => {}),
  },
  parameters: {
    docs: {
      description: {
        component:
          "Confirms deleting a merkimiði, which the backend can't undo (UX rule 5). Names the " +
          "tag and how many items lose it; „Hætta við“ comes first and quiet; an error keeps " +
          "the dialog open.",
      },
    },
  },
} satisfies Meta<typeof TagDeleteDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Unused: Story = { args: { usageCount: 0 } };

export const CountUnknown: Story = { args: { usageCount: null } };

export const Failed: Story = {
  args: { onConfirm: fn(async () => Promise.reject(new TagRequestError(500, "Villa"))) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Eyða merkimiða" }));
    await expect(await canvas.findByText(/Ekki tókst að eyða merkimiðanum/)).toBeInTheDocument();
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
  },
};
