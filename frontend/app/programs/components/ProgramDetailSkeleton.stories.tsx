import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgramDetailSkeleton } from "./ProgramDetailSkeleton";

const meta = {
  title: "Components/Dagskrárbanki/ProgramDetailSkeleton",
  component: ProgramDetailSkeleton,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Loading placeholder for the item page. It has no props and one state.",
      },
    },
  },
} satisfies Meta<typeof ProgramDetailSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
