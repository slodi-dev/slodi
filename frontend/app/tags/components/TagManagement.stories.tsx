import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { Tag } from "@/services/tags.service";
import { tags, workspace } from "@/stories/fixtures";
import TagManagement from "./TagManagement";

const configRoute: MockRoute = {
  match: /^\/api\/config/,
  body: { default_workspace_id: workspace.id },
};

const manyTags: Tag[] = [
  ...tags,
  ...[
    "kvöldvaka",
    "söngur",
    "eldamennska",
    "hnútar",
    "sund",
    "fjallganga",
    "útilega",
    "vetrarstarf",
    "umhverfisvernd",
    "samfélagsverkefni",
    "alþjóðastarf",
    "leiðtogaþjálfun",
    "skyndihjálp-framhald",
    "ratleikir",
    "föndur",
  ].map((name, i) => ({ id: `t-x${i}`, name })),
];

const meta = {
  title: "Components/Stjórnun/TagManagement",
  component: TagManagement,
  parameters: {
    auth: "moderator",
    mockApi: [configRoute],
    docs: {
      description: {
        component:
          "Moderator page for the shared merkimiðar vocabulary. Usage counts come from the " +
          "bank's programs; non-moderators see a refusal. Known issue sc-549 (story " +
          "`components-stjórnun-tagmanagement--default`): the search field's focus ring uses " +
          "`--sl-input-shadow-focus`, an invalid box-shadow.",
      },
    },
  },
} satisfies Meta<typeof TagManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Paginated: Story = {
  parameters: { mockApi: [configRoute, { match: /\/tags/, body: manyTags }] },
};

export const Loading: Story = {
  parameters: { mockApi: [configRoute, { match: /\/tags/, delay: Infinity }] },
};

export const Empty: Story = {
  parameters: { mockApi: [configRoute, { match: /\/tags/, body: [] }] },
};

export const LoadError: Story = {
  parameters: {
    mockApi: [configRoute, { match: /\/tags/, status: 500, body: { detail: "Villa" } }],
  },
};

export const NotAModerator: Story = { parameters: { auth: "member" } };

export const AuthLoading: Story = { parameters: { auth: "loading" } };
