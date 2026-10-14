import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ContentQuery, Program } from "@/services/programs.service";
import { PROGRAMS_PER_PAGE } from "@/constants/config";
import ProgramsPage from "../page";

/**
 * sc-615: when the bank fetches. The first load and a page click used to wait
 * out a 300 ms debounce before the request even started, and typed search
 * waited twice (300 ms in the search box, then 300 ms more in usePrograms).
 * Only typing is debounced now, once, in the search box.
 *
 * Every test counts calls to `fetchPrograms`. Timers are fake, so "fetched
 * immediately" means "fetched before any time has passed".
 */

type Call = { query: ContentQuery; offset: number; signal?: AbortSignal; at: number };

const calls: Call[] = [];
/** Lets a test hold a response back and release it later. */
let respond: (call: Call) => Promise<{ items: Program[]; total: number }>;

const rowsFor = (offset: number, label = ""): Program[] =>
  Array.from({ length: PROGRAMS_PER_PAGE }, (_, i) => ({
    id: `item-${offset + i}`,
    content_type: "task",
    name: `Atriði ${offset + i + 1}${label}`,
    description: "",
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
  }));

vi.mock("@/services/programs.service", () => ({
  fetchPrograms: (
    _ws: string,
    _getToken: unknown,
    opts: { query: ContentQuery; offset: number; signal?: AbortSignal }
  ) => {
    const call = { query: opts.query, offset: opts.offset, signal: opts.signal, at: Date.now() };
    calls.push(call);
    return respond(call);
  },
  fetchContentFacets: async () => ({ tags: [], equipment: [], authors: [], locations: [] }),
  fetchProgramById: vi.fn(),
  deleteBankContent: vi.fn(),
}));

let searchParams = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/programs",
}));

const useUserWorkspace = vi.fn(() => ({ workspaceId: null }));
vi.mock("@/hooks/useUserWorkspace", () => ({ useUserWorkspace: () => useUserWorkspace() }));
vi.mock("@/services/suspensions.service", () => ({ fetchMySuspension: async () => null }));
vi.mock("@/hooks/useDefaultWorkspaceId", () => ({ useDefaultWorkspaceId: () => "ws-1" }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: () => ({ role: "viewer" }) }));
const getToken = async () => "t";
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-1", permissions: "member" }, getToken }),
}));
vi.mock("@/contexts/LikesContext", () => ({
  useLikes: () => ({ likeCount: 0, isLiked: false, toggleLike: vi.fn() }),
}));
vi.mock("@/contexts/FavoritesContext", () => ({
  useFavorite: () => ({ isFavorite: false, toggleFavorite: vi.fn() }),
}));
vi.mock("@/components/ContentCreateModal/ContentCreateModal", () => ({ default: () => null }));

/**
 * Let `ms` of fake time pass, a millisecond at a time. React holds state
 * updates until `act` returns, so one big step would hide a timer that a
 * re-render in the middle of it schedules (the search box's debounce firing,
 * say, and the fetch it leads to).
 */
const elapse = async (ms: number) => {
  for (let i = 0; i < Math.max(ms, 1); i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms === 0 ? 0 : 1);
    });
  }
};

/** Calls that were not abandoned: the requests a reader actually waits on. */
const live = () => calls.filter((c) => !c.signal?.aborted);

