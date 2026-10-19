import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MockDataBanner from "./MockDataBanner";

const meta = {
  title: "Components/Vinnubekkur/MockDataBanner",
  component: MockDataBanner,
  args: { reason: "unbuilt" },
  parameters: {
    docs: {
      description: {
        component:
          "The sticky label over anything rendered from fixtures, so fake data can never be " +
          "mistaken for a real plan. Development only: mock mode cannot be turned on in a " +
          "production build.",
      },
    },
  },
} satisfies Meta<typeof MockDataBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bench and the bank have no endpoint yet. */
export const Unbuilt: Story = {};

/** An endpoint failed, so fixtures stood in. */
export const Fallback: Story = { args: { reason: "fallback" } };

/** Forced on with `?mock=1`. */
export const Forced: Story = { args: { reason: "forced" } };
