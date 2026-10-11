import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import SearchInput from "./SearchInput";

const meta = {
  title: "Components/Síur/SearchInput",
  component: SearchInput,
  args: { value: "", onChange: fn() },
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
          "Debounced (300 ms) search box for the bank. The clear button appears with text.",
      },
    },
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithQuery: Story = { args: { value: "ratleikur" } };

export const CustomPlaceholder: Story = { args: { placeholder: "Leita í möppunni minni" } };

export const LongQuery: Story = {
  args: { value: "næturganga um Heiðmörk með vasaljósum og stjörnuskoðun fyrir dróttskáta" },
};