let start = 0;
beforeEach(() => {
  vi.useFakeTimers();
  start = Date.now();
  calls.length = 0;
  searchParams = new URLSearchParams();
  replace.mockClear();
  useUserWorkspace.mockClear();
  respond = async ({ offset }) => ({ items: rowsFor(offset), total: 100 });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Type one character at a time, `gap` ms apart, the way a reader does. */
const type = async (box: HTMLElement, text: string, gap = 100) => {
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(box, { target: { value: text.slice(0, i) } });
    if (i < text.length) await elapse(gap);
  }
};

describe("when the bank fetches (sc-615)", () => {
  it("fetches the first page on load, with no debounce delay", async () => {
    render(<ProgramsPage />);
    await elapse(0);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ offset: 0, at: start });
    expect(screen.getByText("Atriði 1")).toBeInTheDocument();
  });

  it("fetches once on load, even after the search box's own debounce has run", async () => {
    render(<ProgramsPage />);
    await elapse(1000);

    expect(calls).toHaveLength(1);
    // Nothing moved, so nothing was written to the URL either.
    expect(replace).not.toHaveBeenCalled();
  });

  it("fetches once on load under StrictMode's double effect", async () => {
    render(
      <StrictMode>
        <ProgramsPage />
      </StrictMode>
    );
    await elapse(1000);

    // StrictMode mounts, unmounts and remounts; the first request is aborted
    // before it can reach the network (the real call awaits the token first).
    expect(live()).toHaveLength(1);
  });

  it("does not call useUserWorkspace, which can POST a workspace", async () => {
    render(<ProgramsPage />);
    await elapse(0);

    expect(useUserWorkspace).not.toHaveBeenCalled();
  });

  it("fetches the next page as soon as it is clicked, and puts it in the URL", async () => {
    render(<ProgramsPage />);
    await elapse(0);
    const clickedAt = Date.now();

    fireEvent.click(screen.getByRole("button", { name: "Síða 2" }));
    await elapse(0);

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ offset: PROGRAMS_PER_PAGE, at: clickedAt });
    expect(replace).toHaveBeenLastCalledWith("/programs?page=2", { scroll: false });
    expect(screen.getByText(`Atriði ${PROGRAMS_PER_PAGE + 1}`)).toBeInTheDocument();
  });

  it("debounces typed search, once, and sends it from the first page", async () => {
    render(<ProgramsPage />);
    await elapse(0);
    fireEvent.click(screen.getByRole("button", { name: "Síða 2" }));
    await elapse(0);
    expect(calls).toHaveLength(2);

    await type(screen.getByRole("searchbox"), "fán");
    await elapse(299);
    expect(calls).toHaveLength(2);

    await elapse(1);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toMatchObject({ offset: 0, query: { search: "fán" } });

    // No second request for the same search, and none for page 2 of it.
    await elapse(1000);
    expect(calls).toHaveLength(3);
    expect(replace).toHaveBeenLastCalledWith("/programs?search=f%C3%A1n", { scroll: false });
  });

  it("changing the sort on page 2 fetches page 1 once, not page 2 first", async () => {
    render(<ProgramsPage />);
    await elapse(0);
    fireEvent.click(screen.getByRole("button", { name: "Síða 2" }));
    await elapse(0);

    fireEvent.change(screen.getByRole("combobox", { name: "Raða dagskrám" }), {
      target: { value: "oldest" },
    });
    await elapse(1000);

    expect(calls).toHaveLength(3);
    expect(calls[2]).toMatchObject({ offset: 0, query: { sortBy: "oldest" } });
  });

  it("opens a shared or refreshed link on the page and filters it names", async () => {
    searchParams = new URLSearchParams("search=leikur&page=3");
    render(<ProgramsPage />);
    await elapse(1000);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      offset: 2 * PROGRAMS_PER_PAGE,
      at: start,
      query: { search: "leikur" },
    });
    expect(screen.getByRole("searchbox")).toHaveValue("leikur");
    expect(screen.getByRole("button", { name: "Síða 3" })).toHaveAttribute("aria-current", "page");
  });

  it("moves a link past the last page onto the last page", async () => {
    searchParams = new URLSearchParams("page=20");
    respond = async ({ offset }) => ({ items: offset >= 100 ? [] : rowsFor(offset), total: 100 });
    render(<ProgramsPage />);
    await elapse(100);

    const lastPage = Math.ceil(100 / PROGRAMS_PER_PAGE);
    expect(calls.map((c) => c.offset)).toEqual([
      19 * PROGRAMS_PER_PAGE,
      (lastPage - 1) * PROGRAMS_PER_PAGE,
    ]);
    expect(replace).toHaveBeenLastCalledWith(`/programs?page=${lastPage}`, { scroll: false });
  });

  it("ignores, and aborts, the response for a page the reader has already left", async () => {
    render(<ProgramsPage />);
    await elapse(0);

    // Page 3 is slow; the reader moves on to page 4 before it answers.
    let releaseThird: () => void = () => {};
    respond = ({ offset }) =>
      offset === 2 * PROGRAMS_PER_PAGE
        ? new Promise((r) => {
            releaseThird = () => r({ items: rowsFor(offset, " (seint)"), total: 100 });
          })
        : Promise.resolve({ items: rowsFor(offset), total: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Síða 3" }));
    await elapse(0);
    fireEvent.click(screen.getByRole("button", { name: "Síða 4" }));
    await elapse(0);

    const third = calls.find((c) => c.offset === 2 * PROGRAMS_PER_PAGE)!;
    expect(third.signal?.aborted).toBe(true);

    releaseThird();
    await elapse(0);
    expect(screen.getByText(`Atriði ${3 * PROGRAMS_PER_PAGE + 1}`)).toBeInTheDocument();
    expect(screen.queryByText(/\(seint\)/)).not.toBeInTheDocument();
  });
});
