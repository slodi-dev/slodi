import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { ALL_GAMES, type GameDef } from "@/lib/leikir-games";
import GameCard from "./GameCard";

// ALL_GAMES, not GAMES: NoLeaderboard uses Heiðursorðla, which the hub hides
// while HEIDURSORDLA_ENABLED is off (lib/feature-flags.ts).
const bySlug = (slug: string) => ALL_GAMES.find((g) => g.slug === slug) as GameDef;

const podiumScores: MockRoute = {
  match: /\/api\/leikir\/[^/]+\/scores/,
  body: [
    { user_name: "Sigríður Jónsdóttir", score: 18420 },
    { user_name: "Gunnar Þór Ólafsson", score: 12007 },
    { user_name: "Aron Freyr Kristjánsson", score: 950 },
  ],
};

const meta = {
  title: "Components/Leikir/Hub/GameCard",
  component: GameCard,
  args: { game: bySlug("horpuhopp") },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A card on the /leikir hub. Live games link to their page; scored games show a top-3 " +
          "podium (`GamePodium`) fed by `/api/leikir/{slug}/scores`.",
      },
    },
  },
} satisfies Meta<typeof GameCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A scored game with a populated podium. */
export const WithPodium: Story = {
  parameters: {
    mockApi: [podiumScores],
    docs: {
      description: {
        story:
          "Related to sc-549 (story `components-leikir-hub-gamecard--with-podium`): Tab onto the " +
          "card — the focus outline is `--sl-color-focus-ring`, primary at 30% alpha, which is " +
          "hard to see on the tinted cover.",
      },
    },
  },
};

/** A scored game nobody has played yet — default mock returns an empty board. */
export const EmptyPodium: Story = {};

/**
 * Heiðursorðla has its own daily board, so it shows no podium. The game is hidden
 * from the hub for now (HEIDURSORDLA_ENABLED); this keeps the card variant covered.
 */
export const NoLeaderboard: Story = { args: { game: bySlug("heidursordla") } };

export const ArnorClicker: Story = {
  args: { game: bySlug("arnor-clicker") },
  parameters: { mockApi: [podiumScores] },
};

export const LaddiBird: Story = {
  args: { game: bySlug("laddi-bird") },
  parameters: { mockApi: [podiumScores] },
};

/** A game that is announced but not playable: no link, a "Kemur bráðum" pill. */
export const ComingSoon: Story = {
  args: {
    game: {
      slug: "hnutaleikur",
      name: "Hnútaleikurinn",
      tagline: "Hnýttu pelastikk, réttan hnút og hestahnút áður en tíminn rennur út.",
      emblem: "🪢",
      emblemKind: "glyph",
      accent: "rekkar",
      status: "soon",
      hasLeaderboard: false,
    },
  },
};

export const LongText: Story = {
  args: {
    game: {
      ...bySlug("laddi-bird"),
      name: "Laddí-bird: Endurkoma lagapípanna á Skátaþingi",
      tagline:
        "Leikur frá Skátaþingi 2023 þar sem þú leikur LagaLadda og reynir að fljúga í gegnum " +
        "lagapípur skátaþings, forðast breytingartillögur og ná í mark áður en fundi er slitið.",
    },
  },
  parameters: { mockApi: [podiumScores] },
};
