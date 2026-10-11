import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { ApiHealthIndicator } from "./ApiHealthIndicator";

/**
 * Dev-only indicator. Storybook builds with NODE_ENV=production, where the
 * component renders nothing unless `showInProduction` is set — so every story
 * sets it.
 */
const meta = {
  title: "Components/Sameiginlegt/ApiHealthIndicator",
  component: ApiHealthIndicator,
  args: { showInProduction: true },
  parameters: {
    docs: {
      description: {
        component:
          "Design-token audit finding: `ApiHealthIndicator.module.css` uses a literal `rgba(…)` " +
          "colour instead of a `--sl-color-*` token.",
      },
    },
  },
} satisfies Meta<typeof ApiHealthIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  parameters: { mockApi: [{ match: /\/healthz/, body: { status: "ok" } }] satisfies MockRoute[] },
};

export const Unhealthy: Story = {
  parameters: {
    mockApi: [{ match: /\/healthz/, status: 503, body: { detail: "down" } }] satisfies MockRoute[],
  },
};

export const Checking: Story = {
  parameters: { mockApi: [{ match: /\/healthz/, delay: Infinity }] satisfies MockRoute[] },
};
