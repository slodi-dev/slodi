import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CollapsibleSection from "./CollapsibleSection";

const options = ["Drekaskátar", "Fálkaskátar", "Dróttskátar", "Rekkaskátar", "Róverskátar"];

const meta = {
  title: "Design system/Primitives/CollapsibleSection",
  component: CollapsibleSection,
  args: {
    label: "Aldurshópur",
    children: (
      <div style={{ display: "grid", gap: "0.25rem" }}>
        {options.map((o) => (
          <label key={o}>
            <input type="checkbox" /> {o}
          </label>
        ))}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

export const WithActiveCount: Story = { args: { activeCount: 2, defaultOpen: true } };

export const LongLabel: Story = {
  args: { label: "Undirbúningstími foringja fyrir fundinn", activeCount: 12 },
};
