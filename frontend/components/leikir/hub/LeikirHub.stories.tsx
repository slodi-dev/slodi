import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LeikirHub from "./LeikirHub";

const scores = {
  match: /\/api\/leikir\/[^/]+\/scores/,
  body: [
    { user_name: "Sigríður Jónsdóttir", score: 18420 },
    { user_name: "Gunnar Þór Ólafsson", score: 12007 },
    { user_name: "Aron Freyr Kristjánsson", score: 950 },
  ],
};

const meta = {
  title: "Components/Leikir/Hub/LeikirHub",
  component: LeikirHub,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The /leikir page body: a top bar showing who is playing, then one `GameCard` per " +
          "entry in `lib/leikir-games.ts`.",
      },
    },
  },
} satisfies Meta<typeof LeikirHub>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = { parameters: { auth: "member", mockApi: [scores] } };

/** No scores anywhere yet. */
export const EmptyBoards: Story = { parameters: { auth: "member" } };

export const Guest: Story = {
  parameters: {
    auth: "anonymous",
    mockApi: [scores],
    docs: {
      description: {
        story:
          "Related to sc-549 (story `components-leikir-hub-leikirhub--guest`): Tab to " +
          '"Skrá inn" — its outline is `--sl-color-focus-ring` (primary at 30% alpha) and ' +
          "barely visible.",
      },
    },
  },
};

export const LoadingUser: Story = { parameters: { auth: "loading", mockApi: [scores] } };
