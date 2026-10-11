import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ProgramsHeader } from "./ProgramsHeader";

const meta = {
  title: "Components/Dagskrárbanki/ProgramsHeader",
  component: ProgramsHeader,
  args: { onNewContent: fn(), canCreate: true, suspendedUntil: null },
  parameters: {
    docs: {
      description: {
        component:
          "The floating „Nýtt efni“ chooser anchor on the bank page. It is positioned fixed, so " +
          "look for it in the bottom-right corner of the canvas.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 360, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgramsHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPermission: Story = {
  name: "Disabled — no permission",
  args: { canCreate: false },
};

export const Suspended: Story = {
  name: "Disabled — in skammarkrók until a date",
  args: { suspendedUntil: "2026-11-14T00:00:00Z" },
};

export const SuspendedOpenEnded: Story = {
  name: "Disabled — open-ended skammarkrókur",
  args: { suspendedUntil: "open-ended" },
};
