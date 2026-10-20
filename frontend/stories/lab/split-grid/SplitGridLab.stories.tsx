import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, LiveSplit } from "@/stories/vinnubekkur/benchHarness";
import { HEADER_LOOKS } from "./headerLooks";
import SplitGridLab, { type SplitGridLabProps } from "./SplitGridLab";
import { FIXTURES, LAB_FUNDUR, type FixtureName } from "./splitGridLabData";

/**
 * The split band built from the bank's own cards. Each liður is the BlockPalette card it came
 * from, and the card is where a foringi changes it for one flokkur: length, status, who leads,
 * the adaptation, búnaður, another block, or back to the sveit's version. The form stays the
 * current SplitGrid's (time down the side, a column per flokkur, "Lengsti flokkur ræður", the
 * merge proposal). K2 · Flip it over was picked: pressing a card turns it over, and its back is
 * the editor, lifted above a grid that doesn't move. Purpose and the bugs fixed in polishing:
 * Lab → SplitGrid → Purpose and directions.
 */

type LabArgs = Omit<SplitGridLabProps, "data"> & { fixture: FixtureName };

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

const meta = {
  title: "Lab/SplitGrid",
  tags: ["skip-visual"],
  args: { fixture: "uneven" },
  argTypes: {
    fixture: { control: "select", options: Object.keys(FIXTURES) },
  },
  render: ({ fixture, ...args }) => (
    <div style={wide}>
      <SplitGridLab {...args} data={FIXTURES[fixture]()} />
    </div>
  ),
} satisfies Meta<LabArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The current SplitGrid first, then K2, both with the same uneven stöðvaleikur. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h2 style={heading}>Current</h2>
        <p style={idea}>
          What the app uses today: text blocks, and nothing to change but the order and the flokkur.
        </p>
        <Bench data={FIXTURES.uneven()}>
          <LiveSplit fundurId={LAB_FUNDUR} band="kjarni" />
        </Bench>
      </section>
      <section>
        <h2 style={heading}>K2 · Flip it over</h2>
        <p style={idea}>
          Each liður is its bank card. Press one and it turns over: the back is the whole editor,
          lifted above the grid, and nothing behind it moves.
        </p>
        <SplitGridLab data={FIXTURES.uneven()} />
      </section>
    </div>
  ),
};

/* ── Helpers for the play tests ── */

const phone = { viewport: { value: "phone", isRotated: false } };
const dark = { theme: "dark" };

/** Lane totals as shown in each column header (`data-lane-total`). */
function totalOf(root: HTMLElement, patrolId: string): string | null | undefined {
  return root.querySelector(`[data-lane-total="${patrolId}"]`)?.textContent;
}

/** A card by flokkur and liður name. */
function card(canvas: ReturnType<typeof within>, patrol: string, name: string) {
  return canvas.getByRole("button", {
    name: new RegExp(`^${patrol} kl\\. \\d\\d:\\d\\d: ${name}`),
  });
}

/** Opens Refir's Hnútar og bönd and makes it 5 minutes longer: Refir's total goes 70 → 75. */
async function lengthen(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín");
  await userEvent.click(card(canvas, "Refir", "Hnútar og bönd"));
  // Focus moves to the back's heading so a screen reader hears what opened.
  await waitFor(() => expect(document.activeElement?.textContent).toContain("Hnútar og bönd"));
  const [longer] = await canvas.findAllByRole("button", { name: "Lengra um 5 mín" });
  await userEvent.click(longer);
  await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("75 mín"));
}

