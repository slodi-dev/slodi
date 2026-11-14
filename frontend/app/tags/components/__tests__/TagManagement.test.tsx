import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagRequestError } from "@/services/tags.service";
import TagManagement from "../TagManagement";

const fetchAllTags = vi.fn();
const fetchTagUsageCount = vi.fn();
const updateTag = vi.fn();
const deleteTag = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
let permissions = "moderator";

vi.mock("@/services/tags.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/tags.service")>()),
  fetchAllTags: (...args: unknown[]) => fetchAllTags(...args),
  fetchTagUsageCount: (...args: unknown[]) => fetchTagUsageCount(...args),
  updateTag: (...args: unknown[]) => updateTag(...args),
  deleteTag: (...args: unknown[]) => deleteTag(...args),
}));

const getToken = async () => "token";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { permissions }, isLoading: false, getToken }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace }),
  usePathname: () => "/tags",
}));

const TAGS = [
  { id: "t-1", name: "Útilíf" },
  { id: "t-2", name: "Hnútar" },
  { id: "t-3", name: "Ratleikni" },
];
const FIELD = "Leita eða búa til merkimiða";

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  permissions = "moderator";
  fetchAllTags.mockResolvedValue(TAGS);
  fetchTagUsageCount.mockImplementation(async (id: string) => (id === "t-2" ? 8 : 0));
});

async function renderLoaded() {
  render(<TagManagement />);
  await screen.findByText("Notað á 8 einingum");
}

describe("the tag page", () => {
  it("refuses a member who isn't a moderator, without loading anything", () => {
    permissions = "member";
    render(<TagManagement />);
    expect(screen.getByText(/í umsjón Dagskrárstjórnarteymisins/)).toBeInTheDocument();
    expect(fetchAllTags).not.toHaveBeenCalled();
  });

  it("offers „Reyna aftur“ when the list fails to load, and loads again", async () => {
    fetchAllTags.mockRejectedValueOnce(new TagRequestError(500, ""));
    render(<TagManagement />);
    await userEvent.click(await screen.findByRole("button", { name: "Reyna aftur" }));
    expect(await screen.findByRole("button", { name: "Eyða Hnútar" })).toBeInTheDocument();
  });

  it("starts from the search in the URL and writes changes back with replace", async () => {
    searchParams = new URLSearchParams("q=hn");
    await renderLoaded();
    expect(screen.getByLabelText(FIELD)).toHaveValue("hn");
    expect(screen.queryByText("Ratleikni")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(FIELD), "ú");
    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith("/tags?q=hn%C3%BA", { scroll: false })
    );
  });

  it("marks an exact match „Er til“", async () => {
    await renderLoaded();
    await userEvent.type(screen.getByLabelText(FIELD), "hnútar");
    expect(screen.getByText("Er til")).toBeInTheDocument();
  });

  it("offers to create a name nothing matches", async () => {
    await renderLoaded();
    await userEvent.type(screen.getByLabelText(FIELD), "Næturleikur");
    expect(screen.getByRole("button", { name: "Búa til „Næturleikur“" })).toBeInTheDocument();
  });

  it("renames in place", async () => {
    updateTag.mockResolvedValue({ id: "t-2", name: "Súrrun" });
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Endurnefna Hnútar" }));
    const field = screen.getByLabelText("Nýtt nafn á „Hnútar“");
    await userEvent.clear(field);
    await userEvent.type(field, "Súrrun{Enter}");

    expect(await screen.findByText("„Hnútar“ heitir nú „Súrrun“.")).toBeInTheDocument();
    expect(updateTag).toHaveBeenCalledWith("t-2", "Súrrun", getToken);
  });

  it("refuses to rename onto another tag's name", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Endurnefna Hnútar" }));
    const field = screen.getByLabelText("Nýtt nafn á „Hnútar“");
    await userEvent.clear(field);
    await userEvent.type(field, "ratleikni{Enter}");

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("confirms a delete with the count, and cancel deletes nothing", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Eyða Hnútar" }));
    const dialog = screen.getByRole("dialog", { name: "Eyða merkimiða?" });
    expect(dialog).toHaveTextContent("„Hnútar“ er notað á 8 einingum");

    const buttons = within(dialog)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(buttons.indexOf("Hætta við")).toBeLessThan(buttons.indexOf("Eyða merkimiða"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Hætta við" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteTag).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Eyða Hnútar" })).toHaveFocus());
  });

  it("deletes after the confirm", async () => {
    deleteTag.mockResolvedValue(undefined);
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Eyða Hnútar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eyða merkimiða" }));

    expect(await screen.findByText("„Hnútar“ eytt.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteTag).toHaveBeenCalledWith("t-2", getToken);
  });

  it("keeps the dialog open with the reason when the delete fails", async () => {
    deleteTag.mockRejectedValue(new TagRequestError(500, ""));
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Eyða Hnútar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eyða merkimiða" }));

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(/Ekki tókst að eyða merkimiðanum/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eyða Hnútar" })).toBeInTheDocument();
  });

  it("treats a tag that's already gone as deleted", async () => {
    deleteTag.mockRejectedValue(new TagRequestError(404, "Tag not found"));
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Eyða Hnútar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eyða merkimiða" }));

    expect(await screen.findByText("„Hnútar“ eytt.")).toBeInTheDocument();
  });
});
