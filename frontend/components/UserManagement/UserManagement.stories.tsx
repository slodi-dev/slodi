import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { User } from "@/services/users.service";
import { users, userAdmin, workspace } from "@/stories/fixtures";
import UserManagement from "./UserManagement";

/** `listUsers` reads a bare array and the total from `X-Total-Count`. */
function listRoute(items: User[], total = items.length): MockRoute {
  return {
    match: /\/users\/admin\/list/,
    body: items,
    headers: { "X-Total-Count": String(total) },
  };
}

const configRoute: MockRoute = {
  match: /^\/api\/config/,
  body: { default_workspace_id: workspace.id },
};

const membersRoute: MockRoute = {
  match: /\/workspaces\/[^/]+\/members$/,
  body: [
    { workspace_id: workspace.id, user_id: "u-1", role: "editor" },
    { workspace_id: workspace.id, user_id: "u-2", role: "admin" },
    { workspace_id: workspace.id, user_id: "u-3", role: "admin" },
  ],
};

const manyUsers: User[] = Array.from({ length: 20 }, (_, i) => ({
  ...users[i % users.length],
  id: `u-many-${i}`,
  email: `skati${i + 1}@skatar.is`,
  name: `${["Anna", "Bjarki", "Dagný", "Egill", "Freyja"][i % 5]} ${["Jónsdóttir", "Ólafsson", "Sigurðardóttir", "Einarsson"][i % 4]}`,
}));

const meta = {
  title: "Components/Stjórnun/UserManagement",
  component: UserManagement,
  parameters: {
    auth: "admin",
    mockApi: [configRoute, membersRoute, listRoute(users)],
    docs: {
      description: {
        component:
          "Admin table of users: platform permission, role in the shared bank workspace, delete. " +
          "The signed-in admin's own row is marked „þú“ and cannot be changed.\n\n" +
          "Known issue sc-549 (story `components-stjórnun-usermanagement--default`): the search " +
          "field sets `outline: none` and relies on `--sl-input-shadow-focus`, which resolves " +
          "to an invalid box-shadow — focus shows only a border-colour change.",
      },
    },
  },
} satisfies Meta<typeof UserManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  parameters: {
    mockApi: [configRoute, { match: /\/users\/admin\/list/, delay: Infinity }],
  },
};

export const Empty: Story = {
  parameters: { mockApi: [configRoute, membersRoute, listRoute([])] },
};

export const LoadError: Story = {
  parameters: {
    mockApi: [
      configRoute,
      membersRoute,
      { match: /\/users\/admin\/list/, status: 500, body: { detail: "Gagnagrunnur svarar ekki" } },
    ],
  },
};

export const Paginated: Story = {
  parameters: { mockApi: [configRoute, membersRoute, listRoute(manyUsers, 87)] },
};

export const OnlySelf: Story = {
  parameters: { mockApi: [configRoute, membersRoute, listRoute([userAdmin])] },
};