const k2 = {
  uneven: { name: "Uneven", args: { fixture: "uneven" } } satisfies Story,
  open: {
    name: "A changed card, open",
    args: {
      fixture: "uneven",
      defaultOpen: { patrolId: "mock-refir", name: "Áttaviti og kort" },
    },
  } satisfies Story,
  six: { name: "6 flokkar", args: { fixture: "six" } } satisfies Story,
  /** An empty lane; two flokkar; three with long titles, a long name and no date. */
  edge: {
    name: "Empty lane, 2 flokkar, long titles, undated",
    render: () => (
      <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-lg)" }}>
        <SplitGridLab data={FIXTURES.empty()} />
        <SplitGridLab data={FIXTURES.two()} />
        <SplitGridLab data={FIXTURES.longUndated()} />
      </div>
    ),
  } satisfies Story,
  phone: {
    name: "Phone, a card open",
    args: {
      fixture: "uneven",
      defaultOpen: { patrolId: "mock-refir", name: "Áttaviti og kort" },
    },
    globals: phone,
  } satisfies Story,
  dark: {
    name: "Dark, a card open",
    args: {
      fixture: "uneven",
      defaultOpen: { patrolId: "mock-birnir", name: "Hnútar og bönd" },
    },
    globals: dark,
  } satisfies Story,
  /** Length, status, leader, a swap and the way back: every edit lands on the card. */
  edit: {
    name: "Edit a card",
    args: { fixture: "uneven" },
    play: async ({ canvasElement, step }) => {
      const canvas = within(canvasElement);

      await step("length: + makes the card and the column 5 minutes longer", async () => {
        await lengthen(canvasElement);
      });

      await step("status: Drög is on the card at once", async () => {
        await userEvent.click(canvas.getByRole("radio", { name: "Drög" }));
        await expect(canvas.getByRole("radio", { name: "Drög" })).toBeChecked();
        // The front stays in the grid under the lifted back, and carries the change at once.
        await waitFor(() =>
          expect(card(canvas, "Refir", "Hnútar og bönd")).toHaveAccessibleName(/drög/)
        );
      });

      await step("who leads it", async () => {
        const leader = canvas.getByRole("textbox", { name: "Hver stýrir" });
        await userEvent.clear(leader);
        await userEvent.type(leader, "Dóra");
        await expect(leader).toHaveValue("Dóra");
      });

      await step("búnaður: add one with Enter, remove one with its ✕", async () => {
        await userEvent.type(canvas.getByRole("textbox", { name: "Búnaður" }), "Karabínur{Enter}");
        await expect(canvas.getByRole("button", { name: "Taka Karabínur af lista" })).toBeVisible();
        await userEvent.click(canvas.getByRole("button", { name: "Taka Reipi og bönd af lista" }));
        await expect(
          canvas.queryByRole("button", { name: "Taka Reipi og bönd af lista" })
        ).not.toBeInTheDocument();
      });

      await step("the changes are listed against the sveit's version", async () => {
        await expect(canvas.getByText("Breytt fyrir þennan flokk")).toBeVisible();
        await expect(canvas.getByText("(sveitin: 15 mín)")).toBeInTheDocument();
      });

      await step("Nota útgáfu sveitarinnar puts it all back", async () => {
        await userEvent.click(canvas.getByRole("button", { name: "Nota útgáfu sveitarinnar" }));
        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
        await expect(canvas.queryByText("Breytt fyrir þennan flokk")).not.toBeInTheDocument();
      });

      await step("swap for another block from the bank", async () => {
        await userEvent.selectOptions(
          canvas.getByRole("combobox", { name: "Skipta út fyrir aðra blokk" }),
          "st-tjald"
        );
        await waitFor(() =>
          expect(canvas.getByRole("heading", { name: /Tjaldreising/ })).toBeVisible()
        );
        await expect(card(canvas, "Refir", "Tjaldreising")).toBeInTheDocument();
        await expect(canvas.getByText("Önnur blokk")).toBeInTheDocument();
      });

      await step("Lokið closes it and gives focus back to the card", async () => {
        const [done] = canvas.getAllByRole("button", { name: "Lokið" });
        await userEvent.click(done);
        await waitFor(() =>
          expect(document.activeElement).toHaveAccessibleName(/^Refir kl\. .*Tjaldreising/)
        );
      });
    },
  } satisfies Story,
  /** Removing a card is the one step with an Afturkalla. Moving still works from the card. */
  removeAndMove: {
    name: "Remove, undo, move",
    args: { fixture: "uneven" },
    play: async ({ canvasElement, step }) => {
      const canvas = within(canvasElement);

      await step("remove: the card goes, Afturkalla brings it back", async () => {
        await userEvent.click(card(canvas, "Refir", "Hnútar og bönd"));
        await userEvent.click(canvas.getByRole("button", { name: "Fjarlægja úr flokknum" }));
        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín"));
        const undo = canvas.getByRole("button", { name: "Afturkalla" });
        await waitFor(() => expect(undo).toHaveFocus());
        await userEvent.click(undo);
        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
      });

      await step("→ on a card still sends it to the next flokkur", async () => {
        card(canvas, "Refir", "Hnútar og bönd").focus();
        await userEvent.keyboard("{ArrowRight}");
        await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín"));
        await expect(totalOf(canvasElement, "mock-ernir")).toBe("60 mín");
        await waitFor(() =>
          expect(document.activeElement).toHaveAccessibleName(/^Ernir kl\. .*Hnútar og bönd/)
        );
      });

      await step("and the editor's Færa til buttons send it anywhere in one tap", async () => {
        // Ernir now have two: their own and the one that just came over. Open the new one.
        const ernir = canvas.getAllByRole("button", {
          name: /^Ernir kl\. \d\d:\d\d: Hnútar og bönd/,
        });
        await userEvent.click(ernir[ernir.length - 1]);
        await userEvent.click(
          canvas.getByRole("button", { name: "Færa Hnútar og bönd í annan flokk: Birnir" })
        );
        await waitFor(() => expect(totalOf(canvasElement, "mock-ernir")).toBe("45 mín"));
        await expect(totalOf(canvasElement, "mock-birnir")).toBe("75 mín");
      });
    },
  } satisfies Story,
};

