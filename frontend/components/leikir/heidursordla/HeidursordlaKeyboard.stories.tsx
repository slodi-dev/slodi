import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import HeidursordlaKeyboard, { letterStatesFromGuesses } from "./HeidursordlaKeyboard";

const meta = {
  title: "Components/Leikir/Heiðursorðla/HeidursordlaKeyboard",
  component: HeidursordlaKeyboard,
  args: {
    onKey: fn(),
    onEnter: fn(),
    onBackspace: fn(),
    letterStates: {},
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeidursordlaKeyboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLetterStates: Story = {
  args: {
    letterStates: letterStatesFromGuesses([
      { word: "tjald", colors: ["gray", "gray", "yellow", "gray", "gray"] },
      { word: "álfar", colors: ["gray", "green", "gray", "yellow", "gray"] },
    ]),
  },
};

/** While a guess is submitting, or after the game ends. */
export const Disabled: Story = { args: { disabled: true } };

/** The layout targets a 375px portrait viewport. */
export const NarrowPhone: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 343 }}>
        <Story />
      </div>
    ),
  ],
};
