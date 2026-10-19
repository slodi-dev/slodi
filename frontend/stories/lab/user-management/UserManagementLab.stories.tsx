import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import UserManagement from "@/components/UserManagement/UserManagement";
import { users as apiUsers, workspace } from "@/stories/fixtures";
import UserManagementLab, { type LabUser, type UserManagementLook } from "./UserManagementLab";

/**
 * User management variations. The current table can only change a permission (instantly, with no
 * confirmation and no undo) and delete; it has no filter, no suspension and no history, and its
 * small controls fail the touch-target rule on a phone. These try four layouts that all cover
 * search, a permission filter, a confirmed promotion, suspend/reinstate with "Afturkalla", and
 * the empty, loading and error states. See Lab → About the lab.
 */

/* ── Fixtures: made-up members of a made-up scout group ── */

const day = (iso: string) => `${iso}T10:00:00.000Z`;

const LAB_USERS: LabUser[] = [
  {
    id: "lu-1",
    name: "Halla Björk Einarsdóttir",
    email: "halla.bjork@vifill.example",
    permissions: "admin",
    status: "active",
    joinedAt: day("2023-08-14"),
    lastSeenAt: day("2026-10-19"),
    history: [{ at: day("2023-08-14"), text: "Stjórnandi samkvæmt stillingum" }],
  },
  {
    id: "lu-2",
    name: "Gunnar Þór Ólafsson",
    email: "gunnar@vifill.example",
    permissions: "moderator",
    status: "active",
    joinedAt: day("2024-01-09"),
    lastSeenAt: day("2026-10-17"),
    history: [
      { at: day("2024-01-09"), text: "Nýskráning" },
      { at: day("2024-03-02"), text: "Réttindi: Meðlimur → Umsjónarmaður dagskrár" },
    ],
  },
  {
    id: "lu-3",
    name: "Sigurbjörg Guðríður Aðalheiður Þorvaldsdóttir Kjerúlf",
    email: "sigurbjorg.gudridur.adalheidur.thorvaldsdottir@skatafelagid-hraunbuar.example",
    permissions: "member",
    status: "active",
    joinedAt: day("2024-09-21"),
    lastSeenAt: day("2026-09-30"),
    history: [{ at: day("2024-09-21"), text: "Nýskráning" }],
  },
  {
    id: "lu-4",
    name: "Aron Freyr Kristjánsson",
    email: "aron.freyr@vifill.example",
    permissions: "viewer",
    status: "active",
    joinedAt: day("2026-10-02"),
    lastSeenAt: day("2026-10-02"),
    history: [{ at: day("2026-10-02"), text: "Nýskráning" }],
  },
  {
    id: "lu-5",
    name: "Ýmir Breki Sæmundsson",
    email: "ymir@landnemar.example",
    permissions: "member",
    status: "suspended",
    joinedAt: day("2025-02-11"),
    lastSeenAt: day("2026-06-04"),
    history: [
      { at: day("2025-02-11"), text: "Nýskráning" },
      { at: day("2026-06-05"), text: "Aðgangur frystur" },
    ],
  },
  {
    id: "lu-6",
    name: "Þórdís Lilja Hrafnsdóttir",
    email: "thordis.lilja@kopar.example",
    permissions: "member",
    status: "active",
    joinedAt: day("2024-05-30"),
    lastSeenAt: day("2026-10-18"),
    history: [{ at: day("2024-05-30"), text: "Nýskráning" }],
  },
  {
    id: "lu-7",
    name: "Kári Steinn Jóhannsson",
    email: "kari@vifill.example",
    permissions: "viewer",
    status: "active",
    joinedAt: day("2026-09-12"),
    lastSeenAt: null,
    history: [{ at: day("2026-09-12"), text: "Nýskráning" }],
  },
  {
    id: "lu-8",
    name: "Embla Ósk Guðmundsdóttir",
    email: "embla.osk@aegisbuar.example",
    permissions: "moderator",
    status: "active",
    joinedAt: day("2023-11-03"),
    lastSeenAt: day("2026-10-15"),
    history: [
      { at: day("2023-11-03"), text: "Nýskráning" },
      { at: day("2025-01-20"), text: "Réttindi: Meðlimur → Umsjónarmaður dagskrár" },
    ],
  },
  {
    id: "lu-9",
    name: "Bergur Logi Árnason",
    email: "bergur@kopar.example",
    permissions: "member",
    status: "active",
    joinedAt: day("2025-08-19"),
    lastSeenAt: day("2026-10-11"),
    history: [{ at: day("2025-08-19"), text: "Nýskráning" }],
  },
  {
    id: "lu-10",
    name: "Ástrós Eva Pálsdóttir",
    email: "astros.eva@landnemar.example",
    permissions: "viewer",
    status: "suspended",
    joinedAt: day("2025-10-01"),
    lastSeenAt: day("2026-02-14"),
    history: [
      { at: day("2025-10-01"), text: "Nýskráning" },
      { at: day("2026-02-15"), text: "Aðgangur frystur" },
    ],
  },
  {
    id: "lu-11",
    name: "Dagur Hrafn Benediktsson",
    email: "dagur.hrafn@aegisbuar.example",
    permissions: "member",
    status: "active",
    joinedAt: day("2024-02-27"),
    lastSeenAt: day("2026-08-23"),
    history: [{ at: day("2024-02-27"), text: "Nýskráning" }],
  },
  {
    id: "lu-12",
    name: "Sól Védís Kristinsdóttir",
    email: "sol@vifill.example",
    permissions: "member",
    status: "active",
    joinedAt: day("2025-04-06"),
    lastSeenAt: day("2026-10-08"),
    history: [{ at: day("2025-04-06"), text: "Nýskráning" }],
  },
  {
    id: "lu-13",
    name: "Jökull Máni Haraldsson",
    email: "jokull.mani@hraunbuar.example",
    permissions: "viewer",
    status: "active",
    joinedAt: day("2026-10-12"),
    lastSeenAt: day("2026-10-12"),
    history: [{ at: day("2026-10-12"), text: "Nýskráning" }],
  },
  {
    id: "lu-14",
    name: "Ragnheiður Ylfa Magnúsdóttir",
    email: "ragnheidur.ylfa@bandalag.example",
    permissions: "admin",
    status: "active",
    joinedAt: day("2023-08-14"),
    lastSeenAt: day("2026-10-01"),
    history: [{ at: day("2023-08-14"), text: "Stjórnandi samkvæmt stillingum" }],
  },
];

