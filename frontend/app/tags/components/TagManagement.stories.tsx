import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import TagManagement from "./TagManagement";
import {
  MANY_TAGS,
  createdRoute,
  listRoute,
  pageRoutes,
  renamedRoute,
  usageRoutes,
} from "./tagStoryMocks";

const FIELD = "Leita eða búa til merkimiða";

const meta = {
  title: "Components/Stjórnun/TagManagement",
  component: TagManagement,
  parameters: {
    auth: "moderator",
    mockApi: pageRoutes,
    nextjs: { navigation: { pathname: "/tags" } },
    docs: {
      description: {
        component:
          "Moderator page for the bank's shared merkimiðar (look A · Find or create from the " +
          "Lab). One field searches as you type and creates on Enter when no tag has the name; " +
          "an exact match is highlighted and marked „Er til“. Rename is in place. Delete is " +
          "permanent in the backend, so it asks first in the shared Modal, with how many items " +
          "use the tag. Search and page live in the URL, written with `replace`. Non-moderators " +
          "see a refusal.",
      },
    },
  },
} satisfies Meta<typeof TagManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waits until the list and its usage counts are on screen. */
async function loaded(canvasElement: HTMLElement, usage = "Notað á 23 einingum") {
  const canvas = within(canvasElement);
  await canvas.findByText(usage);
  return canvas;
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

export const Paginated: Story = {
  parameters: { mockApi: [listRoute(MANY_TAGS), ...usageRoutes()] },
  play: async ({ canvasElement }) => {
    // Drekaskátar is on the first page; Útilíf is on the last.
    const canvas = await loaded(canvasElement, "Notað á 12 einingum");
    await expect(canvas.getByText("Síða 1 af 3")).toBeInTheDocument();
  },
};

/** Opened from a shared link: `/tags?q=út` lists only what matches. */
export const SearchFromUrl: Story = {
  parameters: { nextjs: { navigation: { pathname: "/tags", query: { q: "út" } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText(FIELD)).toHaveValue("út");
    await expect(await canvas.findByText("Leitin skilar 3 merkimiðum")).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { mockApi: [listRoute([], { delay: Infinity })] },
};

export const Empty: Story = {
  parameters: { mockApi: [listRoute([])] },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Engir merkimiðar enn.");
  },
};

/** Nothing matches the search, and the empty state offers to create it. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.type(canvas.getByLabelText(FIELD), "Næturleikur");
    await expect(canvas.getByRole("button", { name: "Búa til „Næturleikur“" })).toBeInTheDocument();
  },
};

export const LoadError: Story = {
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [listRoute([], { status: 500, body: { detail: "Villa" } })],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Reyna aftur" })).toBeInTheDocument();
  },
};

/** Typing a name that exists marks its row „Er til“; Enter refuses it inline, focus stays. */
export const Duplicate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    const field = canvas.getByLabelText(FIELD);
    await userEvent.type(field, "útilíf");
    await expect(canvas.getByText("Er til")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect(
      await canvas.findByText(/Merkimiði með þessu nafni er þegar til/)
    ).toBeInTheDocument();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeEnabled();
    await expect(field).toHaveFocus();
  },
};

const LONG_NEW = "Næturleikur í Heiðmörk með vasaljósum og áttavita";

/** The counter shows from 45 of the 50 characters the backend allows. */
export const NearLengthLimit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.type(canvas.getByLabelText(FIELD), LONG_NEW);
    await expect(canvas.getByText(`${LONG_NEW.length} / 50`)).toBeInTheDocument();
  },
};

export const CreateViaEnter: Story = {
  parameters: {
    mockApi: [createdRoute({ id: "t-new", name: "Næturleikur" }), ...pageRoutes],
  },
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    const field = canvas.getByLabelText(FIELD);
    await userEvent.type(field, "Næturleikur{Enter}");
    await expect(await canvas.findByText("„Næturleikur“ bætt við.")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Endurnefna Næturleikur" })
    ).toBeInTheDocument();
    await expect(field).toHaveValue("");
    await expect(field).toHaveFocus();
  },
};

export const Rename: Story = {
  parameters: {
    mockApi: [renamedRoute({ id: "t-3", name: "Hnútar og súrrun" }), ...pageRoutes],
  },
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Endurnefna Hnútar" }));
    const field = canvas.getByLabelText("Nýtt nafn á „Hnútar“");
    await expect(field).toHaveFocus();
    await userEvent.clear(field);
    await userEvent.type(field, "Hnútar og súrrun{Enter}");
    await expect(
      await canvas.findByText("„Hnútar“ heitir nú „Hnútar og súrrun“.")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Endurnefna Hnútar og súrrun" })).toHaveFocus()
    );
  },
};

/** The dialog open: names the tag and how many items use it. */
export const DeleteConfirm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Eyða Útilíf" }));
    const dialog = await canvas.findByRole("dialog", { name: "Eyða merkimiða?" });
    await expect(dialog).toHaveTextContent("„Útilíf“ er notað á 23 einingum");
    await expect(within(dialog).getByRole("button", { name: "Hætta við" })).toHaveFocus();
  },
};

export const DeleteCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Eyða Hnútar" });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hætta við" }));
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const DeleteConfirmed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Eyða Hnútar" }));
    const dialog = await canvas.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eyða merkimiða" }));
    await expect(await canvas.findByText("„Hnútar“ eytt.")).toBeInTheDocument();
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Eyða Hnútar" })).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByLabelText(FIELD)).toHaveFocus());
  },
};

/** The delete fails: the dialog stays open with the reason, and can be tried again. */
export const DeleteFailed: Story = {
  parameters: {
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { method: "DELETE", match: /\/tags\/t-3$/, status: 500, body: { detail: "Villa" } },
      ...pageRoutes,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = await loaded(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Eyða Hnútar" }));
    const dialog = await canvas.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eyða merkimiða" }));
    await expect(
      await within(dialog).findByText(/Ekki tókst að eyða merkimiðanum/)
    ).toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Eyða merkimiða" })).toBeEnabled();
  },
};

export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

export const NotAModerator: Story = { parameters: { auth: "member" } };

export const AuthLoading: Story = { parameters: { auth: "loading" } };
