import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CollapsibleSection from "./CollapsibleSection";
import filterStyles from "@/components/filters/filters.module.css";

const options = ["Drekaskátar", "Fálkaskátar", "Dróttskátar", "Rekkaskátar", "Róverskátar"];

const meta = {
  title: "Design system/Primitives/CollapsibleSection",
  component: CollapsibleSection,
  args: {
    label: "Aldurshópur",
    children: (
      // The real filter checkboxes, so the story shows what the filter sidebar shows.
      <div className={filterStyles.checkboxGroup}>
        {options.map((o) => (
          <label key={o} className={filterStyles.checkboxLabel}>
            <input type="checkbox" className={filterStyles.checkbox} />
            {o}
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
