import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import ProgramGrid from "./ProgramGrid";
import { programs, userMember } from "@/stories/fixtures";

const meta = {
  title: "Components/Dagskrárbanki/ProgramGrid",
  component: ProgramGrid,
  args: {
    programs,
    isLoading: false,
    error: null,
    onRetry: fn(),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProgramGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { isLoading: true },
};

export const Empty: Story = {
  args: { programs: [] },
};

export const ErrorState: Story = {
  args: { error: "Ekki tókst að sækja dagskrárbankann. Athugaðu nettenginguna." },
};

export const ErrorWithoutRetry: Story = {
  args: { error: "Netþjónn svarar ekki.", onRetry: undefined },
};

export const OwnItemsEditable: Story = {
  args: {
    onEdit: fn(),
    onDelete: fn(),
    canEdit: (p) => p.author_id === userMember.id,
    canDelete: (p) => p.author_id === userMember.id,
  },
};

export const SingleItem: Story = {
  args: { programs: programs.slice(0, 1) },
};
