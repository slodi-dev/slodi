import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import LocationFilter from "./LocationFilter";

const suggestions = ["Skátaheimilið", "Íþróttasalur eða tún", "Heiðmörk", "Úlfljótsvatn"];

const meta = {
  title: "Components/Síur/LocationFilter",
  component: LocationFilter,
  args: { value: "", onChange: fn(), suggestions, defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LocationFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = { args: { value: "Úlfljótsvatn" } };

export const LongValue: Story = {
  args: { value: "Heiðmörk, upphaf við bílastæðið hjá Elliðavatnsbæ" },
};
