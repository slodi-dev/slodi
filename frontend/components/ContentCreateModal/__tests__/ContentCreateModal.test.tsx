import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentCreateModal from "../ContentCreateModal";
import type { Program } from "@/services/programs.service";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken: async () => "t" }),
}));
vi.mock("@/hooks/useTags", () => ({
  useTags: () => ({ tagNames: ["Leikir", "Útivist", "Samfélagsverkefni"] }),
}));
const created = vi.fn();
const updated = vi.fn();
vi.mock("@/services/programs.service", () => ({
  createBankContent: (...a: unknown[]) => created(...a),
  updateBankContent: (...a: unknown[]) => updated(...a),
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

/** The five collapsible form sections — the only things that control a panel. */
const sectionBars = () =>
  [...document.querySelectorAll<HTMLElement>("[aria-expanded]")].filter((b) =>
    b.getAttribute("aria-controls")?.startsWith("panel-")
  );

const props = {
  contentType: "task" as const,
  workspaceId: "ws-1",
  onCreated: () => {},
  onClose: () => {},
};

beforeEach(() => {
  window.localStorage.clear();
  created.mockReset();
  updated.mockReset();
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
    const bars = sectionBars();
    expect(bars).toHaveLength(6);
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
    // No *form section* is collapsed at this width. The tag picker collapses
    // too, but it is a control inside a section, not a section.
    expect(sectionBars()).toHaveLength(0);
  });

  it("puts an index rail beside the flow on a full window", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    const nav = screen.getByRole("navigation", { name: "Hlutar eyðublaðsins" });
    // The rail is a map, not a gate: one entry per section, all five present.
    expect(nav.querySelectorAll("button")).toHaveLength(6);
    // No *form section* is collapsed at this width. The tag picker collapses
    // too, but it is a control inside a section, not a section.
    expect(sectionBars()).toHaveLength(0);
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
      "Búnaður",
      "Leiðbeiningar",
      "Merkimiðar",
      "Myndir og skjöl",
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
    const bars = sectionBars();
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

    // One label, two boxes and a dash: a range rather than a box that cannot
    // say whether it means the minimum or the whole span.
    expect(screen.getByLabelText("Tímalengd, frá")).toBeInTheDocument();
    expect(screen.getByLabelText("Tímalengd, til")).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(screen.queryByLabelText(/dagsetning/i)).not.toBeInTheDocument();
  });
});

describe("lists, not sentences", () => {
  it("makes each piece of equipment its own item", async () => {
    // "Kaðall, karabínur, hjálmar" in one text box is three things stored as
    // one string: unsearchable, unfilterable, uncorrectable one item at a time.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const input = screen.getByLabelText("Hvað þarf?");
    await userEvent.type(input, "Kaðall");
    await userEvent.click(screen.getByRole("button", { name: "Bæta búnaði á lista" }));
    await userEvent.type(input, "Karabínur{Enter}");

    const list = screen.getByRole("list", { name: "Hvað þarf?" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Kaðall")).toBeInTheDocument();
    expect(screen.getByText("Karabínur")).toBeInTheDocument();
  });

  it("refuses the same item twice, whatever the casing", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const input = screen.getByLabelText("Hvað þarf?");
    await userEvent.type(input, "Kaðall{Enter}");
    await userEvent.type(input, "kaðall{Enter}");

    expect(screen.getByRole("list", { name: "Hvað þarf?" }).querySelectorAll("li")).toHaveLength(1);
  });

  it("editing an item takes it out of the list and back into the box", async () => {
    // Which is what editing a one-word item is. An inline field would need its
    // own save and cancel for no gain.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const input = screen.getByLabelText("Hvað þarf?");
    await userEvent.type(input, "Hjálmar{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Breyta Hjálmar" }));

    expect(screen.queryByRole("list", { name: "Hvað þarf?" })).not.toBeInTheDocument();
    expect(input).toHaveValue("Hjálmar");
    expect(input).toHaveFocus();
  });

  it("removes an item on the ×", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const input = screen.getByLabelText("Hvað þarf?");
    await userEvent.type(input, "Reipi{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Fjarlægja Reipi" }));

    expect(screen.queryByText("Reipi")).not.toBeInTheDocument();
  });

  it("does not submit the form when Enter adds an item", async () => {
    // Enter inside the chip input must not reach the dialog, or a half-typed
    // piece of equipment would submit everything.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Hvað þarf?"), "Kaðall{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });
});

