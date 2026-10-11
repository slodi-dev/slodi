import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ThemeToggle from "./ThemeToggle";

/**
 * Talks to the real ThemeProvider that wraps every story, so clicking an
 * option changes the theme of the whole canvas. The toolbar resets it on the
 * next story.
 */
const meta = {
  title: "Components/Stillingar/ThemeToggle",
  component: ThemeToggle,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FocusRing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Known issue sc-549 (story `components-stillingar-themetoggle--focus-ring`): tab through " +
          "the options. `.themeOption:focus-visible` sets `outline: none` and " +
          "`box-shadow: var(--sl-shadow-focus)`, which is invalid, so no focus ring is drawn.",
      },
    },
  },
};
