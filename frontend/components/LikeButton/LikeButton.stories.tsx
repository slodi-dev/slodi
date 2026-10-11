import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { programKotturinn } from "@/stories/fixtures";
import LikeButton from "./LikeButton";

/**
 * Likes live in LikesContext (the real provider wraps every story); the
 * like/unlike request is answered by the Storybook fetch mock.
 */
const meta = {
  title: "Components/Sameiginlegt/LikeButton",
  component: LikeButton,
  args: {
    programId: programKotturinn.id,
    initialLikeCount: programKotturinn.like_count,
    size: "medium",
    showCount: true,
  },
  argTypes: {
    size: { control: "inline-radio", options: ["small", "medium", "large"] },
  },
} satisfies Meta<typeof LikeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "small" } };
export const Large: Story = { args: { size: "large" } };
export const WithoutCount: Story = { args: { showCount: false } };

export const ZeroLikes: Story = { args: { programId: "p-zero", initialLikeCount: 0 } };

export const LargeCount: Story = { args: { programId: "p-many", initialLikeCount: 1048 } };

export const Liked: Story = {
  args: { programId: "p-liked" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-pressed", "true");
  },
};

const failingLike: MockRoute[] = [
  { match: /\/likes/, status: 500, body: { detail: "Villa á netþjóni" } },
];

export const RollsBackOnError: Story = {
  args: { programId: "p-error" },
  parameters: {
    mockApi: failingLike,
    docs: {
      description: {
        story:
          "The like request fails, so the optimistic update is rolled back: the heart fills " +
          "and then empties again.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await userEvent.click(button);
  },
};
