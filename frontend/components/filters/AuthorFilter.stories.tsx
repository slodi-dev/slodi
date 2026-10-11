import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import AuthorFilter from "./AuthorFilter";
import { users } from "@/stories/fixtures";

const meta = {
  title: "Components/Síur/AuthorFilter",
  component: AuthorFilter,
  args: {
    value: "",
    onChange: fn(),
    suggestions: users.map((u) => u.name),
    defaultOpen: true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthorFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = { args: { value: "Sigríður Jónsdóttir" } };

export const Collapsed: Story = { args: { defaultOpen: false, value: "Gunnar Þór Ólafsson" } };
