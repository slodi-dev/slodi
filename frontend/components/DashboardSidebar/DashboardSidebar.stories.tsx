import { type CSSProperties, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import DashboardSidebar, { type DashboardSidebarProps } from "./DashboardSidebar";

/** The nav with its own collapsed state, the way AppShell holds it. */
function Controlled(props: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(props.collapsed ?? false);
  const [toggled, setToggled] = useState(false);
  return (
    <DashboardSidebar
      {...props}
      collapsed={collapsed}
      toggled={toggled}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        setToggled(true);
        props.onCollapsedChange?.(next);
      }}
    />
  );
}

const meta = {
  title: "Components/Layout/DashboardSidebar",
  component: DashboardSidebar,
  args: {
    userRole: "leader",
    userPermissions: "member",
    onCollapsedChange: fn(),
  },
  argTypes: {
    userRole: { control: "inline-radio", options: ["leader", "editor", "admin"] },
    userPermissions: {
      control: "inline-radio",
      options: ["viewer", "member", "moderator", "admin"],
    },
    badgeCount: { control: { type: "number", min: 0 } },
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100dvh", display: "flex" }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => <Controlled key={String(args.collapsed)} {...args} />,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/programs" } },
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          "The side nav (B · Groups): items under Skipuleggja, Bankinn, Umsjón and Mínar " +
          "síður, the active item a solid pill that slides to the new item when the page " +
          "changes. Items are gated by workspace role (`userRole`) and platform permission " +
          "(`userPermissions`); gated items appear only after mount. The active item follows " +
          "`usePathname()`, set per story with `parameters.nextjs.navigation.pathname`. In the " +
          "app it sits in AppShell, which decides `collapsed`.",
      },
    },
  },
} satisfies Meta<typeof DashboardSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MemberOnPrograms: Story = {};

export const EditorOnBuilder: Story = {
  args: { userRole: "editor" },
  parameters: { nextjs: { navigation: { pathname: "/builder" } } },
};

export const ModeratorOnYfirferd: Story = {
  args: { userRole: "editor", userPermissions: "moderator" },
  parameters: { nextjs: { navigation: { pathname: "/yfirferd" } } },
};

/** The count is on the icon and read out with the label ("Merkin mín, 3 ný"). */
export const AdminOnStjornun: Story = {
  args: { userRole: "admin", userPermissions: "admin", badgeCount: 3 },
  parameters: { nextjs: { navigation: { pathname: "/admin" } } },
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole("navigation");
    await expect(within(nav).getByText("Merkin mín").closest("[role=link]")).toHaveAccessibleName(
      // The screen-reader parts are their own boxes, so the name has spaces before the commas.
      /^Merkin mín\s*, kemur síðar\s*, 3 ný$/
    );
  },
};

export const Collapsed: Story = {
  args: { collapsed: true, userPermissions: "admin", userRole: "admin", badgeCount: 2 },
  parameters: { nextjs: { navigation: { pathname: "/dashboard" } } },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** Pages the motion demo can jump between, spread over the groups so the pill travels. */
const DEMO_PAGES = [
  { path: "/dashboard", label: "Stjórnborð" },
  { path: "/programs", label: "Dagskrárbankinn" },
  { path: "/yfirferd", label: "Yfirferð" },
  { path: "/settings", label: "Stillingar" },
];

const demoBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--sl-spacing-sm)",
  padding: "var(--sl-spacing-sm) var(--sl-spacing-md)",
  borderBottom: "1px solid hsl(var(--sl-color-border))",
  background: "hsl(var(--sl-color-surface))",
  fontSize: "var(--sl-text-body-sm)",
};
const demoButton = (pressed = false): CSSProperties => ({
  minHeight: "2.5rem",
  padding: "0 var(--sl-spacing-sm)",
  border: "1px solid hsl(var(--sl-color-border-strong))",
  borderRadius: "var(--sl-radius-button)",
  background: pressed ? "hsl(var(--sl-color-primary-text))" : "hsl(var(--sl-color-surface))",
  color: pressed ? "hsl(var(--sl-color-text-inverse))" : "hsl(var(--sl-color-text-primary))",
  font: "inherit",
  cursor: "pointer",
});

/**
 * Buttons that change the active page and the badge count from outside, the way a route
 * change or a new notification would, so the motion can be watched.
 */
function MotionDemo(props: DashboardSidebarProps) {
  const [path, setPath] = useState("/programs");
  const [badge, setBadge] = useState(2);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={demoBar}>
        <div role="group" aria-label="Active page" style={{ display: "contents" }}>
          <span style={{ color: "hsl(var(--sl-color-text-secondary))" }}>Go to</span>
          {DEMO_PAGES.map((page) => (
            <button
              key={page.path}
              type="button"
              style={demoButton(page.path === path)}
              aria-pressed={page.path === path}
              onClick={() => setPath(page.path)}
            >
              {page.label}
            </button>
          ))}
        </div>
        <button type="button" style={demoButton()} onClick={() => setBadge((n) => n + 1)}>
          Badge +1
        </button>
        <button type="button" style={demoButton()} onClick={() => setBadge(0)}>
          Clear badge
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Controlled {...props} activePath={path} badgeCount={badge} onNavigate={setPath} />
      </div>
    </div>
  );
}

/** The pill slides from page to page and a new count pops in. Off under reduced motion. */
export const Animations: Story = {
  args: { userRole: "editor", userPermissions: "moderator" },
  render: (args) => <MotionDemo {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const nav = () => canvasElement.querySelector("nav") as HTMLElement;
    const current = () => nav().querySelector('[aria-current="page"]');

    for (const page of ["Stjórnborð", "Stillingar", "Yfirferð", "Dagskrárbankinn"]) {
      await step(`Go to ${page}`, async () => {
        await userEvent.click(canvas.getByRole("button", { name: page }));
        await waitFor(() => expect(current()).toHaveTextContent(page));
      });
    }
    await step("The badge count goes up, then clears", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Badge +1" }));
      await waitFor(() => expect(nav()).toHaveTextContent("3 ný"));
      await userEvent.click(canvas.getByRole("button", { name: "Clear badge" }));
      await waitFor(() => expect(nav()).not.toHaveTextContent("ný"));
      await userEvent.click(canvas.getByRole("button", { name: "Badge +1" }));
      await waitFor(() => expect(nav()).toHaveTextContent("1 ný"));
    });
    // Let the slide and the pops finish, so the accessibility check sees the settled nav.
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

/** Every item, for tweaking. */
export const Playground: Story = {
  args: { userRole: "admin", userPermissions: "admin", badgeCount: 2 },
};
