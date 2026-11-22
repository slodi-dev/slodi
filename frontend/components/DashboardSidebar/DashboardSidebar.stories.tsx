import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { placeholderImage } from "@/stories/fixtures";
import DashboardSidebar from "./DashboardSidebar";

const meta = {
  title: "Components/Útlit/DashboardSidebar",
  component: DashboardSidebar,
  args: {
    userRole: "leader",
    userName: "Sigríður Jónsdóttir",
    userPermissions: "member",
    onCollapsedChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100dvh", display: "flex" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/programs" } },
    docs: {
      story: { inline: false, height: "640px" },
      description: {
        component:
          "Dashboard navigation. Items are gated by workspace role (`userRole`) and platform " +
          "permission (`userPermissions`); gated items appear only after mount. The active item " +
          "follows `usePathname()` — set per story with `parameters.nextjs.navigation.pathname`.\n\n" +
          "Known issue sc-549 (story `components-útlit-dashboardsidebar--member-on-programs`): " +
          "the collapse button and skip link use `outline: none` plus `--sl-shadow-focus`, " +
          "which resolves to an invalid box-shadow — keyboard focus on them is invisible.",
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

export const AdminOnStjornun: Story = {
  args: { userRole: "admin", userPermissions: "admin", badgeCount: 3 },
  parameters: { nextjs: { navigation: { pathname: "/admin" } } },
};

export const Collapsed: Story = {
  args: { collapsed: true, userPermissions: "admin", userRole: "admin" },
  parameters: { nextjs: { navigation: { pathname: "/dashboard" } } },
};

export const WithUserSection: Story = {
  args: {
    showUserSection: true,
    userAvatar: placeholderImage("SJ", 142),
  },
};

export const WithUserSectionNoAvatar: Story = {
  args: {
    showUserSection: true,
    userName: "Halla Björk Einarsdóttir-Guðmundsdóttir",
  },
};