describe("age bands", () => {
  it("offers all seven, not the five that fitted in the old form", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    for (const band of [
      "Hrefnuskátar",
      "Drekaskátar",
      "Fálkaskátar",
      "Dróttskátar",
      "Rekkaskátar",
      "Róverskátar",
      "Vættaskátar",
    ]) {
      expect(screen.getByRole("checkbox", { name: band })).toBeInTheDocument();
    }
  });

  it("ticks each band in its own patrol colour", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const drekar = screen.getByRole("checkbox", { name: "Drekaskátar" }).closest("label");
    const drott = screen.getByRole("checkbox", { name: "Dróttskátar" }).closest("label");
    expect(drekar?.getAttribute("style")).toContain("--sl-color-patrol-drekar");
    expect(drott?.getAttribute("style")).toContain("--sl-color-patrol-drott");
  });
});

describe("one drop zone, sorted by type", () => {
  it("is operable without dragging, because a drop zone is not keyboard-reachable", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    // The picker is the primary control, not a fallback.
    expect(screen.getByRole("button", { name: /Velja skrár/ })).toBeInTheDocument();
  });

  it("accepts both pictures and documents from the same control", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const accept = document.querySelector<HTMLInputElement>("#drop-input")?.accept ?? "";
    for (const type of [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/msword",
    ]) {
      expect(accept).toContain(type);
    }
  });

  it("offers nothing the upload endpoint would refuse", async () => {
    // The allowlist here has to match app/domain/upload_constraints.py; a
    // format offered and then rejected is worse than one never offered.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const accept = document.querySelector<HTMLInputElement>("#drop-input")?.accept ?? "";
    expect(accept).not.toContain("text/html");
    expect(accept).not.toContain("svg");
  });

  it("still takes a URL, for a picture that is already hosted", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.getByLabelText(/Eða vefslóð myndar/)).toBeInTheDocument();
  });
});

describe("merkimiðar are picked, not invented", () => {
  it("offers the vocabulary as a searchable list, not a text box", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    expect(screen.getByRole("combobox", { name: /Merkimiðar/ })).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "Merkimiðar" });
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(3);
  });

  it("filters as you type", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("combobox", { name: /Merkimiðar/ }), "úti");

    const list = screen.getByRole("listbox", { name: "Merkimiðar" });
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Útivist/ })).toBeInTheDocument();
  });

  it("says so when nothing matches, rather than showing an empty box", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("combobox", { name: /Merkimiðar/ }), "klifur");
    expect(screen.getByText(/Enginn merkimiði passar/)).toBeInTheDocument();
  });

  it("selects with the keyboard and shows a chip", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const search = screen.getByRole("combobox", { name: /Merkimiðar/ });
    search.focus();
    await userEvent.keyboard("{ArrowDown}{Enter}");

    const chips = screen.getByRole("list", { name: "Valdir merkimiðar" });
    expect(chips.querySelectorAll("li")).toHaveLength(1);
  });

  it("does not submit the form when Enter picks a tag", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    const search = screen.getByRole("combobox", { name: /Merkimiðar/ });
    search.focus();
    await userEvent.keyboard("{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("does not restrict equipment, which is not a shared vocabulary", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Hvað þarf?"), "Snjóþrúgur{Enter}");
    expect(screen.getByText("Snjóþrúgur")).toBeInTheDocument();
  });
});

