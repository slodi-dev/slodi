import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import Header from "./index";

const meta = {
  title: "Components/Útlit/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/" } },
    docs: {
      description: {
        component:
          "Top bar for the public pages (landing, Um Slóða, Leikir). Shows „Stjórnborð“ when " +
          "Auth0 has a session and „Innskráning“ otherwise. Design-token audit finding: the " +
          "drawer overlay uses a literal `rgba(0…)` scrim instead of a `--sl-color-*` token.",
      },
    },
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = { parameters: { auth: "member" } };

export const Anonymous: Story = { parameters: { auth: "anonymous" } };

export const MobileDrawerOpen: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Opna valmynd" }));
  },
};
