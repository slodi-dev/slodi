import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
