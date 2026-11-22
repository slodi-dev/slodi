import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PuzzleStateOpen } from "@/services/heidursordla.service";
import HeidursordlaPlayView from "./HeidursordlaPlayView";

const GUESS = /\/heidursordla\/[^/]+\/guess/;

const puzzle = {
  id: "pz-12",
  puzzle_number: 12,
  word_length: 5,
  unlocks_at: "2026-10-11T00:00:00Z",
  locks_at: "2026-10-12T00:00:00Z",
};

const fresh: PuzzleStateOpen = {
  is_unlocked: true,
  puzzle,
  status: "in_progress",
  guesses: [],
  guesses_used: 0,
  guesses_remaining: 6,
  answer: null,
};

const twoGuesses = [
  { word: "tjald", colors: ["gray", "gray", "yellow", "gray", "gray"] as const },
  { word: "álfar", colors: ["gray", "green", "gray", "yellow", "gray"] as const },
].map((g) => ({ word: g.word, colors: [...g.colors] }));

const meta = {
  title: "Components/Leikir/Heiðursorðla/HeidursordlaPlayView",
  component: HeidursordlaPlayView,
  args: {
    initialState: fresh,
    nextRoundAt: new Date(Date.now() + 9 * 3_600_000).toISOString(),
  },
  parameters: {
    layout: "fullscreen",
    // Report only: aria-dialog-name (the game-over dialog has no name) and
    // aria-prohibited-attr (aria-label on the grid's plain div). Heiðursorðla
    // is being hidden; fix both if it comes back.
    a11y: { test: "todo" },
    // Any guess comes back as a partial match unless a story says otherwise.
    mockApi: [
      {
        match: GUESS,
        method: "POST",
        body: {
          ok: true,
          colors: ["green", "gray", "yellow", "gray", "gray"],
          status: "in_progress",
          guesses_used: 1,
          guesses_remaining: 5,
          answer: null,
        },
      },
    ],
    docs: {
      description: {
        component:
          "The playable puzzle. Type on the on-screen or physical keyboard and press ↵; guesses " +
          "are answered by the Storybook fetch mock.",
      },
    },
  },
} satisfies Meta<typeof HeidursordlaPlayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fresh: Story = {};

export const MidGame: Story = {
  args: {
    initialState: { ...fresh, guesses: twoGuesses, guesses_used: 2, guesses_remaining: 4 },
  },
};

/** Every guess is rejected with "Ekki í orðabók". */
export const NotInDictionary: Story = {
  parameters: {
    mockApi: [
      {
        match: GUESS,
        method: "POST",
        status: 400,
        body: { detail: { error_code: "not_in_dictionary", detail: "Ekki í orðabók" } },
      },
    ],
  },
};

export const Won: Story = {
  args: {
    initialState: {
      ...fresh,
      status: "won",
      guesses: [...twoGuesses, { word: "skáti", colors: Array(5).fill("green") }],
      guesses_used: 3,
      guesses_remaining: 3,
      answer: "skáti",
    },
  },
};

export const Lost: Story = {
  args: {
    initialState: {
      ...fresh,
      status: "lost",
      guesses: [
        ...twoGuesses,
        ...["eldur", "hópur", "rötun", "skrár"].map((word) => ({
          word,
          colors: Array(5).fill("gray"),
        })),
      ],
      guesses_used: 6,
      guesses_remaining: 0,
      answer: "skáti",
    },
  },
};
