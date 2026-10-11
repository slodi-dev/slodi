import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WORKERS } from "./gameData";
import OrbitField from "./OrbitField";

/** Owned count per worker, in WORKERS order; the rest are zero. */
const counts = (...owned: number[]) => WORKERS.map((_, i) => owned[i] ?? 0);

const meta = {
  title: "Components/Leikir/Arnór-Clicker/OrbitField",
  component: OrbitField,
  args: { counts: counts(3, 1) },
  decorators: [
    (Story) => (
      // OrbitField is positioned absolutely at the centre of the game stage.
      <div style={{ position: "relative", height: 640, overflow: "hidden" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The workforce odometer around Arnór: concentric rings of worker tokens, where outer " +
          "rings are worth exponentially more. Design-token audit finding: worker colours are " +
          "literal `hsl()` values in `gameData.ts`, not `--sl-*` tokens, so they do not change " +
          "with the theme.",
      },
    },
  },
} satisfies Meta<typeof OrbitField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoWorkers: Story = { args: { counts: counts() } };

export const FirstWorkers: Story = {};

export const Mixed: Story = { args: { counts: counts(9, 7, 5, 3, 2, 1) } };

/** Large holdings carry up into outer rings; the DOM caps at 72 tokens. */
export const AtIconCap: Story = {
  args: { counts: WORKERS.map((_, i) => 1234 - i * 40) },
};
