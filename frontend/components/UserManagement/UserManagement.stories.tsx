import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import type { User, UserPermissions } from "@/services/users.service";
import type { WorkspaceRole } from "@/services/workspaces.service";
import { userAdmin, workspace } from "@/stories/fixtures";
import UserManagement from "./UserManagement";

/* ── Fixtures: made-up members of a made-up scout group ── */

function person(id: string, name: string, email: string, permissions: UserPermissions): User {
  return { id, auth0_id: `auth0|${id}`, name, email, permissions, pronouns: null };
}

/** The signed-in admin (`auth: "admin"`) is `userAdmin`, Halla Björk, and is in the list. */
const PEOPLE: User[] = [
  userAdmin,
  person("su-2", "Gunnar Þór Ólafsson", "gunnar@vifill.example", "moderator"),
  person(
    "su-3",
    "Sigurbjörg Guðríður Aðalheiður Þorvaldsdóttir Kjerúlf",
    "sigurbjorg.gudridur.adalheidur.thorvaldsdottir@skatafelagid-hraunbuar.example",
    "member"
  ),
  person("su-4", "Aron Freyr Kristjánsson", "aron.freyr@vifill.example", "viewer"),
  person("su-5", "Ýmir Breki Sæmundsson", "ymir@landnemar.example", "member"),
  person("su-6", "Þórdís Lilja Hrafnsdóttir", "thordis.lilja@kopar.example", "member"),
  person("su-7", "Kári Steinn Jóhannsson", "kari@vifill.example", "viewer"),
  person("su-8", "Embla Ósk Guðmundsdóttir", "embla.osk@aegisbuar.example", "moderator"),
  person("su-9", "Bergur Logi Árnason", "bergur@kopar.example", "member"),
  person("su-10", "Ástrós Eva Pálsdóttir", "astros.eva@landnemar.example", "viewer"),
  person("su-11", "Dagur Hrafn Benediktsson", "dagur.hrafn@aegisbuar.example", "member"),
  person("su-12", "Sól Védís Kristinsdóttir", "sol@vifill.example", "member"),
  person("su-13", "Jökull Máni Haraldsson", "jokull.mani@hraunbuar.example", "viewer"),
  person("su-14", "Ragnheiður Ylfa Magnúsdóttir", "ragnheidur.ylfa@bandalag.example", "admin"),
];

const BANK_ROLES: Record<string, WorkspaceRole> = {
  [userAdmin.id]: "owner",
  "su-2": "admin",
  "su-3": "editor",
  "su-4": "viewer",
  "su-6": "editor",
  "su-8": "editor",
  "su-14": "admin",
};

/* ── The API, as `users.service` and `workspaces.service` call it ── */

/** `listAllUsers` reads a bare array and the total from `X-Total-Count`. */
function listRoute(items: User[]): MockRoute {
  return {
    match: /\/users\/admin\/list/,
    body: items,
    headers: { "X-Total-Count": String(items.length) },
  };
}

function membersRoute(roles: Record<string, WorkspaceRole> = BANK_ROLES): MockRoute {
  return {
    match: /\/workspaces\/[^/]+\/members$/,
    body: Object.entries(roles).map(([user_id, role]) => ({
      workspace_id: workspace.id,
      user_id,
      role,
    })),
  };
}

const idFrom = (url: URL) => url.pathname.split("/").filter(Boolean).at(-1) ?? "";
const userIdFrom = (url: URL) => url.pathname.split("/").filter(Boolean).at(-2) ?? "";

/** PATCH /users/:id answers with the user as changed, so a save and its undo both land. */
const patchUserRoute: MockRoute = {
  match: /\/users\/[^/]+$/,
  method: "PATCH",
  body: (url: URL, sent: unknown) => ({
    ...(PEOPLE.find((u) => u.id === idFrom(url)) ?? PEOPLE[0]),
    ...(sent as Partial<User>),
  }),
};

/** PUT /workspaces/:id/members/:user/role answers with the role it was sent. */
const putBankRoleRoute: MockRoute = {
  match: /\/workspaces\/[^/]+\/members\/[^/]+\/role$/,
  method: "PUT",
  body: (url: URL, sent: unknown) => ({
    workspace_id: workspace.id,
    user_id: userIdFrom(url),
    role: (sent as { role: WorkspaceRole }).role,
  }),
};

const deleteUserRoute: MockRoute = { match: /\/users\/[^/]+$/, method: "DELETE", status: 204 };

const API: MockRoute[] = [
  patchUserRoute,
  putBankRoleRoute,
  deleteUserRoute,
  membersRoute(),
  listRoute(PEOPLE),
];

