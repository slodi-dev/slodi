import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import EmailListDownloadButton from "./email-download-service";

const meta = {
  title: "Components/Stillingar/EmailListDownloadButton",
  component: EmailListDownloadButton,
  args: { allowed: true },
  parameters: {
    mockApi: [
      { match: /^\/api\/emails/, body: ["sigga@skatar.is", "gunnar@skatar.is"] },
    ] satisfies MockRoute[],
    docs: {
      description: {
        component:
          "Built on `components/Button`, so it inherits sc-553 (legacy tokens). The error " +
          "message (`Empty` and `Error` stories) uses `sl-text-error` and is announced as an alert.",
      },
    },
  },
} satisfies Meta<typeof EmailListDownloadButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const clickDownload = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};

export const Default: Story = {};

export const NotAllowed: Story = { args: { allowed: false } };

export const Loading: Story = {
  parameters: { mockApi: [{ match: /^\/api\/emails/, delay: Infinity }] satisfies MockRoute[] },
  play: clickDownload,
};

export const Empty: Story = {
  // No visual baseline: whether the button keeps its focus ring depends on
  // whether the mocked reply lands before or after it is disabled.
  tags: ["skip-visual"],
  parameters: { mockApi: [{ match: /^\/api\/emails/, body: [] }] satisfies MockRoute[] },
  play: clickDownload,
};

export const ErrorState: Story = {
  name: "Error",
  parameters: {
    mockApi: [{ match: /^\/api\/emails/, status: 502, body: {} }] satisfies MockRoute[],
  },
  play: clickDownload,
};
