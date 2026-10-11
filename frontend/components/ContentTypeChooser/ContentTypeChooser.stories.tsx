import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import ContentTypeChooser from "./ContentTypeChooser";

const meta = {
  title: "Components/Búa til/ContentTypeChooser",
  component: ContentTypeChooser,
  args: { onChoose: fn() },
  decorators: [
    (Story) => (
      // The launcher is a floating ball anchored bottom-right; give it room.
      <div style={{ position: "relative", minHeight: 420 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The bank's create launcher: asks *what are you making?* before anything else. " +
          "Clean in the design-token audit — use its CSS as the reference for new components.",
      },
    },
  },
} satisfies Meta<typeof ContentTypeChooser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Bæta við í bankann/ }));
    await expect(await canvas.findByRole("menu")).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    disabledReason:
      "Aðgangur þinn er í biðstöðu til 14. október 2026 og þú getur ekki bætt við efni.",
  },
};
