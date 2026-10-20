import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bench, LiveSplit } from "@/stories/vinnubekkur/benchHarness";
import { CREST_SHEET } from "./crestMarks";
import { HEADER_LOOKS } from "./headerLooks";
import { PHONE_LOOKS, type PhoneLook } from "./phoneLooks";
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

/** Both head looks on the same band, the old pill first. */
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
 * The flokkur at the top of its column: the old pill for reference, then H6, the flokkur's ringed
 * crest on a lanyard down a tinted lane (the K2 default). Both keep the heading, the total and
 * "ræður lengd" / "N mín bið".
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
    // H6: every column carries the cord down its edge and the wash behind it.
    const band = canvasElement.querySelector<HTMLElement>('[data-header="h6"]');
    await expect(band).not.toBeNull();
    for (const column of band!.querySelectorAll<HTMLElement>("[data-lane-col]")) {
      await expect(getComputedStyle(column, "::before").width).toBe("2px");
      // The wash resolves where the column's colour is set (an empty value paints nothing).
      await expect(getComputedStyle(column).getPropertyValue("--lane-wash").trim()).not.toBe("");
    }
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

/** The animal marks drawn for the crests, at the sizes they are used (28, 36 and 44px). */
function CrestMarkSheet() {
  return (
    <div style={{ display: "grid", gap: "var(--sl-spacing-md)" }}>
      {[28, 36, 44].map((size) => (
        <div key={size} style={{ display: "flex", flexWrap: "wrap", gap: "var(--sl-spacing-lg)" }}>
          {CREST_SHEET.map(({ name, icon: Icon }) => (
            <figure
              key={name}
              style={{ margin: 0, display: "grid", justifyItems: "center", gap: 4 }}
            >
              <Icon width={size} height={size} />
              <figcaption style={{ fontSize: "var(--sl-text-caption)" }}>{name}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}

export const CrestMarks: Story = {
  name: "Headers · crest marks",
  render: () => <CrestMarkSheet />,
};

/* ── Phone ── */

/** A phone-wide box: the band measures its own width, so this is a phone on any screen. */
function PhoneFrame({
  width,
  label,
  fixture,
  look,
}: {
  width: 390 | 360;
  label: string;
  fixture: FixtureName;
  look?: PhoneLook;
}) {
  return (
    <figure style={{ margin: 0, width, maxWidth: "100%", flex: "none" }}>
      <figcaption style={{ ...idea, margin: "0 0 var(--sl-spacing-xs)" }}>{label}</figcaption>
      <SplitGridLab data={FIXTURES[fixture]()} phone={look} />
    </figure>
  );
}

const row = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: "var(--sl-spacing-lg)",
} as const;

/**
 * Today's phone (the desktop grid scrolled sideways) first, then the first M3 and its styles
 * M3a–d, each at 390px with the four flokkar of the uneven stöðvaleikur. The diagnosis is in
 * the MDX, section 9.
 */
export const PhoneComparison: Story = {
  name: "Phone · Comparison",
  render: () => (
    <div style={row}>
      <section>
        <h2 style={heading}>Current phone</h2>
        <PhoneFrame width={390} label="390 · 4 flokkar" fixture="uneven" />
      </section>
      {PHONE_LOOKS.map(({ look, name }) => (
        <section key={look}>
          <h2 style={heading}>{name}</h2>
          <PhoneFrame width={390} label="390 · 4 flokkar" fixture="uneven" look={look} />
        </section>
      ))}
    </div>
  ),
};

/** One look at 390 and 360, with four and six flokkar and with long names. */
function PhoneSheetOf({ look }: { look: PhoneLook }) {
  const { name, idea: text } = PHONE_LOOKS.find((entry) => entry.look === look)!;
  return (
    <div style={{ display: "grid", gap: "var(--sl-spacing-md)" }}>
      <div>
        <h2 style={heading}>{name}</h2>
        <p style={{ ...idea, maxWidth: "48rem" }}>{text}</p>
      </div>
      <div style={row}>
        <PhoneFrame width={390} label="390 · 4 flokkar" fixture="uneven" look={look} />
        <PhoneFrame width={360} label="360 · 6 flokkar" fixture="six" look={look} />
        <PhoneFrame width={390} label="390 · long names, 4" fixture="longNames" look={look} />
        <PhoneFrame width={360} label="360 · long names, 6" fixture="longNamesSix" look={look} />
      </div>
    </div>
  );
}

const nameOf = (look: PhoneLook) => PHONE_LOOKS.find((entry) => entry.look === look)!.name;

/** The look untouched, in four frames. No play test, so it shows the layout as it opens. */
const phoneStory = (look: PhoneLook, extra: Partial<Story> = {}): Story => ({
  name: `Phone · ${nameOf(look)}`,
  render: () => <PhoneSheetOf look={look} />,
  ...extra,
});

/** The first band on the page. */
function firstBand(canvasElement: HTMLElement): HTMLElement {
  return canvasElement.querySelector("[data-split-band]") as HTMLElement;
}

/** Open a card, check the sheet, close it with Lokið and land back on the card. */
async function sheetRoundTrip(band: HTMLElement, cardName: RegExp) {
  const canvas = within(band);
  const [target] = canvas.getAllByRole("button", { name: cardName });
  await userEvent.click(target);
  const sheet = await canvas.findByRole("dialog");
  await waitFor(() => expect(sheet).toHaveAttribute("open"));
  await expect(within(sheet).getByRole("button", { name: "Lengra um 5 mín" })).toBeVisible();
  await userEvent.click(within(sheet).getByRole("button", { name: "Lokið" }));
  await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(document.activeElement).toHaveAccessibleName(cardName));
}

/** Closes the card's sheet with Lokið, if it is open. */
async function closeSheet(canvas: ReturnType<typeof within>) {
  const sheet = canvas.queryByRole("dialog");
  if (!sheet) return;
  await userEvent.click(within(sheet).getByRole("button", { name: "Lokið" }));
  await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
}

/**
 * The look's interactions in one 390px frame, on the uneven stöðvaleikur: the timeline is in
 * time order; a tap opens the card's sheet; Fyrr and Síðar move it in time; Færa til moves it
 * to another flokkur and back; a removed liður comes back with Afturkalla; "+ Bæta við" fills
 * a wait.
 */
const phoneInteractions = (look: PhoneLook): Story => ({
  name: `Phone · ${nameOf(look).split(" · ")[0]} · interactions`,
  globals: phone,
  render: () => <SplitGridLab data={FIXTURES.uneven()} phone={look} />,
  play: async ({ canvasElement, step }) => {
    const band = firstBand(canvasElement);
    const canvas = within(band);
    window.scrollTo(0, 0);

    await step("one timeline, in time order, from 19:40 to Lok", async () => {
      const timeline = canvas.getByRole("list", { name: "Tímalína" });
      const text = timeline.textContent ?? "";
      const times = ["19:40", "19:55", "20:10", "20:25", "20:40", "20:50", "20:55"];
      const places = times.map((time) => text.indexOf(time));
      await expect(places.every((place) => place >= 0)).toBe(true);
      await expect(places).toEqual([...places].sort((a, b) => a - b));
      await expect(timeline).toHaveTextContent(/20:55.*Lok/);
      if (look === "m3a") {
        // The rail folds every stop but the first: open them all.
        await userEvent.click(canvas.getByRole("button", { name: "Opna allt" }));
      }
      await expect(card(canvas, "Refir", "Áttaviti og kort")).toHaveAccessibleName(/kl\. 19:55/);
    });

    await step("a tap opens the card as a sheet; Lokið goes back to the card", async () => {
      await sheetRoundTrip(band, /^Refir kl\. 19:55: Áttaviti og kort/);
    });

    await step("Fyrr moves it to 19:40, Síðar back to 19:55", async () => {
      await userEvent.click(card(canvas, "Refir", "Áttaviti og kort"));
      const sheet = await canvas.findByRole("dialog");
      await userEvent.click(
        within(sheet).getByRole("button", { name: "Færa Áttaviti og kort framar" })
      );
      await waitFor(() =>
        expect(card(canvas, "Refir", "Áttaviti og kort")).toHaveAccessibleName(/kl\. 19:40/)
      );
      await userEvent.click(
        within(canvas.getByRole("dialog")).getByRole("button", {
          name: "Færa Áttaviti og kort aftar",
        })
      );
      await waitFor(() =>
        expect(card(canvas, "Refir", "Áttaviti og kort")).toHaveAccessibleName(/kl\. 19:55/)
      );
    });

    await step("Færa til moves it to Ernir, and back to Refir from Ernir's card", async () => {
      await userEvent.click(
        within(canvas.getByRole("dialog")).getByRole("button", {
          name: "Færa Áttaviti og kort í annan flokk: Ernir",
        })
      );
      await waitFor(() => expect(totalOf(band, "mock-refir")).toBe("55 mín"));
      await expect(totalOf(band, "mock-ernir")).toBe("60 mín");
      await userEvent.click(
        within(canvas.getByRole("dialog")).getByRole("button", {
          name: "Færa Áttaviti og kort í annan flokk: Refir",
        })
      );
      await waitFor(() => expect(totalOf(band, "mock-refir")).toBe("70 mín"));
      await expect(totalOf(band, "mock-ernir")).toBe("45 mín");
      await closeSheet(canvas);
    });

    await step("remove from the sheet, then Afturkalla", async () => {
      await userEvent.click(card(canvas, "Refir", "Skyndihjálp"));
      await userEvent.click(
        within(await canvas.findByRole("dialog")).getByRole("button", {
          name: "Fjarlægja úr flokknum",
        })
      );
      await waitFor(() => expect(totalOf(band, "mock-refir")).toBe("55 mín"));
      await closeSheet(canvas);
      await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
      await waitFor(() => expect(totalOf(band, "mock-refir")).toBe("70 mín"));
      await expect(card(canvas, "Refir", "Skyndihjálp")).toBeInTheDocument();
    });

    await step("+ Bæta við fills Ernir's wait", async () => {
      await userEvent.click(
        canvas.getByRole("button", { name: "30 mín bið. Bæta verkefni við (Ernir)" })
      );
      await waitFor(() => expect(totalOf(band, "mock-ernir")).toBe("60 mín"));
      await closeSheet(canvas);
      await expect(card(canvas, "Ernir", "Nýtt verkefni")).toBeInTheDocument();
    });
  },
});

export const PhoneM3: Story = phoneStory("m3");
export const PhoneM3Dark: Story = phoneStory("m3", { name: "Phone · M3 · dark", globals: dark });
export const PhoneM3Interactions: Story = phoneInteractions("m3");

export const PhoneM3a: Story = phoneStory("m3a");
export const PhoneM3aDark: Story = phoneStory("m3a", { name: "Phone · M3a · dark", globals: dark });
export const PhoneM3aInteractions: Story = {
  ...phoneInteractions("m3a"),
  play: async (context) => {
    const canvas = within(firstBand(context.canvasElement));
    await context.step("the rail starts with every stop folded but the first", async () => {
      const heads = canvas.getAllByRole("button", { expanded: false });
      await expect(heads.length).toBeGreaterThan(0);
      await expect(canvas.getAllByRole("button", { expanded: true })).toHaveLength(1);
    });
    await phoneInteractions("m3a").play!(context);
  },
};

export const PhoneM3b: Story = phoneStory("m3b");
export const PhoneM3bDark: Story = phoneStory("m3b", { name: "Phone · M3b · dark", globals: dark });
export const PhoneM3bInteractions: Story = {
  ...phoneInteractions("m3b"),
  play: async (context) => {
    const canvas = within(firstBand(context.canvasElement));
    await context.step(
      "Ernir and Uglur both start Eldfæri og prímus at 19:55: one line, two crests",
      async () => {
        const ernir = card(canvas, "Ernir", "Eldfæri og prímus");
        const uglur = card(canvas, "Uglur", "Eldfæri og prímus");
        await expect(ernir.parentElement).toBe(uglur.parentElement);
      }
    );
    await phoneInteractions("m3b").play!(context);
  },
};

export const PhoneM3c: Story = phoneStory("m3c");
export const PhoneM3cDark: Story = phoneStory("m3c", { name: "Phone · M3c · dark", globals: dark });
export const PhoneM3cInteractions: Story = phoneInteractions("m3c");

export const PhoneM3d: Story = phoneStory("m3d");
export const PhoneM3dDark: Story = phoneStory("m3d", { name: "Phone · M3d · dark", globals: dark });
export const PhoneM3dInteractions: Story = phoneInteractions("m3d");

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