function at(query: Record<string, string> = {}) {
  return { nextjs: { navigation: { pathname: "/admin", query } } };
}

/** Opened on a link to Sigurbjörg, a member with an editor role in the bank. */
const SIGURBJORG = at({ notandi: "su-3" });

const phone = { viewport: { value: "phone", isRotated: false } };

/** The services log a failed request; these stories fail requests on purpose. */
const allowFailedRequest = { allowedConsoleErrors: [/\[API 500\]/] };

const meta = {
  title: "Components/Admin/UserManagement",
  component: UserManagement,
  parameters: {
    auth: "admin",
    mockApi: API,
    ...at(),
    docs: {
      description: {
        component:
          "Platform admins' list of users. The list on the left (search, a permission filter " +
          "with counts, pages of 20), one person on the right: their platform permission, their " +
          "role in the shared programme bank, and delete. On a phone the panel replaces the list. " +
          "Picked as C · Split in the Lab (2026-10-19, promoted 2026-10-20); see **Rationale**. " +
          "Everything here is in the API today; freeze, join/last-seen and history wait for sc-640.",
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: "56rem" }}>
      <UserManagement />
    </div>
  ),
} satisfies Meta<typeof UserManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

/** The open person's panel. Its name starts with theirs (the own row adds "þú"). */
async function panel(canvas: Canvas, name: string) {
  return canvas.findByRole("article", { name: new RegExp(`^${name}`) });
}

/** One section of the panel: "Réttindi" or "Aðgangur að dagskrárbanka". */
function section(detail: HTMLElement, title: string) {
  return within(within(detail).getByRole("region", { name: new RegExp(`^${title}`) }));
}

/** The bank section appears once the bank roles have loaded, a moment after the list. */
async function bankSection(detail: HTMLElement) {
  return within(await within(detail).findByRole("region", { name: /^Aðgangur að dagskrárbanka/ }));
}

/* ── States ── */

/** Opened on a link to one user: their page of the list, with their panel. */
export const Default: Story = {
  parameters: SIGURBJORG,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const detail = await panel(canvas, PEOPLE[2].name);
    await expect(
      section(detail, "Réttindi").getByRole("radio", { name: /Meðlimur/ })
    ).toBeChecked();
    await expect(
      (await bankSection(detail)).getByRole("radio", { name: /Ritstjóri/ })
    ).toBeChecked();
    // On a phone the panel replaces the list, and the filter goes with it.
    const all = canvas.queryByRole("button", { name: /^Öll/ });
    if (all) await expect(all).toHaveTextContent("14");
  },
};

export const NothingSelected: Story = {};

export const Loading: Story = {
  parameters: { mockApi: [{ match: /\/users\/admin\/list/, delay: Infinity }] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Sæki notendur…")).toBeInTheDocument();
  },
};

/** In the house voice, with "Reyna aftur". The backend's English detail is not shown. */
export const LoadError: Story = {
  parameters: {
    ...allowFailedRequest,
    mockApi: [
      { match: /\/users\/admin\/list/, status: 500, body: { detail: "Database unavailable" } },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("Ekki tókst að sækja notendur.");
    await expect(alert).not.toHaveTextContent("Database");
    await expect(within(alert).getByRole("button", { name: "Reyna aftur" })).toBeVisible();
  },
};

export const NoUsers: Story = {
  parameters: { mockApi: [membersRoute({}), listRoute([])] },
};

/** The empty state admins actually meet: a search with no match, and a way back. */
export const NoMatch: Story = {
  parameters: at({ q: "Zóphanías" }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Enginn notandi passar við „Zóphanías“.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Hreinsa leit og síur" }));
    await expect(await canvas.findByRole("list", { name: "Notendalisti" })).toBeVisible();
  },
};

/** Search ignores case and accents: "astros" finds "Ástrós". The search goes into the URL. */
export const SearchIgnoresAccents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole("searchbox"), "astros");
    const list = await canvas.findByRole("list", { name: "Notendalisti" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(1));
    await expect(within(list).getByRole("button")).toHaveTextContent("Ástrós Eva Pálsdóttir");
    await waitFor(() =>
      expect(getRouter().replace).toHaveBeenLastCalledWith("/admin?q=astros", { scroll: false })
    );
  },
};

export const FilteredByPermission: Story = {
  parameters: at({ rettindi: "moderator" }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Notendalisti" });
    await expect(within(list).getAllByRole("button")).toHaveLength(2);
    await expect(
      canvas.getByRole("button", { name: /Umsjónarmenn dagskrár/, pressed: true })
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /^Öll/ }));
    await waitFor(() =>
      expect(getRouter().replace).toHaveBeenLastCalledWith("/admin", { scroll: false })
    );
  },
};

