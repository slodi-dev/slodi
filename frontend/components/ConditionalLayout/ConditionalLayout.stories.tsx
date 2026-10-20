import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { withFreshAuthSession } from "@/components/Header/withFreshAuthSession";
import ConditionalLayout from "./index";

const meta = {
  title: "Components/Útlit/ConditionalLayout",
  component: ConditionalLayout,
  // The public layout renders the Header, which reads the Auth0 session.
  decorators: [withFreshAuthSession],
  args: {
    children: (
      <div style={{ padding: "2rem", minHeight: 240 }}>
        <h1>Ratleikur um hverfið</h1>
        <p>Innihald síðunnar.</p>
      </div>
    ),
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, height: "560px" },
      description: {
        component:
          "Picks the layout from the path: Header + Footer for public pages, AppShell " +
          "for app routes. Set the path with `parameters.nextjs.navigation.pathname`. On a public " +
          "page and in AppShell `<main>` has the id `efni`, the target of the skip link.",
      },
    },
  },
} satisfies Meta<typeof ConditionalLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PublicRoute: Story = {
  parameters: { nextjs: { navigation: { pathname: "/about" } } },
};

export const PublicRouteAnonymous: Story = {
  parameters: { auth: "anonymous", nextjs: { navigation: { pathname: "/" } } },
};

export const DashboardRoute: Story = {
  parameters: { nextjs: { navigation: { pathname: "/programs" } } },
};

export const UnknownRouteFallsBackToPublic: Story = {
  parameters: { nextjs: { navigation: { pathname: "/skilmalar" } } },
};
