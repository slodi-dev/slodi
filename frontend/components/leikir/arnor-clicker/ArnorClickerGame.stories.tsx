import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DEFAULT_CHAIR, WORKERS, signSave, type SaveState } from "./gameData";
import ArnorClickerGame from "./ArnorClickerGame";

// Must match SAVE_KEY in ArnorClickerGame.tsx.
const SAVE_KEY = "arnor_clicker_save_v2";

function seedSave(save: Omit<SaveState, "v" | "at" | "sig"> | null) {
  try {
    if (!save) {
      window.localStorage.removeItem(SAVE_KEY);
      return;
    }
    // `at` = now, so loading the save mints no offline earnings.
    const data: SaveState = { v: 1, at: Date.now(), ...save };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, sig: signSave(data) }));
  } catch {
    /* storage blocked — the game starts fresh */
  }
}

/**
 * The whole idle game. Its state lives in localStorage (and is saved every 5s
 * while you play), so each story seeds that save before rendering. Score sync
 * goes to `/api/leikir/arnor-clicker/scores`, answered by the fetch mock.
 */
const meta = {
  title: "Components/Leikir/Arnór-Clicker/ArnorClickerGame",
  component: ArnorClickerGame,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, height: "800px" },
      description: {
        component:
          "Design-token audit finding: `arnorClicker.module.css` and `gameData.ts` use many " +
          "literal `hsl()` colours instead of `--sl-*` tokens (see " +
          "`node scripts/check-tokens.mjs components/leikir`). Switch the theme toolbar to dark " +
          "on `components-leikir-arnór-clicker-arnorclickergame--established` to see which " +
          "parts do not follow the theme.",
      },
    },
  },
} satisfies Meta<typeof ArnorClickerGame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreshRun: Story = {
  decorators: [
    (Story) => {
      seedSave(null);
      return <Story />;
    },
  ],
};

export const Established: Story = {
  decorators: [
    (Story) => {
      seedSave({
        score: 48_250,
        run: 120_000,
        counts: WORKERS.map((_, i) => Math.max(0, 40 - i * 6)),
        ups: [],
        tsCur: 0,
        tsTot: 0,
        things: 0,
        chairs: [DEFAULT_CHAIR],
        chair: DEFAULT_CHAIR,
      });
      return <Story />;
    },
  ],
};

export const Guest: Story = {
  parameters: { auth: "anonymous" },
  decorators: FreshRun.decorators,
};