const ME = "lu-1";

/* ── The current component's mocked API, as in its own story ── */

const currentApi: MockRoute[] = [
  { match: /^\/api\/config/, body: { default_workspace_id: workspace.id } },
  {
    match: /\/workspaces\/[^/]+\/members$/,
    body: [
      { workspace_id: workspace.id, user_id: "u-1", role: "editor" },
      { workspace_id: workspace.id, user_id: "u-2", role: "admin" },
      { workspace_id: workspace.id, user_id: "u-3", role: "admin" },
    ],
  },
  {
    match: /\/users\/admin\/list/,
    body: apiUsers,
    headers: { "X-Total-Count": String(apiUsers.length) },
  },
];

/* ── Meta ── */

const LOOK_OPTIONS: UserManagementLook[] = ["tafla", "spjold", "skipt", "val"];

const meta = {
  title: "Lab/UserManagement",
  component: UserManagementLab,
  tags: ["skip-visual"],
  args: {
    look: "tafla",
    users: LAB_USERS,
    currentUserId: ME,
    state: "ready",
    errorDetail: "[API 500] Gagnagrunnur svarar ekki",
    pageSize: 10,
    onRetry: fn(),
    onUrlChange: fn(),
  },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    state: { control: "inline-radio", options: ["ready", "loading", "error"] },
    defaultPermission: {
      control: "select",
      options: ["all", "viewer", "member", "moderator", "admin"],
    },
    users: { control: false },
  },
} satisfies Meta<typeof UserManagementLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: UserManagementLook; name: string; idea: string }[] = [
  {
    look: "tafla",
    name: "A · Table",
    idea: "A dense table with a sticky header and sortable columns, for admins at a desk.",
  },
  {
    look: "spjold",
    name: "B · Cards",
    idea: "One card per person with the role picker and suspend button at the bottom; built for phones.",
  },
  {
    look: "skipt",
    name: "C · Split",
    idea: "List on the left, the chosen person's role, access and history on the right; on a phone the panel replaces the list.",
  },
  {
    look: "val",
    name: "D · Bulk",
    idea: "Checkbox rows and one action bar; changes to many people confirm with a count.",
  },
];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const wide = { maxWidth: "72rem" } as const;

