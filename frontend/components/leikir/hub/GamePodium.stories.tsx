import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GamePodium from "./GamePodium";

const SCORES = /\/api\/leikir\/[^/]+\/scores/;

const meta = {
  title: "Components/Leikir/Hub/GamePodium",
  component: GamePodium,
  args: { slug: "horpuhopp" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GamePodium>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  parameters: {
    mockApi: [
      {
        match: SCORES,
        body: [
          { user_name: "Sigríður Jónsdóttir", score: 18420 },
          { user_name: "Gunnar Þór Ólafsson", score: 12007 },
          { user_name: "Aron Freyr Kristjánsson", score: 950 },
          { user_name: "Fjórði sæti sést ekki", score: 10 },
        ],
      },
    ],
  },
};

export const SingleEntry: Story = {
  parameters: {
    mockApi: [{ match: SCORES, body: [{ user_name: "Halla Björk Einarsdóttir", score: 42 }] }],
  },
};

/** Skeleton rows while the scores request is pending. */
export const Loading: Story = {
  parameters: { mockApi: [{ match: SCORES, body: [], delay: Infinity }] },
};

export const Empty: Story = {
  parameters: { mockApi: [{ match: SCORES, body: [] }] },
};

/** On error the podium renders nothing, by design — the hub card must not break. */
export const FetchError: Story = {
  parameters: { mockApi: [{ match: SCORES, status: 500, body: { detail: "Villa" } }] },
};

export const LongNames: Story = {
  parameters: {
    mockApi: [
      {
        match: SCORES,
        body: [
          { user_name: "Guðmundur Hrafnkell Þorvaldsson Kjerúlf", score: 1234567 },
          { user_name: "Sigurbjörg Ástríður Hallgrímsdóttir", score: 987654 },
          { user_name: "Æ", score: 3 },
        ],
      },
    ],
  },
};
