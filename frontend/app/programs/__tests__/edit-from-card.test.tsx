import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Program } from "@/services/programs.service";
import { DEFAULT_FILTERS } from "@/hooks/useProgramFilters";
import ProgramsPage from "../page";

/**
 * sc-530: the bank card used to hand its list row — no `instructions`, no
 * `media` — to the edit form as `initial`, and saving wiped both. The editor
 * must open with the whole item, fetched from `/content/{id}`.
 */

/** What `/workspaces/{id}/content` returns for the card. */
const row: Program = {
  id: "item-1",
  content_type: "task",
  name: "Fánaleikur í myrkri",
  description: "Leikur í myrkri",
  public: true,
  like_count: 0,
  liked_by_me: false,
  created_at: "2026-09-01T12:00:00Z",
  author_id: "u-1",
  author_name: "Sigurður",
  image: null,
  workspace_id: "ws-1",
  author: { id: "u-1", name: "Sigurður", email: "s@test.is" },
  workspace: { id: "ws-1", name: "Dagskrárbankinn" },
};
const full: Program = {
  ...row,
  instructions: "Slökkvið ljósin.",
  media: { images: [], documents: [{ name: "Leikreglur.pdf", url: "https://x.test/l.pdf" }] },
};

const fetchProgramById = vi.fn();
vi.mock("@/services/programs.service", () => ({
  fetchProgramById: (...a: unknown[]) => fetchProgramById(...a),
  deleteBankContent: vi.fn(),
}));
vi.mock("@/services/suspensions.service", () => ({
  fetchMySuspension: async () => null,
}));
vi.mock("@/hooks/usePrograms", () => ({
  default: () => ({
    programs: [row],
    total: 1,
    facets: { tags: [], equipment: [], authors: [], locations: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useProgramFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useProgramFilters")>()),
  useProgramFilters: () => ({
    filters: DEFAULT_FILTERS,
    setFilters: vi.fn(),
    activeChips: [],
    clearAll: vi.fn(),
  }),
}));
vi.mock("@/hooks/useUserWorkspace", () => ({ useUserWorkspace: () => ({ workspaceId: null }) }));
vi.mock("@/hooks/useDefaultWorkspaceId", () => ({ useDefaultWorkspaceId: () => "ws-1" }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: () => ({ role: "editor" }) }));
const getToken = async () => "t";
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-1", permissions: "member" }, getToken }),
}));
vi.mock("@/lib/permissions", () => ({
  canCreateProgram: () => true,
  canEditProgram: () => true,
  canDeleteProgram: () => false,
}));
vi.mock("@/contexts/LikesContext", () => ({
  useLikes: () => ({ likeCount: 0, isLiked: false, toggleLike: vi.fn() }),
}));
vi.mock("@/contexts/FavoritesContext", () => ({
  useFavorite: () => ({ isFavorite: false, toggleFavorite: vi.fn() }),
}));
// The form itself is tested on its own; here it only has to show what it was given.
vi.mock("@/components/ContentCreateModal/ContentCreateModal", () => ({
  default: ({ initial }: { initial: Program | null }) => (
    <div role="dialog" aria-label="Breyta">
      <p>{initial?.instructions ?? "(engar leiðbeiningar)"}</p>
      <p>{initial?.media?.documents?.map((d) => d.name).join(", ")}</p>
    </div>
  ),
}));

beforeEach(() => {
  fetchProgramById.mockReset();
});

describe("editing from a bank card", () => {
  it("fetches the whole item before the editor opens, and edits that", async () => {
    let resolve: (p: Program) => void = () => {};
    fetchProgramById.mockReturnValue(new Promise<Program>((r) => (resolve = r)));
    render(<ProgramsPage />);

    const edit = await screen.findByRole("button", { name: `Breyta ${row.name}` });
    await userEvent.click(edit);

    expect(fetchProgramById).toHaveBeenCalledWith("item-1", getToken, { fresh: true });
    // Still loading: the card says so, and the editor is not open on the row.
    expect(edit).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolve(full);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Slökkvið ljósin.");
    expect(dialog).toHaveTextContent("Leikreglur.pdf");
    expect(edit).not.toHaveAttribute("aria-busy");
  });

  it("does not open the editor with partial data when the fetch fails", async () => {
    fetchProgramById.mockRejectedValue(new Error("500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ProgramsPage />);

    await userEvent.click(await screen.findByRole("button", { name: `Breyta ${row.name}` }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Ekki tókst að opna ${row.name} til breytinga`
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
