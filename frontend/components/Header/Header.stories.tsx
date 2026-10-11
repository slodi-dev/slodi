import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

/**
 * The drawer's keyboard contract. Closed, it is `inert`: none of its links can
 * be reached with Tab and it is hidden from assistive technology (axe
 * `aria-hidden-focus` used to fire on every phone page). Open, focus moves to
 * its first control, Tab cycles inside it, and Escape closes it and puts focus
 * back on the menu button.
 */
export const MobileDrawerKeyboard: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const drawer = canvasElement.querySelector<HTMLElement>("#main-menu-drawer")!;
    const toggle = await canvas.findByRole("button", { name: "Opna valmynd" });

    await step("closed: inert, so out of the tab order", async () => {
      await expect(drawer.inert).toBe(true);
      const link = drawer.querySelector<HTMLElement>("a")!;
      link.focus();
      await expect(link).not.toHaveFocus();
    });

    await step("open: focus moves in", async () => {
      await userEvent.click(toggle);
      const dialog = await canvas.findByRole("dialog", { name: "Valmynd" });
      await expect(drawer.inert).toBe(false);
      const close = within(dialog).getByRole("button", { name: "Loka valmynd" });
      await waitFor(() => expect(close).toHaveFocus());
    });

    await step("Tab wraps inside the drawer", async () => {
      const dialog = canvas.getByRole("dialog", { name: "Valmynd" });
      const links = within(dialog).getAllByRole("link");
      links[links.length - 1].focus();
      await userEvent.tab();
      await expect(within(dialog).getByRole("button", { name: "Loka valmynd" })).toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(links[links.length - 1]).toHaveFocus();
    });

    await step("Escape closes and returns focus to the menu button", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(drawer.inert).toBe(true));
      await waitFor(() => expect(toggle).toHaveFocus());
    });
  },
};