const MANY: User[] = Array.from({ length: 45 }, (_, i) =>
  person(
    `mu-${i}`,
    `${["Anna", "Bjarki", "Dagný", "Egill", "Freyja"][i % 5]} ${["Jónsdóttir", "Ólafsson", "Sigurðardóttir", "Einarsson"][i % 4]} ${i + 1}`,
    `skati${i + 1}@skatar.example`,
    (["viewer", "member", "member", "moderator"] as const)[i % 4]
  )
);

export const Paginated: Story = {
  parameters: { mockApi: [membersRoute({}), listRoute([userAdmin, ...MANY])] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Síða 1 af 3")).toBeVisible();
  },
};

/** On a phone the list comes first; opening a person replaces it with their panel. */
export const Phone: Story = {
  globals: phone,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Notendalisti" });
    await userEvent.click(within(list).getByRole("button", { name: /Aron Freyr/ }));
    const heading = await canvas.findByRole("heading", { level: 2, name: /Aron Freyr/ });
    await waitFor(() => expect(heading).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "Til baka í lista" }));
    await waitFor(() =>
      expect(within(list).getByRole("button", { name: /Aron Freyr/ })).toHaveFocus()
    );
  },
};

export const PhonePanel: Story = { globals: phone, parameters: SIGURBJORG };

/* ── Keyboard ── */

/**
 * The list is one Tab stop; ↑ ↓ Home End move inside it. Side by side, the selection
 * follows focus and focus stays in the list. On a phone, opening a row would hide the
 * list, so Enter opens it and "Til baka í lista" puts focus back on the row.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Notendalisti" });
    const rows = within(list).getAllByRole("button");
    await expect(rows.filter((r) => r.tabIndex === 0)).toHaveLength(1);

    rows[0].focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(rows[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    await expect(rows[2]).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(rows[rows.length - 1]).toHaveFocus();
    await userEvent.keyboard("{Home}{ArrowDown}");
    await expect(rows[1]).toHaveFocus();
    await expect(rows[1]).toHaveAttribute("tabindex", "0");

    if (rows[1].getAttribute("aria-current") === "true") {
      // Side by side: the selection followed focus, and focus stayed in the list.
      const heading = await canvas.findByRole("heading", { level: 2 });
      await expect(rows[1].textContent).toContain(heading.textContent ?? "");
      await expect(rows[1]).toHaveFocus();
    } else {
      // Stacked (phone): the arrows only move focus; Enter opens the panel.
      await userEvent.keyboard("{Enter}");
      const heading = await canvas.findByRole("heading", { level: 2 });
      await waitFor(() => expect(heading).toHaveFocus());
      await userEvent.click(canvas.getByRole("button", { name: "Til baka í lista" }));
      await waitFor(() => expect(rows[1]).toHaveFocus());
    }
  },
};

/* ── Changes ── */

/** Nothing is saved until "Vista réttindi"; with nothing changed it says so. */
export const SaveOnlyWhenChanged: Story = {
  parameters: SIGURBJORG,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = section(await panel(canvas, PEOPLE[2].name), "Réttindi");
    await userEvent.click(roles.getByRole("button", { name: "Vista réttindi" }));
    await expect(await roles.findByText("Engin breyting til að vista.")).toBeVisible();

    await userEvent.click(roles.getByRole("radio", { name: /Skoðandi/ }));
    await expect(roles.getByText("Meðlimur → Skoðandi, óvistað")).toBeVisible();
    await userEvent.click(roles.getByRole("button", { name: "Hætta við" }));
    await expect(roles.getByRole("radio", { name: /Meðlimur/ })).toBeChecked();
  },
};