describe("two choices in quick succession", () => {
  // Every one of these used to compute `[...current, next]` from an array
  // captured at render, so the first of two rapid picks was silently lost.
  it("keeps both tags", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    screen.getByRole("option", { name: /Útivist/ }).click();
    screen.getByRole("option", { name: /Leikir/ }).click();

    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: "Valdir merkimiðar" }).querySelectorAll("li")
      ).toHaveLength(2)
    );
  });

  it("keeps both age bands", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    screen.getByRole("checkbox", { name: "Fálkaskátar" }).click();
    screen.getByRole("checkbox", { name: "Dróttskátar" }).click();

    await waitFor(() =>
      expect(document.querySelectorAll("input[type=checkbox]:checked")).toHaveLength(2)
    );
  });
});

describe("a long vocabulary", () => {
  it("caps the list and scrolls it, instead of growing the modal", async () => {
    // 150 merkimiðar must leave the list exactly as tall as three do.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    expect(screen.getByRole("listbox", { name: "Merkimiðar" })).toBeInTheDocument();
    // jsdom applies no stylesheet, so the cap is pinned against the source.
    // It is a CSS-only guarantee and this is the only place it can be caught.
    const css = readFileSync(
      join(process.cwd(), "components/ContentCreateModal/ContentCreateModal.module.css"),
      "utf8"
    );
    // 5.5 rows: the half-row at the fold is what says "there is more".
    expect(css).toMatch(/max-height:\s*calc\(var\(--pick-row\) \* 5\.5/);
    expect(css).toMatch(/\.pickerList\b[\s\S]*?overflow-y:\s*auto/);
  });

  it("collapses, and keeps the chosen chips visible when collapsed", async () => {
    // Hiding what you picked along with the list you picked it from would be
    // the wrong half.
    atWidth(1400);
    render(<ContentCreateModal {...props} />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());

    screen.getByRole("option", { name: /Útivist/ }).click();
    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Valdir merkimiðar" })).toBeInTheDocument()
    );

    const toggle = document.querySelector<HTMLElement>('[aria-controls="tag-picker"]')!;
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox", { name: "Merkimiðar" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Valdir merkimiðar" })).toBeInTheDocument();
  });
});

/**
 * sc-530: editing from a bank card wiped the leiðbeiningar and documents.
 *
 * The card's row is a list summary with no `instructions` and no `media`; the
 * form sent every field, so those went back as cleared. An edit now sends only
 * what changed, and drafts no longer outlive a closed editor.
 */
describe("editing sends only what changed", () => {
  /** What the bank list returns: no `instructions`, no `media`. */
  const row: Program = {
    id: "item-1",
    content_type: "task",
    name: "Fánaleikur í myrkri",
    description: "Leikur í myrkri",
    public: true,
    like_count: 3,
    liked_by_me: false,
    created_at: "2026-09-01T12:00:00Z",
    author_id: "u-1",
    author_name: "Sigurður",
    image: "https://example.test/hero.jpg",
    workspace_id: "ws-1",
    author: { id: "u-1", name: "Sigurður", email: "s@test.is" },
    workspace: { id: "ws-1", name: "Dagskrárbankinn" },
    tags: [{ id: "t-1", name: "Leikir" }],
  };
  /** The same item as `/content/{id}` returns it. */
  const full: Program = {
    ...row,
    instructions: "1. Slökkvið ljósin.\n2. Felið fánann.",
    media: {
      images: [{ name: "Forsíða", url: "https://example.test/hero.jpg" }],
      documents: [{ name: "Leikreglur.pdf", url: "https://example.test/leikreglur.pdf" }],
    },
  };
  const editProps = (initial: Program) => ({ ...props, initial });
  const save = () => userEvent.click(screen.getByRole("button", { name: "Vista breytingar" }));
  const sent = () => updated.mock.calls[0][2] as Record<string, unknown>;

  beforeEach(() => {
    updated.mockResolvedValue(full);
  });

  it("sends a new title alone, even from a row without instructions or media", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...editProps(row)} />);
    const title = screen.getByLabelText(/Heiti hugmyndar/);

    await userEvent.clear(title);
    await userEvent.type(title, "Fánaleikur (uppfært)");
    await save();

    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(updated.mock.calls[0][0]).toBe("task");
    expect(updated.mock.calls[0][1]).toBe("item-1");
    expect(sent()).toEqual({ name: "Fánaleikur (uppfært)" });
    expect(sent()).not.toHaveProperty("instructions");
    expect(sent()).not.toHaveProperty("media");
  });

  it("still sends a cleared field as null, so clearing keeps working", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...editProps(full)} />);

    await userEvent.clear(screen.getByLabelText("Hvernig gengur þetta fyrir sig?"));
    await save();

    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ instructions: null });
  });

  it("sends media only when the attachments changed, keeping the rest of it", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...editProps(full)} />);

    await userEvent.click(screen.getByRole("button", { name: "Fjarlægja Leikreglur.pdf" }));
    await save();

    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      media: { images: [{ name: "Forsíða", url: "https://example.test/hero.jpg" }], documents: [] },
    });
  });
});