/* ── Dragging: helpers ── */

/** The liður names in one flokkur's column, top to bottom. */
function namesIn(root: HTMLElement, lane: number): string[] {
  return [...root.querySelectorAll(`[data-lane-col="${lane}"] button[data-lidur-id]`)].map(
    (el) =>
      (el.getAttribute("aria-label") ?? "")
        .replace(/^.*?(kl\. \d\d:\d\d|\d+\. liður): /, "")
        .split(",")[0]
  );
}

/** Everything the live regions say right now. */
function spoken(root: HTMLElement): string {
  const owner = root.ownerDocument;
  return [...owner.querySelectorAll("[aria-live]")].map((el) => el.textContent).join(" | ");
}

/** A timer, not requestAnimationFrame: a background test tab throttles animation frames. */
const frame = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Just inside the top of the n-th slot of a column: "in front of that card". */
function frontOf(root: HTMLElement, lane: number, n: number) {
  const column = root.querySelector(`[data-lane-col="${lane}"]`) as HTMLElement;
  const slots = column.querySelectorAll("[data-slot-id]");
  const box = column.getBoundingClientRect();
  const slot = slots[n]?.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: slot ? slot.top + 6 : box.bottom - 6 };
}

function mouse(type: string, target: EventTarget, at: { x: number; y: number }) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: at.x,
      clientY: at.y,
      button: 0,
      buttons: type === "mouseup" ? 0 : 1,
    })
  );
}

/** Press a card, move in steps, and either let go or (with `escape`) cancel before letting go. */
async function mouseDrag(card: HTMLElement, to: { x: number; y: number }, escape = false) {
  const from = centre(card);
  mouse("mousedown", card, from);
  for (let step = 1; step <= 10; step++) {
    await frame();
    mouse("mousemove", document, {
      x: from.x + ((to.x - from.x) * step) / 10,
      y: from.y + ((to.y - from.y) * step) / 10,
    });
  }
  await frame(80);
  if (escape) {
    // dnd-kit listens for Escape on the document while a drag is on.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
    );
    await frame();
  }
  mouse("mouseup", document, to);
  await frame(80);
}

function touch(type: string, target: Element, at: { x: number; y: number }) {
  const point = new Touch({ identifier: 7, target, clientX: at.x, clientY: at.y });
  const live = type === "touchend" ? [] : [point];
  target.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: live,
      targetTouches: live,
      changedTouches: [point],
    })
  );
}

