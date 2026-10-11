import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HeidursordlaGrid from "./HeidursordlaGrid";

const meta = {
  title: "Components/Leikir/Heiðursorðla/HeidursordlaGrid",
  component: HeidursordlaGrid,
  args: {
    guesses: [],
    activeGuess: "",
    shake: false,
  },
} satisfies Meta<typeof HeidursordlaGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Typing: Story = { args: { activeGuess: "SKÁT" } };

export const MidGame: Story = {
  args: {
    guesses: [
      { word: "tjald", colors: ["gray", "gray", "yellow", "gray", "gray"] },
      { word: "álfar", colors: ["gray", "green", "gray", "yellow", "gray"] },
    ],
    activeGuess: "HNÚ",
  },
};

export const Won: Story = {
  args: {
    guesses: [
      { word: "tjald", colors: ["gray", "gray", "yellow", "gray", "gray"] },
      { word: "álfar", colors: ["gray", "green", "gray", "yellow", "gray"] },
      { word: "skáti", colors: ["green", "green", "green", "green", "green"] },
    ],
  },
};

export const Lost: Story = {
  args: {
    guesses: [
      { word: "tjald", colors: ["gray", "gray", "yellow", "gray", "gray"] },
      { word: "álfar", colors: ["gray", "green", "gray", "yellow", "gray"] },
      { word: "eldur", colors: ["gray", "gray", "gray", "gray", "gray"] },
      { word: "hópur", colors: ["gray", "gray", "gray", "gray", "yellow"] },
      { word: "rötun", colors: ["yellow", "gray", "yellow", "gray", "gray"] },
      { word: "skrár", colors: ["green", "green", "yellow", "gray", "gray"] },
    ],
  },
};

/** The active row shakes after an invalid guess. */
export const Shake: Story = { args: { activeGuess: "SKÁ", shake: true } };

/** Skátaþing editions used other lengths; the grid follows `wordLength`. */
export const SevenLetters: Story = {
  args: {
    wordLength: 7,
    guesses: [
      { word: "varðeld", colors: ["green", "gray", "yellow", "gray", "gray", "green", "gray"] },
    ],
    activeGuess: "SKÁTA",
  },
};
