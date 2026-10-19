import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Header, { MAIN_CONTENT_ID } from "./index";
import { withFreshAuthSession } from "./withFreshAuthSession";

const meta = {
  title: "Components/Útlit/Header",
  component: Header,
  decorators: [withFreshAuthSession],
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/" } },
    docs: {
      description: {
        component:
          "Top bar for the public pages (landing, Um Slóða, Leikir): the Slóði mark (green in " +
          "light, white in dark) at the wordmark's cap height, then Heim, Um Slóða, Leikir, " +
          "Github and „Stjórnborð“ when Auth0 has a session or „Innskráning“ otherwise. It " +
          'starts with a „Fara beint í efni“ skip link to `<main id="efni">` ' +
          "(ConditionalLayout). On a phone the links move into a drawer.",
      },
    },
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

const PHONE = { viewport: { value: "phone", isRotated: false } };

/**
 * The header over a little page content, with the skip link's target. Like ConditionalLayout's
 * `<main>`, it draws no ring when the skip link focuses it.
 */
function WithMain() {
  return (
    <>
      <Header />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        style={{ padding: "var(--sl-spacing-xl)", outline: "none" }}
      >
        <p style={{ margin: 0 }}>Skipuleggðu fundi, útilegur og dagskrárhringi á einum stað.</p>
      </main>
    </>
  );
}

export const SignedOut: Story = {
  parameters: { auth: "anonymous" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Aðalvalmynd" });
    await expect(await within(nav).findByRole("link", { name: /Innskráning/ })).toBeVisible();
    await expect(within(nav).queryByRole("link", { name: /Stjórnborð/ })).toBeNull();
  },
};

export const SignedIn: Story = {
  parameters: { auth: "member" },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Aðalvalmynd" });
    await expect(await within(nav).findByRole("link", { name: /Stjórnborð/ })).toBeVisible();
    await expect(within(nav).queryByRole("link", { name: /Innskráning/ })).toBeNull();
  },
};

/** On Um Slóða: that link carries `aria-current="page"` and is underlined in green. */
export const CurrentPage: Story = {
  parameters: { auth: "anonymous", nextjs: { navigation: { pathname: "/about" } } },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Aðalvalmynd" });
    await expect(within(nav).getByRole("link", { name: "Um Slóða" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(within(nav).getByRole("link", { name: "Heim" })).not.toHaveAttribute(
      "aria-current"
    );
  },
};

/**
 * The drawer's keyboard contract. Closed, it is `inert`. Open, focus moves to its close
 * button; Escape closes it and puts focus back on the menu button. The play then opens it
 * again, so the story ends showing the open drawer.
 */
export const PhoneDrawerOpen: Story = {
  parameters: { auth: "anonymous", nextjs: { navigation: { pathname: "/leikir" } } },
  globals: PHONE,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: "Valmynd" });
    const drawer = canvasElement.ownerDocument.getElementById(
      toggle.getAttribute("aria-controls")!
    )!;

    await step("closed: inert, so out of the tab order", async () => {
      await expect(drawer.inert).toBe(true);
    });

    await step("open: focus moves in", async () => {
      await userEvent.click(toggle);
      const dialog = await canvas.findByRole("dialog", { name: "Valmynd" });
      const close = within(dialog).getByRole("button", { name: "Loka valmynd" });
      await waitFor(() => expect(close).toHaveFocus());
      await expect(within(dialog).getByRole("link", { name: /Innskráning/ })).toBeVisible();
      await expect(within(dialog).getByRole("link", { name: "Leikir" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });

    await step("Escape closes and returns focus to the menu button", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(drawer.inert).toBe(true));
      await waitFor(() => expect(toggle).toHaveFocus());
    });

    await step("open again for the picture", async () => {
      await userEvent.click(toggle);
      await waitFor(() => expect(drawer.inert).toBe(false));
    });
  },
};

/** Dark mode swaps the green mark for the white one. */
export const Dark: Story = {
  parameters: { auth: "anonymous" },
  globals: { theme: "dark" },
  play: async ({ canvasElement }) => {
    const brand = within(canvasElement).getByRole("link", { name: "Slóði" });
    const [green, white] = Array.from(brand.querySelectorAll("img"));
    await waitFor(() => expect(white).toBeVisible());
    await expect(green).not.toBeVisible();
  },
};

/** The first Tab lands on „Fara beint í efni“, which shows itself; Enter moves focus to main. */
export const SkipLink: Story = {
  parameters: { auth: "anonymous" },
  render: () => <WithMain />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skip = canvas.getByRole("link", { name: "Fara beint í efni" });
    await userEvent.tab();
    await expect(skip).toHaveFocus();
    await waitFor(() => expect(skip.getBoundingClientRect().top).toBeGreaterThanOrEqual(0));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("main")).toHaveFocus());
  },
};