/** A finger: hold still past the 200ms pick-up, then move and lift. */
async function touchDrag(card: HTMLElement, to: { x: number; y: number }) {
  const from = centre(card);
  touch("touchstart", card, from);
  await frame(300);
  for (let step = 1; step <= 10; step++) {
    touch("touchmove", card, {
      x: from.x + ((to.x - from.x) * step) / 10,
      y: from.y + ((to.y - from.y) * step) / 10,
    });
    await frame();
  }
  await frame(80);
  touch("touchend", card, to);
  await frame(80);
}

const REFIR = [
  "Hnútar og bönd",
  "Áttaviti og kort",
  "Skyndihjálp",
  "Eldfæri og prímus",
  "Kakó og spjall",
];

/**
 * Drag a card up and down its flokkur's timeline, or to a place in another flokkur. While it is
 * dragged the grid shows the result: the slot it would land in says when it would start, and
 * every time, total and "ræður lengd" is the one the drop gives. Letting go outside the
 * flokkar, or Escape, puts it back. A drop has Afturkalla.
 */
export const Drag: Story = {
  name: "Drag along the timeline",
  args: { fixture: "uneven" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);

    await step("up the timeline: Kakó og spjall from last to first in Refir", async () => {
      await expect(namesIn(canvasElement, 0)).toEqual(REFIR);
      await mouseDrag(card(canvas, "Refir", "Kakó og spjall"), frontOf(canvasElement, 0, 0));
      await waitFor(() =>
        expect(namesIn(canvasElement, 0)).toEqual(["Kakó og spjall", ...REFIR.slice(0, 4)])
      );
      await waitFor(() =>
        expect(spoken(canvasElement)).toContain("Liður færður í sæti 1 af 5: Kakó og spjall.")
      );
      // Its clock moved with it: it starts the band now.
      await expect(card(canvas, "Refir", "Kakó og spjall")).toHaveAccessibleName(
        /^Refir kl\. 19:40/
      );
    });

    await step("Afturkalla puts it back", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await waitFor(() => expect(namesIn(canvasElement, 0)).toEqual(REFIR));
    });

    await step("to a place in another flokkur: Hnútar og bönd second in Ernir", async () => {
      await mouseDrag(card(canvas, "Refir", "Hnútar og bönd"), frontOf(canvasElement, 1, 1));
      await waitFor(() =>
        expect(namesIn(canvasElement, 1)).toEqual([
          "Áttaviti og kort",
          "Hnútar og bönd",
          "Eldfæri og prímus",
          "Hnútar og bönd",
        ])
      );
      await expect(totalOf(canvasElement, "mock-refir")).toBe("55 mín");
      await expect(totalOf(canvasElement, "mock-ernir")).toBe("60 mín");
      await waitFor(() => expect(spoken(canvasElement)).toContain("Sæti 2 af 4."));
    });

    await step("Escape mid-drag cancels: nothing moves", async () => {
      const before = namesIn(canvasElement, 0);
      await mouseDrag(card(canvas, "Refir", "Skyndihjálp"), frontOf(canvasElement, 2, 0), true);
      await expect(namesIn(canvasElement, 0)).toEqual(before);
      await waitFor(() =>
        expect(spoken(canvasElement)).toContain("Hætt við. Skyndihjálp er á sínum stað.")
      );
    });

    await step("letting go outside the flokkar puts it back", async () => {
      const before = namesIn(canvasElement, 0);
      const outside = canvasElement.querySelector("[data-split-band] h3") as HTMLElement;
      await mouseDrag(card(canvas, "Refir", "Skyndihjálp"), centre(outside));
      await expect(namesIn(canvasElement, 0)).toEqual(before);
      await waitFor(() => expect(spoken(canvasElement)).toContain("Sleppt utan flokkanna."));
    });

    await step("the keyboard does the same: ↑ moves a card up its timeline", async () => {
      card(canvas, "Refir", "Skyndihjálp").focus();
      await userEvent.keyboard("{ArrowUp}");
      await waitFor(() =>
        expect(namesIn(canvasElement, 0).slice(0, 2)).toEqual(["Skyndihjálp", "Áttaviti og kort"])
      );
      await waitFor(() =>
        expect(document.activeElement).toHaveAccessibleName(/^Refir kl\. 19:40: Skyndihjálp/)
      );
    });
  },
};

