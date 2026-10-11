import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ItemFacts from "./ItemFacts";
import { programKotturinn, programLongText, programSkyndihjalp } from "@/stories/fixtures";
import { KIND_COPY } from "../kind";

const meta = {
  title: "Components/Efnissíða/ItemFacts",
  component: ItemFacts,
  args: {
    program: programKotturinn,
    typeLabel: KIND_COPY.program.definite,
    onPrint: fn(),
    onReport: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemFacts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const AwaitingReview: Story = {
  args: { program: { ...programKotturinn, review_state: "unreviewed" } },
};

export const Rejected: Story = {
  args: { program: programSkyndihjalp, typeLabel: KIND_COPY.task.definite },
};

export const Hidden: Story = {
  args: {
    program: {
      ...programKotturinn,
      hidden_at: "2026-10-01T09:00:00Z",
      review_state: "rejected",
      review_note: "Falið eftir tilkynningu um óöruggar aðstæður.",
    },
  },
};

export const NoFacts: Story = {
  name: "No facts (panel shows provenance only)",
  args: {
    program: {
      ...programKotturinn,
      duration_min: null,
      duration_max: null,
      prep_time_min: null,
      prep_time_max: null,
      age: [],
      location: null,
      count_min: null,
      count_max: null,
      price: null,
      review_state: null,
    },
  },
};

export const ViewerWithoutActions: Story = {
  name: "Public viewer (no review state, no actions)",
  args: {
    program: { ...programKotturinn, review_state: null },
    onPrint: undefined,
    onReport: undefined,
  },
};

export const LongText: Story = {
  args: { program: { ...programLongText, review_state: null } },
};
