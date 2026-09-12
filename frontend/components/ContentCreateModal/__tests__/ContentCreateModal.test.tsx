import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentCreateModal from "../ContentCreateModal";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken: async () => "t" }),
}));
vi.mock("@/hooks/useTags", () => ({ useTags: () => ({ tagNames: [] }) }));
const created = vi.fn();
vi.mock("@/services/programs.service", () => ({
  createBankContent: (...a: unknown[]) => created(...a),
}));

/**
 * Drive the layout, since the three are genuinely different components and
 * jsdom has no width of its own.
 */
function atWidth(px: number) {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? 0);
    return {
      matches: px >= min,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  });
}

/** jsdom has no IntersectionObserver; the index's position tracking uses one. */
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb(
      [
        {
          target: el,
          isIntersecting: true,
          boundingClientRect: el.getBoundingClientRect(),
        } as unknown as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

const props = {
  contentType: "task" as const,
  workspaceId: "ws-1",
  onCreated: () => {},
  onClose: () => {},
};

beforeEach(() => {
  window.localStorage.clear();
  created.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("one form, three navigation models", () => {
  it("collapses on a phone, because 360×640 holds one section and nothing else", async () => {
    atWidth(390);
    render(<ContentCreateModal {...props} />);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(0)
    );
    // five section bars, one of them open
    const bars = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
    expect(bars).toHaveLength(5);
    expect(bars.filter((b) => b.getAttribute("aria-expanded") === "true")).toHaveLength(1);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows every section at half width, with the index as a chip row", async () => {
    atWidth(800);
    render(<ContentCreateModal {...props} />);

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.getByRole("navigation", { name: "Hlutar eyðublaðsins" })).toBeInTheDocument();
    // Nothing is collapsed, so an error inside a collapsed section — the bug
    // the auto-expand logic exists to survive — cannot occur at this width.
    expect(
      screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))
    ).toHaveLength(0);
  });

  it("puts an index rail beside the flow on a full window", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    const nav = screen.getByRole("navigation", { name: "Hlutar eyðublaðsins" });
    // The rail is a map, not a gate: one entry per section, all five present.
    expect(nav.querySelectorAll("button")).toHaveLength(5);
    expect(
      screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))
    ).toHaveLength(0);
  });
});

describe("what a screen reader gets", () => {
  it("makes every block a landmark named by its own heading", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    for (const label of [
      "Grunnupplýsingar",
      "Upplýsingar",
      "Gögn og búnaður",
      "Leiðbeiningar",
      "Merkimiðar og mynd",
    ]) {
      expect(screen.getByRole("heading", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("says where you are, rather than only colouring it", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const nav = screen.getByRole("navigation");
    const current = [...nav.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-current") === "true"
    );
    expect(current).toHaveLength(1);
  });

  it("puts each section's state in words, not just in a dot", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    // The dot is aria-hidden, so the state has to be spoken separately.
    expect(screen.getAllByText(/ekkert útfyllt/).length).toBeGreaterThan(0);
  });

  it("names the type in the dialog's own label", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/verkefni/);
  });
});

describe("a failed submit", () => {
  it("says what is wrong, marks the field, and takes focus there", async () => {
    // The original bug: the error sat at the bottom of a scrolling modal, so on
    // a phone a failed submit looked like the form had done nothing at all.
    atWidth(390);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Bæta í bankann/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Einn reitur vantar/);
    const name = screen.getByLabelText(/Heiti hugmyndar/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(name).toHaveFocus());
    expect(screen.getByText("Heiti hugmyndar er nauðsynlegt")).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("backs the required asterisk with the word, never a star alone", async () => {
    atWidth(390);
    render(<ContentCreateModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /Bæta í bankann/ }));
    expect(await screen.findByText(/nauðsynlegt/)).toBeInTheDocument();
  });

  it("reopens a collapsed section that holds the error", async () => {
    atWidth(390);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // collapse the one open section, then submit
    const bars = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
    await userEvent.click(bars[0]);
    expect(bars[0]).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(screen.getByRole("button", { name: /Bæta í bankann/ }));

    await waitFor(() => expect(bars[0]).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByText("1 villa")).toBeInTheDocument();
  });
});

describe("no dates", () => {
  it("asks for a length and never for a date", async () => {
    // A bank entry is a template, not an occurrence. The date comes into
    // existence when a leader places it in a plan.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    expect(screen.getByLabelText(/Lengd \(mínútur\)/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(screen.queryByLabelText(/dagsetning/i)).not.toBeInTheDocument();
  });
});
