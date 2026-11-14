import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PlanBench from "../PlanBench";
import { BenchProvider } from "../BenchProvider";
import type { Fundur, Lidur, PlanBenchData } from "@/services/plan.service";

/**
 * SPEC §0: drag is an accelerator, never the only path. Everything below is the
 * *other* path — the one a leader on a keyboard, or on a phone with no drag
 * affordance at all, has to be able to use. If these pass, the assembler works
 * without dnd-kit ever being loaded.
 */

const TODAY = new Date("2026-02-12T12:00:00");

const PATROLS = [
  { id: "p1", name: "Refir" },
  { id: "p2", name: "Ernir" },
];

function lidur(over: Partial<Lidur> = {}): Lidur {
  return {
    id: "l1",
    name: "Liður",
    kind: "dagskra",
    minutes: 20,
    status: "draft",
    theme: "Útilíf",
    venue: null,
    endurmat: null,
    ...over,
  };
}

const ITEMS = [
  lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
  lidur({ id: "b", name: "Hnútar", kind: "dagskra", minutes: 30 }),
  lidur({ id: "c", name: "Ratleikur", kind: "dagskra", minutes: 20 }),
];

function fundur(over: Partial<Fundur> = {}): Fundur {
  return {
    event_id: "f1",
    title: "Flokksfundur Refa",
    date_label: "12. febrúar",
    starts_at: "2026-02-12T19:30:00",
    planned_minutes: 90,
    venue: "Skátaheimilið",
    theme: "Útilíf",
    scope: "per-flokkur",
    week_index: 3,
    of_weeks: 8,
    items: ITEMS,
    ...over,
  };
}

function renderBench(data: PlanBenchData) {
  return render(
    <BenchProvider data={data}>
      <PlanBench today={TODAY} />
    </BenchProvider>
  );
}

const one = (over: Partial<Fundur> = {}): PlanBenchData => ({
  season_id: "s1",
  patrols: PATROLS,
  fundir: [fundur(over)],
});

/**
 * Everything the bench's own live regions hold. There are two, alternating —
 * and dnd-kit mounts one of its own, which is why this is not `[aria-live]`.
 */
function announced(container: HTMLElement) {
  return [...container.querySelectorAll("[data-bench-announcer]")]
    .map((node) => node.textContent)
    .join(" ")
    .trim();
}

/** Row titles in screen order. Scoped to the title node — `getByText(/./)`
 *  matches half the row and quietly returns whichever came first. */
// Rows, not every listitem: an open editor is a listitem of the band too.
function rowNames() {
  return Array.from(document.querySelectorAll("[data-lidur-row]")).map(
    (row) => row.querySelector("[class*='rowTitle']")?.textContent
  );
}

