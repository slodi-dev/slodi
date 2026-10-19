import { type CSSProperties, type ReactNode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import DashboardSidebar from "@/components/DashboardSidebar/DashboardSidebar";
import SidebarLab, { type SidebarLabProps, type SidebarLook } from "./SidebarLab";

const LOOK_OPTIONS: SidebarLook[] = ["groups"];

/**
 * Side nav variations. Each one is the whole dashboard shell (nav, drawer, menu button and
 * page), so the phone drawer can be compared too. Phone or desktop follows the width of the
 * shell rather than the window, so the drawer and its menu button also show in a narrow frame
 * on a wide screen. See Lab → About the lab.
 *
 * Picked: B · Groups; the other directions (A Rail, C Trail, D Night, E Top bar) were removed
 * on 2026-10-19.
 */
const meta = {
  title: "Lab/Sidebar",
  component: SidebarLab,
  tags: ["skip-visual"],
  args: {
    look: "groups",
    userRole: "editor",
    userPermissions: "moderator",
    badgeCount: 2,
    collapsed: false,
    drawerOpen: false,
    onCollapsedChange: fn(),
  },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    userRole: { control: "inline-radio", options: ["leader", "editor", "admin"] },
    userPermissions: {
      control: "inline-radio",
      options: ["viewer", "member", "moderator", "admin"],
    },
    badgeCount: { control: { type: "number", min: 0 } },
    collapsed: { control: "boolean" },
    drawerOpen: { control: "boolean" },
    navLabel: { control: false },
    children: { control: false },
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/programs" } },
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          "Lab copies of `components/DashboardSidebar`, with the drawer and menu button from " +
          "`DashboardLayout` and `MobileMenuButton`. Same items and gates as the real sidebar. " +
          "The active item follows `usePathname()`, set with " +
          "`parameters.nextjs.navigation.pathname`. Below 768px of shell width the nav becomes a " +
          "drawer with a menu button that is always visible; `collapsed` applies to desktop only.",
      },
    },
  },
  // Remount when the initial-state props change, so the controls take effect.
  render: (args) => (
    <div style={{ height: "100dvh" }}>
      <SidebarLab key={`${args.look}-${args.collapsed}-${args.drawerOpen}`} {...args}>
        <MockPage />
      </SidebarLab>
    </div>
  ),
} satisfies Meta<typeof SidebarLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const PHONE = { viewport: { value: "phone", isRotated: false } };

/** A stand-in for a dashboard page, so the nav is seen next to something. */
function MockPage() {
  const card: CSSProperties = {
    padding: "var(--sl-spacing-inset-md)",
    borderRadius: "var(--sl-radius-card)",
    background: "hsl(var(--sl-color-surface))",
    border: "1px solid hsl(var(--sl-color-border-subtle))",
  };
  return (
    <div style={{ padding: "var(--sl-spacing-md)", display: "grid", gap: "var(--sl-spacing-sm)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--sl-text-heading-4)" }}>Dagskrárbankinn</h2>
      <p style={{ margin: 0, color: "hsl(var(--sl-color-text-secondary))" }}>
        Finndu dagskrá fyrir næsta fund.
      </p>
      {["Kötturinn og músin", "Ratleikur um hverfið", "Hnútar og bönd"].map((title) => (
        <div key={title} style={card}>
          {title}
        </div>
      ))}
    </div>
  );
}

const LOOKS: { look: SidebarLook; name: string; idea: string }[] = [
  {
    look: "groups",
    name: "B · Groups",
    idea: "Items sorted under headings (Skipuleggja, Bankinn, Umsjón, Mínar síður), the active item a solid pill that slides to the new item when the page changes. Collapsed, short rules stand in for the headings.",
  },
];

const heading: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  fontSize: "var(--sl-text-body-lg)",
  fontWeight: "var(--sl-font-weight-semibold)",
};
const ideaText: CSSProperties = {
  margin: "0 0 var(--sl-spacing-sm)",
  maxWidth: "60rem",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
};
const caption: CSSProperties = {
  margin: "0 0 var(--sl-spacing-xs)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-caption)",
};

