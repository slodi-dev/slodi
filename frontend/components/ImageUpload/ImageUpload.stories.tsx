import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { placeholderImage } from "@/stories/fixtures";
import ImageUpload from "./ImageUpload";

/**
 * Picking a file uploads it to Azure through a signed URL, which Storybook does
 * not mock — so the stories cover the idle, filled, disabled and broken-preview
 * states, not a live upload.
 */
const meta = {
  title: "Components/Shared/ImageUpload",
  component: ImageUpload,
  args: { value: "", onChange: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Design-token audit finding: `ImageUpload.module.css` uses a literal `hsl(0 …)` colour " +
          "instead of a `--sl-color-*` token.",
      },
    },
  },
} satisfies Meta<typeof ImageUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithImage: Story = {
  args: { value: placeholderImage("Kötturinn og músin") },
};

export const Disabled: Story = { args: { disabled: true } };

export const DisabledWithImage: Story = {
  args: { disabled: true, value: placeholderImage("Ratleikur", 177) },
};

export const BrokenPreview: Story = {
  args: { value: "data:image/png;base64,AAAA" },
};

export const CustomLabelAndHint: Story = {
  args: {
    label: "Forsíðumynd",
    hint: "Mynd sem sýnir skátana í verki virkar best — mest 5 MB",
  },
};

export const Clearable: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(placeholderImage("Hnútakeppni", 30));
    return <ImageUpload {...args} value={value} onChange={setValue} />;
  },
};
