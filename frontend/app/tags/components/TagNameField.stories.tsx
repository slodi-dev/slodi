import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import TagNameField from "./TagNameField";

const meta = {
  title: "Components/Stjórnun/TagNameField",
  component: TagNameField,
  args: {
    label: "Nýtt nafn á „Hnútar“",
    initialValue: "Hnútar",
    submitLabel: "Vista",
    busyLabel: "Vista…",
    validate: (name: string) => (name.trim() ? null : "Skrifaðu nafn á merkimiðanum."),
    onSubmit: fn(async () => null),
    onCancel: fn(),
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
          "The name field behind create and rename: a counter from 45 of 50 characters, an " +
          "inline announced error with `aria-invalid`, and only the button disabled while saving.",
      },
    },
  },
} satisfies Meta<typeof TagNameField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByLabelText("Nýtt nafn á „Hnútar“");
    await userEvent.clear(field);
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByText("Skrifaðu nafn á merkimiðanum.")).toBeInTheDocument();
    await expect(field).toHaveAttribute("aria-invalid", "true");
  },
};
