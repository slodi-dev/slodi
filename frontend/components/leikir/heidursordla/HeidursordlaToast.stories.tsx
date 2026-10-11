import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import HeidursordlaToast from "./HeidursordlaToast";

const meta = {
  title: "Components/Leikir/Heiðursorðla/HeidursordlaToast",
  component: HeidursordlaToast,
  args: {
    message: "Ekki í orðabók",
    onDismiss: fn(),
    // Long enough to look at; the game uses 2000ms.
    durationMs: 60_000,
  },
} satisfies Meta<typeof HeidursordlaToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotInDictionary: Story = {};

export const TooShort: Story = { args: { message: "Of stutt orð" } };

export const NetworkError: Story = { args: { message: "Netvilla — reyndu aftur" } };

/** `message: null` renders nothing. */
export const Hidden: Story = { args: { message: null } };

export const LongText: Story = {
  args: { message: "Skátaþingsorðlu er lokið — takk fyrir að spila með okkur í ár!" },
};