/** A promotion to Umsjónarmaður dagskrár always confirms, then offers "Afturkalla". */
export const PromotionConfirms: Story = {
  parameters: SIGURBJORG,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const roles = section(await panel(canvas, PEOPLE[2].name), "Réttindi");
    await userEvent.click(roles.getByRole("radio", { name: /Umsjónarmaður dagskrár/ }));
    await userEvent.click(roles.getByRole("button", { name: "Vista réttindi" }));

    const dialog = await page.findByRole("dialog", { name: "Gera að umsjónarmanni dagskrár?" });
    await expect(within(dialog).getByRole("button", { name: "Hætta við" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Gera að umsjónarmanni" }));

    const status = await canvas.findByText(/er nú umsjónarmaður dagskrár\./);
    await expect(status).toBeVisible();
    const nowRoles = () => section(canvas.getByRole("article"), "Réttindi");
    await waitFor(() =>
      expect(
        nowRoles().getByRole("radio", { name: /Umsjónarmaður dagskrár\s*·\s*núna/ })
      ).toBeChecked()
    );

    await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
    await expect(await canvas.findByText("Afturkallað.")).toBeVisible();
    await waitFor(() =>
      expect(nowRoles().getByRole("radio", { name: /Meðlimur\s*·\s*núna/ })).toBeChecked()
    );
  },
};

/** A refused save keeps the choice and says why, in Icelandic. */
export const SaveFails: Story = {
  parameters: {
    ...SIGURBJORG,
    ...allowFailedRequest,
    mockApi: [
      { match: /\/users\/[^/]+$/, method: "PATCH", status: 500, body: { detail: "boom" } },
      ...API,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roles = section(await panel(canvas, PEOPLE[2].name), "Réttindi");
    await userEvent.click(roles.getByRole("radio", { name: /Skoðandi/ }));
    await userEvent.click(roles.getByRole("button", { name: "Vista réttindi" }));
    const alert = await roles.findByRole("alert");
    await expect(alert).toHaveTextContent("Ekki tókst að vista réttindin. Reyndu aftur");
    await expect(alert).not.toHaveTextContent("boom");
    await expect(roles.getByRole("radio", { name: /Skoðandi/ })).toBeChecked();
  },
};

/** Making someone a bank admin confirms; the bank role saves on its own button. */
export const BankRole: Story = {
  parameters: SIGURBJORG,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const bank = await bankSection(await panel(canvas, PEOPLE[2].name));
    await userEvent.click(bank.getByRole("radio", { name: /Stjórnandi/ }));
    await userEvent.click(bank.getByRole("button", { name: "Vista aðgang" }));
    const dialog = await page.findByRole("dialog", { name: "Gera að stjórnanda dagskrárbankans?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Gera að stjórnanda" }));
    await expect(await canvas.findByText(/er nú stjórnandi í dagskrárbankanum\./)).toBeVisible();
  },
};

/** Delete names the person and can't be undone, so it confirms; focus goes back to the list. */
export const Delete: Story = {
  parameters: at({ notandi: "su-4" }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const detail = await panel(canvas, "Aron Freyr Kristjánsson");
    await userEvent.click(within(detail).getByRole("button", { name: "Eyða notanda…" }));
    const dialog = await page.findByRole("dialog", { name: "Eyða notanda?" });
    await expect(dialog).toHaveTextContent("Aron Freyr Kristjánsson");
    await expect(dialog).toHaveTextContent("Ekki er hægt að afturkalla þetta.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eyða notanda" }));

    await expect(await canvas.findByText("Notanda eytt: Aron Freyr Kristjánsson.")).toBeVisible();
    const list = canvas.getByRole("list", { name: "Notendalisti" });
    await expect(within(list).queryByRole("button", { name: /Aron Freyr/ })).toBeNull();
    await waitFor(() => expect(list.contains(document.activeElement)).toBe(true));
  },
};

/* ── Read-only panels ── */

/** The admin's own row: nothing about their own permission or account can be changed here. */
export const OwnAccount: Story = {
  parameters: at({ notandi: userAdmin.id }),
  play: async ({ canvasElement }) => {
    const detail = within(await panel(within(canvasElement), userAdmin.name));
    await expect(
      detail.getByText(/Þú getur ekki breytt eigin réttindum\. Annar stjórnandi þarf að gera það\./)
    ).toBeVisible();
    await expect(detail.getByText("Þú getur ekki eytt eigin aðgangi.")).toBeVisible();
    await expect(detail.queryByRole("button", { name: "Vista réttindi" })).toBeNull();
  },
};

/** Another platform admin: set in the system config, so read-only here, with the reason. */
export const AnotherAdmin: Story = {
  parameters: at({ notandi: "su-14" }),
  play: async ({ canvasElement }) => {
    const detail = within(await panel(within(canvasElement), "Ragnheiður Ylfa Magnúsdóttir"));
    await expect(
      detail.getByText(/Stjórnendur eru skilgreindir í stillingum kerfisins/)
    ).toBeVisible();
  },
};

/** Without a configured bank the bank section is left out. */
export const NoBank: Story = {
  parameters: {
    ...SIGURBJORG,
    mockApi: [{ match: /^\/api\/config/, body: { default_workspace_id: null } }, ...API],
  },
  beforeEach: () => {
    sessionStorage.removeItem("default_workspace_id");
  },
  play: async ({ canvasElement }) => {
    const detail = await panel(within(canvasElement), PEOPLE[2].name);
    await expect(within(detail).getByRole("region", { name: /^Réttindi/ })).toBeVisible();
    await expect(
      within(detail).queryByRole("region", { name: /^Aðgangur að dagskrárbanka/ })
    ).toBeNull();
  },
};
