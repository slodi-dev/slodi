import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import DashboardSidebar from "@/components/DashboardSidebar/DashboardSidebar";
import SidebarLab, { type SidebarLook } from "./SidebarLab";

const LOOK_OPTIONS: SidebarLook[] = ["rail", "groups", "trail", "night", "topbar"];

/**
 * Side nav variations. Each one is the whole dashboard shell (nav, drawer, menu button and
 * page), so the phone drawer can be compared too. Phone or desktop follows the width of the
 * shell rather than the window, so the drawer and its menu button also show in a narrow frame
 * on a wide screen. See Lab → Um tilraunastofuna.
 */
const meta = {
  title: "Lab/Sidebar",
  component: SidebarLab,
  tags: ["skip-visual"],
  args: {
    look: "trail",
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
    look: "rail",
    name: "A · Rail",
    idea: "A narrow column with a small label under each icon; collapsed, icons only with the label as a tip on hover or focus. On a phone the drawer is a grid of tiles.",
  },
  {
    look: "groups",
    name: "B · Groups",
    idea: "Items sorted under headings (Skipuleggja, Bankinn, Stjórnun, Þú), the active item a solid pill.",
  },
  {
    look: "trail",
    name: "C · Trail",
    idea: "Items are waypoints on a dashed trail; the active one is filled in, ringed like a painted trail marker, and says “Þú ert hér”.",
  },
  {
    look: "night",
    name: "D · Night",
    idea: "A dark forest sidebar in both themes, the active item lit by a campfire-yellow mark.",
  },
  {
    look: "topbar",
    name: "E · Top bar",
    idea: "On a phone, a bar across the top with the menu button and the page you are on, instead of a floating button. On desktop the active item is a raised card.",
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

/** Every look next to the current sidebar, at desktop and phone width. */
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

export const RailDesktop: Story = { name: "A · Rail, desktop", args: { look: "rail" } };
export const RailCollapsed: Story = {
  name: "A · Rail, collapsed",
  args: { look: "rail", collapsed: true },
};
export const RailPhone: Story = {
  name: "A · Rail, phone drawer",
  args: { look: "rail", drawerOpen: true },
  globals: PHONE,
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

export const TrailDesktop: Story = { name: "C · Trail, desktop", args: { look: "trail" } };
export const TrailCollapsed: Story = {
  name: "C · Trail, collapsed",
  args: { look: "trail", collapsed: true },
};
export const TrailPhone: Story = {
  name: "C · Trail, phone drawer",
  args: { look: "trail", drawerOpen: true },
  globals: PHONE,
};

export const NightDesktop: Story = { name: "D · Night, desktop", args: { look: "night" } };
export const NightCollapsed: Story = {
  name: "D · Night, collapsed",
  args: { look: "night", collapsed: true },
};
export const NightPhone: Story = {
  name: "D · Night, phone drawer",
  args: { look: "night", drawerOpen: true },
  globals: PHONE,
};

export const TopbarDesktop: Story = { name: "E · Top bar, desktop", args: { look: "topbar" } };
export const TopbarCollapsed: Story = {
  name: "E · Top bar, collapsed",
  args: { look: "topbar", collapsed: true },
};
export const TopbarPhone: Story = {
  name: "E · Top bar, phone drawer",
  args: { look: "topbar", drawerOpen: true },
  globals: PHONE,
};

/** One look with every control, for tweaking. Admin sees every item. */
export const Playground: Story = {
  args: { userRole: "admin", userPermissions: "admin" },
};