describe("PlanBench", () => {
  it("draws every band of the beinagrind, including the empty one", () => {
    // An empty Slit is something to fill, not an absence to hide (B4).
    renderBench(one());

    expect(screen.getByText("Setning")).toBeInTheDocument();
    expect(screen.getByText("Verkefni fundar")).toBeInTheDocument();
    expect(screen.getByText("Slit")).toBeInTheDocument();
    // The band name is not interpolated into the sentence — it would need the
    // dative — so the heading above carries it and the blank just says it is blank.
    expect(screen.getByText(/Ekkert skráð hér enn/i)).toBeInTheDocument();
  });

  it("reorders within a band with the on-screen buttons", () => {
    renderBench(one());
    expect(rowNames()).toEqual(["Fánastund", "Hnútar", "Ratleikur"]);

    fireEvent.click(screen.getByRole("button", { name: "Færa Ratleikur upp" }));
    expect(rowNames()).toEqual(["Fánastund", "Ratleikur", "Hnútar"]);
  });

  it("will not move a block out of its band", () => {
    // Moving a dagskrá block above Setning is a change of kind, not a reorder —
    // and the sheet groups by band, so it would change the data without
    // changing the screen.
    renderBench(one());

    // Hnútar is first in its band, so the control is not offered at all.
    expect(screen.getByRole("button", { name: "Færa Hnútar upp" })).toBeDisabled();
    expect(rowNames()).toEqual(["Fánastund", "Hnútar", "Ratleikur"]);
  });

  it("disables the move button at the edge rather than doing nothing silently", () => {
    renderBench(one());

    expect(screen.getByRole("button", { name: "Færa Fánastund upp" })).toBeDisabled();
    // Fánastund is alone in Setning, so it cannot move either way.
    expect(screen.getByRole("button", { name: "Færa Fánastund niður" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Færa Ratleikur niður" })).toBeDisabled();
  });

  it("moves a block with the keyboard once it is grabbed", () => {
    renderBench(one());
    const row = screen.getAllByRole("listitem")[1]; // Hnútar, first of its band

    row.focus();
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "ArrowDown" });

    expect(rowNames()).toEqual(["Fánastund", "Ratleikur", "Hnútar"]);
  });

  it("leaves the order alone when the arrows are pressed without grabbing", () => {
    // This is what makes arrow keys safe: tabbing through a fundur to read it
    // must never reorder it.
    renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: "ArrowDown" });

    expect(rowNames()).toEqual(["Fánastund", "Hnútar", "Ratleikur"]);
  });

  it("keeps focus on the block it moved", () => {
    // Without this, focus points at the block's former neighbour and the next
    // arrow press moves the wrong thing.
    renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "ArrowDown" });

    const focused = document.activeElement as HTMLElement;
    expect(within(focused).getByText("Hnútar")).toBeInTheDocument();
  });

  it("announces grab and move to a screen reader", () => {
    const { container } = renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: " " });
    expect(announced(container)).toMatch(/Liður gripinn: Hnútar/);

    fireEvent.keyDown(row, { key: "ArrowDown" });
    expect(announced(container)).toMatch(/Liður færður í sæti 2 af 2: Hnútar/);
  });

  it("removes a block with Delete", () => {
    renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: "Delete" });

    expect(screen.queryByText("Hnútar")).not.toBeInTheDocument();
  });

  it("changes a duration from the keyboard and re-runs the clock", () => {
    renderBench(one());

    const dur = screen.getByRole("button", { name: /Lengd: 10 mínútur/ });
    fireEvent.keyDown(dur, { key: "ArrowDown" }); // longer

    expect(screen.getByRole("button", { name: /Lengd: 15 mínútur/ })).toBeInTheDocument();
    // The block after it now starts five minutes later.
    expect(screen.getByText("19:45")).toBeInTheDocument();
  });

  it("flags a fundur that is over its budget", () => {
    renderBench(one({ planned_minutes: 45 }));
    expect(screen.getByText(/60 \/ 45 mín · 15 yfir/)).toBeInTheDocument();
  });

  it("marks where the past ends", () => {
    renderBench(one());
    expect(screen.getByText("Í dag")).toBeInTheDocument();
  });

  it("says so when there is nothing on the bench", () => {
    renderBench({ season_id: "s1", patrols: PATROLS, fundir: [] });
    expect(screen.getByText(/Engir fundir á þessu starfsári enn/)).toBeInTheDocument();
  });

  it("offers the split on a flokksfundur too", () => {
    // It was once gated to troop-wide fundir, which hid it on exactly the
    // sheets a leader opens the bench to work on — today's and the next few.
    renderBench(one());
    expect(screen.getAllByRole("button", { name: /Skipta á flokka/ }).length).toBeGreaterThan(0);
  });

  it("offers the split on a fundur the whole sveit is at", () => {
    renderBench(one({ scope: "troop-wide" }));
    expect(screen.getAllByRole("button", { name: /Skipta á flokka/ }).length).toBeGreaterThan(0);
  });

  it("splits a band into a column per flokkur", () => {
    renderBench(one({ scope: "troop-wide" }));

    // Verkefni fundar is the second band, and the one with liðir in it.
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    expect(screen.getByText("Refir")).toBeInTheDocument();
    expect(screen.getByText("Ernir")).toBeInTheDocument();
    // Every flokkur got its own copy, so the block appears once per lane.
    expect(screen.getAllByText("Hnútar")).toHaveLength(2);
    expect(screen.getByText(/Lengsti flokkur ræður/)).toBeInTheDocument();
  });

  it("merges a split band back into one shared list", () => {
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    fireEvent.click(screen.getByRole("button", { name: /Sameina í eitt/ }));

    expect(screen.queryByText("Refir")).not.toBeInTheDocument();
    expect(screen.getAllByText("Hnútar")).toHaveLength(1);
  });

  it("opens the editor from the row and edits through it", () => {
    renderBench(one());

    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));
    const name = screen.getByDisplayValue("Hnútar");

    fireEvent.change(name, { target: { value: "Hnútar og bönd" } });
    expect(rowNames()).toContain("Hnútar og bönd");
  });

  it("closes the editor with Lokið, keeping the edit", () => {
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));
    fireEvent.change(screen.getByDisplayValue("Hnútar"), { target: { value: "Nýtt" } });

    fireEvent.click(screen.getByRole("button", { name: "Lokið" }));

    expect(screen.queryByDisplayValue("Nýtt")).not.toBeInTheDocument();
    expect(rowNames()).toContain("Nýtt");
  });

  it("steps a duration by five minutes and re-runs the clock", () => {
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    fireEvent.click(screen.getByRole("button", { name: /Lengja um 5 mínútur/ }));

    // Ratleikur followed a 30-minute block at 20:10; now it follows a 35.
    expect(screen.getByText("20:15")).toBeInTheDocument();
  });

  it("takes a typed duration, committed on blur rather than per keystroke", () => {
    // Committing per keystroke means clearing the field to retype it snaps to
    // the minimum, and the next character lands after a value nobody asked for.
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    const field = screen.getByRole("spinbutton", { name: "Lengd í mínútum" });
    fireEvent.change(field, { target: { value: "" } });
    expect(screen.getByText("20:10")).toBeInTheDocument(); // unchanged so far

    fireEvent.change(field, { target: { value: "50" } });
    fireEvent.blur(field);

    expect(screen.getByText("20:30")).toBeInTheDocument();
  });

  it("clamps a typed duration instead of accepting nonsense", () => {
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    const field = screen.getByRole("spinbutton", { name: "Lengd í mínútum" });
    fireEvent.change(field, { target: { value: "0" } });
    fireEvent.blur(field);

    expect(screen.getByRole("button", { name: /Lengd: 5 mínútur/ })).toBeInTheDocument();
  });

  it("restores the value when the field is left empty", () => {
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    const field = screen.getByRole("spinbutton", { name: "Lengd í mínútum" });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);

    expect(field).toHaveValue(30);
  });

  it("opens and closes the editor with Enter", () => {
    renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByDisplayValue("Hnútar")).toBeInTheDocument();

    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.queryByDisplayValue("Hnútar")).not.toBeInTheDocument();
  });

  it("moves a verkefni between flokkar with the keyboard", () => {
    // SPEC §0 again: the drag is an accelerator, and this is the path that has
    // to work without it.
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const inRefir = screen.getAllByRole("button", { name: /^Refir kl\./ });
    expect(inRefir).toHaveLength(2);

    inRefir[0].focus();
    fireEvent.keyDown(inRefir[0], { key: "ArrowRight" });

    expect(screen.getAllByRole("button", { name: /^Refir kl\./ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Ernir kl\./ })).toHaveLength(3);
  });

  it("offers the sideways move as a button too", () => {
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const block = screen.getAllByRole("button", { name: /^Refir kl\./ })[0];
    fireEvent.click(block); // select, which reveals the actions

    fireEvent.click(screen.getByRole("button", { name: /Færa Hnútar til Ernir/ }));
    expect(screen.getAllByRole("button", { name: /^Ernir kl\./ })).toHaveLength(3);
  });

  it("will not move a block past the first or last flokkur", () => {
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const block = screen.getAllByRole("button", { name: /^Refir kl\./ })[0];
    block.focus();
    fireEvent.keyDown(block, { key: "ArrowLeft" }); // Refir is already leftmost

    expect(screen.getAllByRole("button", { name: /^Refir kl\./ })).toHaveLength(2);
  });

  it("announces a cross-flokkur move", () => {
    const { container } = renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const block = screen.getAllByRole("button", { name: /^Refir kl\./ })[0];
    block.focus();
    fireEvent.keyDown(block, { key: "ArrowRight" });

    expect(announced(container)).toMatch(/Fyrri flokkur: Refir\. Nýr flokkur: Ernir\./);
  });

  it("moves a liður to another fundur from the editor", () => {
    const two: PlanBenchData = {
      season_id: "s1",
      patrols: PATROLS,
      fundir: [
        fundur(),
        {
          ...fundur(),
          event_id: "f2",
          title: "Næsti fundur",
          date_label: "19. febrúar",
          starts_at: "2026-02-19T19:30:00",
          items: [lidur({ id: "z", name: "Slit", kind: "slit", minutes: 10 })],
        },
      ],
    };
    renderBench(two);

    fireEvent.click(screen.getAllByRole("button", { name: "Breyta Hnútar" })[0]);
    fireEvent.change(screen.getByRole("combobox", { name: /Færa lið í annan fund/ }), {
      target: { value: "f2" },
    });

    // One copy left, and it is under the other sheet now.
    expect(screen.getAllByText("Hnútar")).toHaveLength(1);
    const sheets = screen.getAllByRole("region");
    expect(within(sheets[1]).getByText("Hnútar")).toBeInTheDocument();
  });

  it("does not offer a destination when there is only one fundur", () => {
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    expect(screen.getByRole("combobox", { name: /Færa lið í annan fund/ })).toBeDisabled();
  });

  it("lets the row action buttons be used from the keyboard", () => {
    // The buttons live inside the row, so their keydowns bubble into the row's
    // own handler. Without a guard, Space on "Fjarlægja" was preventDefault-ed
    // into a grab and the button could not be operated at all.
    renderBench(one());
    const remove = screen.getByRole("button", { name: "Fjarlægja Hnútar" });

    remove.focus();
    fireEvent.keyDown(remove, { key: " " });

    // Still there, still not grabbed — the row handler must have stayed out of it.
    expect(rowNames()).toEqual(["Fánastund", "Hnútar", "Ratleikur"]);
    fireEvent.click(remove);
    expect(rowNames()).toEqual(["Fánastund", "Ratleikur"]);
  });

  it("moves focus between rows with the arrows when nothing is grabbed", () => {
    // Rows are not DOM siblings — each is keyed, and an open editor sits
    // between them — so this cannot be done by walking nextElementSibling.
    renderBench(one());
    const rows = screen.getAllByRole("listitem");

    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });

    expect(within(document.activeElement as HTMLElement).getByText("Hnútar")).toBeInTheDocument();
  });

  it("keeps the liðir list owning its rows", () => {
    // An element between role="list" and its role="listitem" children breaks
    // the ownership a screen reader uses to say "2 af 3".
    renderBench(one());
    const list = screen.getAllByRole("list")[0];

    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("re-sorts into band order when the editor changes a liður's kind", () => {
    // Kind decides the band, so changing it moves the block — and `move` clamps
    // against a range that assumes the band's items are contiguous.
    renderBench(one());
    fireEvent.click(screen.getByRole("button", { name: "Breyta Hnútar" }));

    const kind = screen.getByRole("combobox", { name: "Tegund liðar" });
    fireEvent.change(kind, { target: { value: "slit" } });

    // It now sits in Slit, after Ratleikur, rather than staying put in Verkefni.
    expect(rowNames()).toEqual(["Fánastund", "Ratleikur", "Hnútar"]);
  });

  it("offers the split-band controls as real buttons", () => {
    // They used to be spans inside the block's own button: invalid HTML, and
    // the browser gives such controls no keyboard activation at all.
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    fireEvent.click(screen.getAllByRole("button", { name: /^Refir kl\./ })[0]);
    const remove = screen.getByRole("button", { name: /Fjarlægja Hnútar/ });

    expect(remove.tagName).toBe("BUTTON");
    expect(remove.closest("button")).toBe(remove); // not nested in another button
    fireEvent.click(remove);
    expect(screen.getAllByRole("button", { name: /^Refir kl\./ })).toHaveLength(1);
  });

  it("keeps both live regions mounted, and alternates between them", () => {
    // A live region inserted into the DOM already holding its text is not
    // announced at all — it has to exist first and then change. And repeating
    // an identical message only re-announces if the text differs from what
    // that region last held, which is what the second region is for.
    const { container } = renderBench(one());
    const regions = container.querySelectorAll("[data-bench-announcer]");
    expect(regions).toHaveLength(2);

    const row = screen.getAllByRole("listitem")[1];
    row.focus();
    fireEvent.keyDown(row, { key: " " });
    const first = [...regions].findIndex((r) => r.textContent);

    fireEvent.keyDown(row, { key: "Escape" });
    const second = [...regions].findIndex((r) => r.textContent);

    // Same nodes throughout — never remounted — and the message moved.
    expect(container.querySelectorAll("[data-bench-announcer]")).toHaveLength(2);
    expect(second).not.toBe(first);
  });

  it("re-announces an identical message", () => {
    const { container } = renderBench(one());
    const row = screen.getAllByRole("listitem")[1];

    row.focus();
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "Escape" });
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(row, { key: "Escape" });

    expect(announced(container)).toMatch(/Sleppt\./);
  });

  it("counts liðir that live in lanes, not just the shared list", () => {
    // splitBand moves a band's liðir out of `items`, so counting `items` alone
    // made the header drop from "3 liðir" to "1 liður" the moment a band was
    // split — next to minutes that were already lane-aware.
    renderBench(one({ scope: "troop-wide" }));
    expect(screen.getByText(/3 liðir/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    // Two lanes × two liðir, plus the one still in Setning.
    expect(screen.getByText(/5 liðir/)).toBeInTheDocument();
  });

  it("still sees an undecided liður after its band is split", () => {
    const undecided = [
      lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
      lidur({ id: "b", name: "Leikur", kind: "dagskra", minutes: 20, status: "unknown" }),
    ];
    renderBench(one({ scope: "troop-wide", items: undecided }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    // One per lane, and the adjective agrees with the count.
    expect(screen.getByText(/2 liðir enn óákveðnir/)).toBeInTheDocument();
  });

  it("agrees the adjective with a single undecided liður", () => {
    const one_ = [
      lidur({ id: "a", name: "Fánastund", kind: "setning", minutes: 10 }),
      lidur({ id: "b", name: "Leikur", kind: "dagskra", minutes: 20, status: "unknown" }),
    ];
    renderBench(one({ items: one_ }));
    expect(screen.getByText(/1 liður enn óákveðinn/)).toBeInTheDocument();
  });

  it("adds a block that fits the slack the button offered", () => {
    // The default of 15 made "+ 5 mín laus" insert a 15-minute block, which
    // lengthened the band and re-clocked everything after it.
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const block = screen.getAllByRole("button", { name: /^Refir kl\./ })[0];
    fireEvent.click(block);
    fireEvent.click(screen.getByRole("button", { name: /Fjarlægja Hnútar/ }));

    // Refir is now 30 short of the 50-minute band.
    const gap = screen.getByRole("button", { name: /Bæta verkefni við hjá Refir/ });
    expect(gap.textContent).toMatch(/30 mín laus/);
    fireEvent.click(gap);

    // 15 fits inside 30, so the band is unchanged at 50.
    expect(screen.getByText(/50 mín samhliða/)).toBeInTheDocument();
  });

  it("gives the drag grip no keyboard role of its own", () => {
    // dnd-kit's attributes would make it a focusable role="button" that
    // responds to no key — one dead tab stop per row, described with keyboard
    // instructions that are false for it. The row is the keyboard surface.
    const { container } = renderBench(one());
    const grips = container.querySelectorAll("[class*='grip']");

    expect(grips.length).toBeGreaterThan(0);
    for (const grip of grips) {
      expect(grip.getAttribute("aria-hidden")).toBe("true");
      expect(grip.getAttribute("role")).toBeNull();
      expect(grip.getAttribute("tabindex")).toBeNull();
    }
  });

  it("does not nest interactive controls inside a lane block", () => {
    // Spreading dnd-kit's attributes onto the positioned wrapper would make it
    // an ARIA button containing the block's own button and its ← → ↑ ✕ strip.
    renderBench(one({ scope: "troop-wide" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Skipta á flokka/ })[1]);

    const block = screen.getAllByRole("button", { name: /^Refir kl\./ })[0];
    const wrapper = block.parentElement as HTMLElement;

    expect(wrapper.getAttribute("role")).toBeNull();
    expect(wrapper.getAttribute("tabindex")).toBeNull();
    // Nothing above the block is a button, by element or by role.
    expect(wrapper.closest("[role='button']")).toBeNull();
    expect(wrapper.closest("button")).toBeNull();
  });
});
