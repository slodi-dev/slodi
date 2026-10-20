import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import AppShell from "./index";

function PagePlaceholder() {
  return (
    <div style={{ padding: "var(--sl-spacing-lg)" }}>
      <h1 className="sl-text-primary">Dagskrárbankinn</h1>
      <p className="sl-text-secondary">
        Efni síðunnar birtist hér — t.d. „Kötturinn og músin“ og „Ratleikur um hverfið“.
      </p>
    </div>
  );
}

const PHONE = { viewport: { value: "phone", isRotated: false } };
const TABLET = { viewport: { value: "tablet", isRotated: false } };

const meta = {
  title: "Components/Layout/AppShell",
  component: AppShell,
  args: { children: <PagePlaceholder /> },
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/programs" } },
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          "The frame around every signed-in page: a skip link, the side nav (DashboardSidebar) " +
          'and the page\'s `<main id="efni">`. Icons only at 768–1199px and full width from ' +
          "1200px, until the user toggles; on a phone the nav is a drawer behind the menu " +
          "button. The Yfirferð, Merkimiðar and Stjórnun entries follow the Slóði user's " +
          "platform permission (`useAuth`), set with `parameters.auth`. Rationale: the AppShell " +
          "docs page.",
      },
    },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Member: Story = { parameters: { auth: "member" } };

export const Moderator: Story = {
  parameters: { auth: "moderator", nextjs: { navigation: { pathname: "/yfirferd" } } },
};

export const Admin: Story = {
  parameters: { auth: "admin", nextjs: { navigation: { pathname: "/admin" } } },
};

/** Only the current page is marked: Slóði ("/") used to be `aria-current` on every page. */
export const OneCurrentPage: Story = {
  parameters: { auth: "moderator", nextjs: { navigation: { pathname: "/programs/42" } } },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation", { name: "Aðalvalmynd" });
    const current = nav.querySelectorAll('[aria-current="page"]');
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveTextContent("Dagskrárbankinn");
  },
};

/**
 * The toggle says what it does, in words that are also its accessible name, and
 * `aria-expanded` follows the nav. Collapsed, every label is still read out and shows as a tip
 * on keyboard focus; an item not built yet says so in its tip too.
 */
export const CollapseToggle: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Minnka valmynd" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await step("collapse: the name and aria-expanded change together", async () => {
      await userEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
      await expect(toggle).toHaveAccessibleName("Stækka valmynd");
    });

    await step("collapsed, the labels are still the links' names", async () => {
      await expect(canvas.getByRole("link", { name: "Dagskrárbankinn" })).toBeInTheDocument();
      await expect(
        canvas.getByRole("link", { name: /^Veggurinn\s*, kemur síðar$/ })
      ).toHaveAttribute("aria-disabled", "true");
    });

    await step("keyboard focus shows the tip, with the reason", async () => {
      const soon = canvas.getByRole("link", { name: /^Veggurinn\s*, kemur síðar$/ });
      soon.focus();
      await userEvent.tab({ shift: true });
      await userEvent.tab();
      await expect(soon).toHaveFocus();
      const tip = soon.querySelector("span:not([aria-hidden])") as HTMLElement;
      await waitFor(() => expect(tip.getBoundingClientRect().width).toBeGreaterThan(40));
      // It fades in.
      await waitFor(() => expect(tip).toBeVisible());
    });

    await step("expand again", async () => {
      await userEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    });
  },
};

/** The nav starts collapsed by the user's earlier choice (stories only). */
export const Collapsed: Story = {
  args: { initialCollapsed: true },
  parameters: { auth: "admin", nextjs: { navigation: { pathname: "/dashboard" } } },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/**
 * At 768–1199px the nav starts as icons. The toggle reports that (it used to say "expanded"
 * while the CSS forced icons) and can open it out.
 */
export const Tablet: Story = {
  parameters: { auth: "member" },
  globals: TABLET,
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("button", { name: "Stækka valmynd" });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
  },
};

/** The skip link is the first thing Tab reaches, and moves focus to the page. */
export const SkipLink: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const skip = canvas.getByRole("link", { name: "Fara beint í efni" });
    await expect(skip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvasElement.querySelector("main#efni")).toHaveFocus());
  },
};

export const Mobile: Story = {
  parameters: { auth: "member" },
  globals: PHONE,
};

export const MobileDrawerOpen: Story = {
  parameters: { auth: "moderator" },
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Opna valmynd" }));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Loka valmynd" })).toHaveAttribute(
        "aria-expanded",
        "true"
      )
    );
    // Let the slide finish, so the accessibility check sees the settled drawer.
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

/**
 * The phone drawer's keyboard contract. Closed, the nav is `visibility: hidden`, so its links
 * are out of the tab order and hidden from assistive technology. Open, focus moves to its
 * first link, Tab cycles through the drawer and the menu button (which closes it), and Escape
 * closes it and puts focus back on the menu button.
 */
export const MobileDrawerKeyboard: Story = {
  parameters: { auth: "member" },
  globals: PHONE,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const drawer = canvasElement.querySelector<HTMLElement>("#app-nav")!;
    const button = await canvas.findByRole("button", { name: "Opna valmynd" });

    await step("closed: hidden, so out of the tab order", async () => {
      await expect(getComputedStyle(drawer).visibility).toBe("hidden");
    });

    await step("open: focus moves to the first link", async () => {
      await userEvent.click(button);
      await waitFor(() => expect(getComputedStyle(drawer).visibility).toBe("visible"));
      const first = drawer.querySelector<HTMLElement>("a[href]")!;
      await waitFor(() => expect(first).toHaveFocus());
    });

    await step("Tab wraps from the drawer's last control to the menu button", async () => {
      const controls = drawer.querySelectorAll<HTMLElement>("a[href], [tabindex='0']");
      controls[controls.length - 1].focus();
      await userEvent.tab();
      await expect(button).toHaveFocus();
      await userEvent.tab({ shift: true });
      await expect(controls[controls.length - 1]).toHaveFocus();
    });

    await step("Escape closes and returns focus to the menu button", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "false"));
      await waitFor(() => expect(button).toHaveFocus());
      await waitFor(() => expect(getComputedStyle(drawer).visibility).toBe("hidden"));
    });
  },
};
