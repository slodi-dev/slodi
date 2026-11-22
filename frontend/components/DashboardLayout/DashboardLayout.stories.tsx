import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import DashboardLayout from "./index";

function PagePlaceholder() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1 className="sl-text-primary">Dagskrárbankinn</h1>
      <p className="sl-text-secondary">
        Efni síðunnar birtist hér — t.d. „Kötturinn og músin“ og „Ratleikur um hverfið“.
      </p>
    </div>
  );
}

const meta = {
  title: "Components/Útlit/DashboardLayout",
  component: DashboardLayout,
  args: { children: <PagePlaceholder /> },
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/programs" } },
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          "Sidebar + main area for authenticated routes. The name comes from the Auth0 session " +
          "(`useUser`), the Yfirferð entry from the Slóði user's platform permission " +
          "(`useAuth`). Both are driven by `parameters.auth`. Design-token audit finding: the " +
          "mobile overlay uses a literal `rgba(0…)` scrim.",
      },
    },
  },
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Member: Story = { parameters: { auth: "member" } };

export const Moderator: Story = {
  parameters: { auth: "moderator", nextjs: { navigation: { pathname: "/yfirferd" } } },
};

export const Admin: Story = {
  parameters: { auth: "admin", nextjs: { navigation: { pathname: "/admin" } } },
};

export const Mobile: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/**
 * The phone drawer's keyboard contract. Closed, the sidebar is
 * `visibility: hidden`, so its links are out of the tab order and hidden from
 * assistive technology. Open, focus moves to its first link, Tab cycles through
 * the drawer and the menu button (which closes it), and Escape closes it and
 * puts focus back on the menu button.
 */
export const MobileDrawerKeyboard: Story = {
  parameters: { auth: "member" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const drawer = canvasElement.querySelector<HTMLElement>("#dashboard-sidebar")!;
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
      const controls = drawer.querySelectorAll<HTMLElement>("a[href], button");
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