/** The current component first, then each look with the same people. */
export const Comparison: Story = {
  name: "Comparison",
  parameters: { auth: "admin", mockApi: currentApi },
  render: (args) => (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>What the app uses today (its own mocked users).</p>
        <UserManagement />
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.idea}</p>
          <UserManagementLab
            {...args}
            look={l.look}
            defaultSelectedId={l.look === "skipt" ? "lu-3" : undefined}
          />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per look ── */

const phone = { viewport: { value: "phone", isRotated: false } };

function storiesFor(look: UserManagementLook, name: string) {
  const base = { look, defaultSelectedId: look === "skipt" ? "lu-3" : undefined };
  const render: Story["render"] = (args) => (
    <div style={wide}>
      <UserManagementLab {...args} />
    </div>
  );
  return {
    populated: { name, args: base, render } satisfies Story,
    empty: {
      name: `${name} — empty`,
      args: { ...base, users: [] },
      render: (args) => (
        <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
          <UserManagementLab {...args} />
          {/* No match for the search, which is the empty state admins actually meet. */}
          <UserManagementLab {...args} users={LAB_USERS} defaultQuery="Zóphanías" />
        </div>
      ),
    } satisfies Story,
    loading: {
      name: `${name} — loading`,
      args: { ...base, state: "loading" },
      render,
    } satisfies Story,
    error: { name: `${name} — error`, args: { ...base, state: "error" }, render } satisfies Story,
    phone: {
      name: `${name} — phone`,
      args: { ...base, defaultSelectedId: undefined },
      globals: phone,
      render,
    } satisfies Story,
  };
}

const table = storiesFor("tafla", "A · Table");
export const Table: Story = table.populated;
export const TableEmpty: Story = table.empty;
export const TableLoading: Story = table.loading;
export const TableError: Story = table.error;
export const TablePhone: Story = table.phone;

const cards = storiesFor("spjold", "B · Cards");
export const Cards: Story = cards.populated;
export const CardsEmpty: Story = cards.empty;
export const CardsLoading: Story = cards.loading;
export const CardsError: Story = cards.error;
export const CardsPhone: Story = cards.phone;

const split = storiesFor("skipt", "C · Split");
export const Split: Story = split.populated;
export const SplitEmpty: Story = split.empty;
export const SplitLoading: Story = split.loading;
export const SplitError: Story = split.error;
export const SplitPhone: Story = split.phone;

const bulk = storiesFor("val", "D · Bulk");
export const Bulk: Story = bulk.populated;
export const BulkEmpty: Story = bulk.empty;
export const BulkLoading: Story = bulk.loading;
export const BulkError: Story = bulk.error;
export const BulkPhone: Story = bulk.phone;

/** The chosen look, with controls, for tweaking. Changing a control remounts it with fresh data. */
export const Playground: Story = {
  name: "Playground",
  render: (args) => (
    <div style={wide}>
      <UserManagementLab key={JSON.stringify({ ...args, users: undefined })} {...args} />
    </div>
  ),
};