/** On a phone: a swipe scrolls, a finger held still on a card picks it up. */
export const DragTouch: Story = {
  name: "Drag by touch (phone)",
  args: { fixture: "uneven" },
  globals: phone,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);

    await step("hold, then drag Kakó og spjall up to second in Refir", async () => {
      await touchDrag(card(canvas, "Refir", "Kakó og spjall"), frontOf(canvasElement, 0, 1));
      await waitFor(() =>
        expect(namesIn(canvasElement, 0)).toEqual([
          "Hnútar og bönd",
          "Kakó og spjall",
          ...REFIR.slice(1, 4),
        ])
      );
    });

    await step("a quick swipe is not a drag", async () => {
      const before = namesIn(canvasElement, 0);
      const target = card(canvas, "Refir", "Skyndihjálp");
      const from = centre(target);
      touch("touchstart", target, from);
      for (let i = 1; i <= 5; i++) {
        touch("touchmove", target, { x: from.x, y: from.y - i * 20 });
        await frame(10);
      }
      touch("touchend", target, { x: from.x, y: from.y - 100 });
      await frame(300);
      await expect(namesIn(canvasElement, 0)).toEqual(before);
    });
  },
};

export const Uneven: Story = k2.uneven;
export const Open: Story = k2.open;
export const Six: Story = k2.six;
export const Edge: Story = k2.edge;
export const Phone: Story = k2.phone;
export const Dark: Story = k2.dark;
export const Edit: Story = k2.edit;
export const RemoveAndMove: Story = k2.removeAndMove;

/* ── Column heads ── */

/** Every head look on the same band, the current pill first. */
function HeaderSheet({ fixture }: { fixture: FixtureName }) {
  return (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      {HEADER_LOOKS.map(({ look, name, idea: text }) => (
        <section key={look}>
          <h2 style={heading}>{name}</h2>
          <p style={idea}>{text}</p>
          <SplitGridLab data={FIXTURES[fixture]()} header={look} />
        </section>
      ))}
    </div>
  );
}

/**
 * The flokkur's name at the top of its column, with more character than a pill: a pennant, a
 * crest, a stamp or a band of its colour. Every look keeps the heading, the total and "ræður
 * lengd" / "N mín bið".
 */
export const Headers: Story = {
  name: "Headers",
  render: () => <HeaderSheet fixture="uneven" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Each look's four columns are headings named by the flokkur, with their totals.
    await expect(canvas.getAllByRole("heading", { level: 4, name: "Refir" })).toHaveLength(
      HEADER_LOOKS.length
    );
    await expect(canvasElement.querySelectorAll('[data-lane-total="mock-refir"]')).toHaveLength(
      HEADER_LOOKS.length
    );
  },
};

export const HeadersDark: Story = {
  name: "Headers · dark",
  render: () => <HeaderSheet fixture="uneven" />,
  globals: dark,
};

/** Long, funny names next to short ones, in four and six columns. */
function LongNameSheet() {
  return (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      {HEADER_LOOKS.map(({ look, name }) => (
        <section key={look} style={{ display: "grid", gap: "var(--sl-spacing-md)" }}>
          <h2 style={heading}>{name}</h2>
          <SplitGridLab data={FIXTURES.longNames()} header={look} />
          <SplitGridLab data={FIXTURES.longNamesSix()} header={look} />
        </section>
      ))}
    </div>
  );
}

const SVIN = "Fjólublá fljúgandi avókadó svínin";

/**
 * "Fjólublá fljúgandi avókadó svínin", "Hraðbrautarbrúarsmiðirnir" and "Litlu grænu geimverurnar
 * frá Mars" beside "Refir". Two lines at most, hyphenated or broken anywhere, then "…"; the full
 * name is the heading's text and its tooltip.
 */