function Frame({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0, width, maxWidth: "100%" }}>
      <figcaption style={caption}>{label}</figcaption>
      <div
        style={{
          height: "720px",
          overflow: "hidden",
          border: "1px solid hsl(var(--sl-color-border))",
          borderRadius: "var(--sl-radius-card)",
        }}
      >
        {children}
      </div>
    </figure>
  );
}

const frames: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sl-spacing-md)",
  alignItems: "flex-start",
};

/** The picked look next to the current sidebar, at desktop and phone width. */
export const Comparison: Story = {
  parameters: { docs: { story: { height: "1200px" } } },
  render: (args) => (
    <div
      style={{
        display: "grid",
        gap: "var(--sl-spacing-xl)",
        padding: "var(--sl-spacing-md)",
      }}
    >
      <section>
        <h2 style={heading}>Current</h2>
        <p style={ideaText}>
          What the app uses today. It follows the window width, not its frame, so it can&apos;t be
          shown at phone width here; its menu button only appears below a 768px window.
        </p>
        <div style={frames}>
          <Frame label="Desktop" width="880px">
            <div style={{ display: "flex", height: "100%" }}>
              <div style={{ width: "240px", flex: "none" }}>
                <DashboardSidebar
                  userRole={args.userRole}
                  userPermissions={args.userPermissions}
                  badgeCount={args.badgeCount}
                  userName="Sigríður Jónsdóttir"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MockPage />
              </div>
            </div>
          </Frame>
        </div>
      </section>
      {LOOKS.map((l, index) => (
        <section key={l.look}>
          <h2 style={heading}>{l.name}</h2>
          <p style={ideaText}>{l.idea}</p>
          <div style={frames}>
            <Frame label="Desktop" width="880px">
              <SidebarLab {...args} look={l.look} navLabel={`Aðalvalmynd ${index + 1}, tölva`}>
                <MockPage />
              </SidebarLab>
            </Frame>
            <Frame label="Phone, drawer closed" width="390px">
              <SidebarLab
                {...args}
                look={l.look}
                drawerOpen={false}
                navLabel={`Aðalvalmynd ${index + 1}, sími`}
              >
                <MockPage />
              </SidebarLab>
            </Frame>
          </div>
        </section>
      ))}
    </div>
  ),
};

export const GroupsDesktop: Story = { name: "B · Groups, desktop", args: { look: "groups" } };
export const GroupsCollapsed: Story = {
  name: "B · Groups, collapsed",
  args: { look: "groups", collapsed: true },
};
export const GroupsPhone: Story = {
  name: "B · Groups, phone drawer",
  args: { look: "groups", drawerOpen: true },
  globals: PHONE,
};

/** Pages the motion demo can jump between, spread over the groups so the marker travels. */
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
 * The nav with buttons that change the active page and the badge count from outside, the way
 * a route change or a new notification would, so the motion can be watched.
 */
function MotionDemo(props: SidebarLabProps) {
  const [path, setPath] = useState("/programs");
  const [badge, setBadge] = useState(2);
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
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
      <div style={{ flex: 1, minHeight: 0 }}>
        <SidebarLab {...props} activePath={path} badgeCount={badge} onNavigate={setPath}>
          <MockPage />
        </SidebarLab>
      </div>
    </div>
  );
}

/** Clicks through the demo pages and the badge, checking the nav follows each change. */
const playMotion: Story["play"] = async ({ canvasElement, step }) => {
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
};

export const GroupsAnimations: Story = {
  name: "B · Groups, animations",
  args: { look: "groups" },
  render: (args) => <MotionDemo {...args} />,
  play: playMotion,
};

/** One look with every control, for tweaking. Admin sees every item. */
export const Playground: Story = {
  args: { userRole: "admin", userPermissions: "admin" },
};