describe("edit drafts", () => {
  const item: Program = {
    id: "item-2",
    content_type: "task",
    name: "Kveikjuleikur",
    description: null,
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
    instructions: "Kveikið eld.",
  };
  const key = "bank-edit-item-2";

  it("leaves nothing behind when the form is only opened", async () => {
    atWidth(1400);
    const { unmount } = render(<ContentCreateModal {...props} initial={item} />);
    await new Promise((r) => setTimeout(r, 500));
    expect(window.localStorage.getItem(key)).toBeNull();
    unmount();
  });

  it("clears the draft when closed with ×", async () => {
    atWidth(1400);
    const onClose = vi.fn();
    render(<ContentCreateModal {...props} initial={item} onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Heiti hugmyndar/), " í myrkri");
    await waitFor(() => expect(window.localStorage.getItem(key)).not.toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Loka" }));
    expect(onClose).toHaveBeenCalled();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("clears the draft when closed with Escape", async () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} initial={item} />);

    await userEvent.type(screen.getByLabelText(/Heiti hugmyndar/), "!");
    await waitFor(() => expect(window.localStorage.getItem(key)).not.toBeNull());

    await userEvent.keyboard("{Escape}");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("offers a stored draft instead of silently applying it", async () => {
    // What a card-opened editor used to leave behind: the instructions blank.
    window.localStorage.setItem(key, JSON.stringify({ name: "Kveikjuleikur", instructions: "" }));
    atWidth(1400);
    render(<ContentCreateModal {...props} initial={item} />);

    expect(screen.getByText(/óvistaðar breytingar/)).toBeInTheDocument();
    // The form shows the item as stored until the leader chooses the draft.
    expect(screen.getByLabelText("Hvernig gengur þetta fyrir sig?")).toHaveValue("Kveikið eld.");

    await userEvent.click(screen.getByRole("button", { name: "Byrja frá því sem er vistað" }));
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(screen.queryByText(/óvistaðar breytingar/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Hvernig gengur þetta fyrir sig?")).toHaveValue("Kveikið eld.");
  });

  it("applies the stored draft when the leader asks for it", async () => {
    window.localStorage.setItem(key, JSON.stringify({ name: "Kveikjuleikur 2" }));
    atWidth(1400);
    render(<ContentCreateModal {...props} initial={item} />);

    expect(screen.getByLabelText(/Heiti hugmyndar/)).toHaveValue("Kveikjuleikur");
    await userEvent.click(screen.getByRole("button", { name: "Halda áfram með þær" }));
    expect(screen.getByLabelText(/Heiti hugmyndar/)).toHaveValue("Kveikjuleikur 2");
  });

  it("does not offer anything when there is no stored draft", () => {
    atWidth(1400);
    render(<ContentCreateModal {...props} initial={item} />);
    expect(screen.queryByText(/óvistaðar breytingar/)).not.toBeInTheDocument();
  });
});