export const HeadersLongNames: Story = {
  name: "Headers · long names",
  render: () => <LongNameSheet />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the heading is the whole name, whatever the clamp shows", async () => {
      const heads = canvas.getAllByRole("heading", { level: 4, name: SVIN });
      await expect(heads).toHaveLength(HEADER_LOOKS.length * 2);
      for (const head of heads) await expect(head).toHaveAttribute("title", SVIN);
    });

    await step("no head is more than two lines of its name, and none spills out", async () => {
      for (const text of canvasElement.querySelectorAll<HTMLElement>("h4 > span")) {
        const lines =
          text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight);
        await expect(lines).toBeLessThan(2.6);
        await expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth + 1);
        const head = text.closest("[data-look]") as HTMLElement;
        await expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(
          head.getBoundingClientRect().right + 1
        );
      }
    });

    await step("the flip side's Færa til buttons carry long names too", async () => {
      const [first] = canvas.getAllByRole("button", { name: /^Refir kl\. \d\d:\d\d: / });
      await userEvent.click(first);
      const move = await canvas.findByRole("button", {
        name: `Færa ${first.getAttribute("aria-label")?.split(": ")[1].split(",")[0]} í annan flokk: ${SVIN}`,
      });
      await expect(move).toHaveAttribute("title", SVIN);
      await expect(move.scrollWidth).toBeLessThanOrEqual(move.clientWidth + 1);
    });
  },
};

export const HeadersLongNamesPhone: Story = {
  name: "Headers · long names, phone",
  render: () => <LongNameSheet />,
  globals: phone,
};

/* ── Merge ── */

/**
 * The merge proposal, unchanged from the earlier lab. Lanes that differ get a confirmation that
 * lists the result: keep everything in sequence (the default), or keep one flokkur's plan and
 * see what is dropped. Either way "Afturkalla" follows.
 */
export const Merge: Story = {
  name: "Merge",
  args: { fixture: "uneven", defaultMergeOpen: true },
};

/** The whole path: confirm, choose, merge, hear it, undo it. */
export const MergeFlow: Story = {
  name: "Merge: confirm and undo",
  args: { fixture: "uneven" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the default keeps everything, and says what it does to the clock", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt…" }));
      const title = await canvas.findByRole("heading", { name: "Sameina í eina röð?" });
      await waitFor(() => expect(title).toHaveFocus());
      await expect(canvas.getByRole("radio", { name: /Halda öllu/ })).toBeChecked();
    });

    await step("keeping one flokkur lists what is dropped and the button says so", async () => {
      await userEvent.click(canvas.getByRole("radio", { name: /Halda einni dagskrá/ }));
      await userEvent.selectOptions(
        canvas.getByRole("combobox", { name: "Flokkur" }),
        "mock-ernir"
      );
      await expect(canvas.getByText(/^Fellur út: \d liðir/)).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: /^Sameina og sleppa/ }));
    });

    await step("merged, announced, and undoable", async () => {
      await expect(await canvas.findByText(/^Sameinað\. \d liðir féllu út\.$/)).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("70 mín"));
    });
  },
};

/** Lanes that are still identical lose nothing, so there is no question: merge, then Afturkalla. */
export const MergeIdentical: Story = {
  name: "Merge: identical lanes",
  args: { fixture: "copied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sameina í eitt" }));
    await expect(await canvas.findByText("Sameinað í eina röð. Ekkert féll út.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
    await waitFor(() => expect(totalOf(canvasElement, "mock-refir")).toBe("80 mín"));
  },
};

/** Any fixture. Changing a control remounts it with fresh data. */
export const Playground: Story = {
  name: "Playground",
  render: ({ fixture, ...args }) => (
    <div style={wide}>
      <SplitGridLab
        key={JSON.stringify({ fixture, ...args })}
        {...args}
        data={FIXTURES[fixture]()}
      />
    </div>
  ),
};
