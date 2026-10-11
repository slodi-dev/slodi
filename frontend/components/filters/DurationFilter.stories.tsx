import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import DurationFilter from "./DurationFilter";

const focusNote =
  "Known issue sc-549: these fields use RangeInput, whose focus ring is " +
  "`var(--sl-input-shadow-focus)`. That token resolves to `0 0 0 3px 142 50% 42% / 0.3` — not a " +
  "colour — so the box-shadow is dropped and keyboard focus shows only as a border-colour change.";

const meta = {
  title: "Components/Síur/DurationFilter",
  component: DurationFilter,
  args: { minValue: undefined, maxValue: undefined, onChange: fn(), defaultOpen: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  parameters: { docs: { description: { component: focusNote } } },
} satisfies Meta<typeof DurationFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Range: Story = {
  args: { minValue: 30, maxValue: 60 },
  parameters: {
    docs: {
      description: {
        story: `${focusNote} Tab into a field in story \`components-síur-durationfilter--range\` to see it.`,
      },
    },
  },
};

export const MinimumOnly: Story = { args: { minValue: 90 } };
