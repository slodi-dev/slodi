import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Bench,
  benchData,
  longTextBenchData,
  mockModeIs,
  splitBenchData,
  undatedBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import type { PlanBenchData } from "@/services/plan.service";
import { BenchProvider } from "./BenchProvider";
import BlockPalette from "./BlockPalette";
import PlanBench from "./PlanBench";

/** A day in the fixture's current week; the fixture is anchored to today. */
function thisWeek(weekday: number): Date {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7)
  );
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday);
}

/** What the bench last said to a screen reader. */
function announced(canvasElement: HTMLElement): string {
  return Array.from(canvasElement.querySelectorAll("[data-bench-announcer]"))
    .map((node) => node.textContent ?? "")
    .join("");
}

function row(canvasElement: HTMLElement, name: string): HTMLElement {
  const node = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-lidur-row]")).find(
    (candidate) => candidate.textContent?.includes(name)
  );
  if (!node) throw new Error(`No row for ${name}`);
  return node;
}

/** The names in one sheet's rows, in screen order. */
function rowNames(sheet: HTMLElement): string[] {
  return Array.from(sheet.querySelectorAll<HTMLElement>("[data-lidur-row]")).map(
    (node) => node.querySelector("[class*='rowTitle']")?.textContent ?? ""
  );
}

const meta: Meta<typeof PlanBench> = {
  title: "Components/Vinnubekkur/PlanBench",
  component: PlanBench,
  // The bank in WithBank reads fixtures only when mock mode is not "off".
  beforeEach: () => mockModeIs("auto"),
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Bekkurinn: every fundur of the season as a sheet, in date order, with one fold " +
          "marker where the past ends. Covers BenchProvider (the reducer and the dnd-kit " +
          "context) as well. Spec: `docs/design/vinnubekkurinn/SPEC.md` on " +
          "`origin/release/vinnubekkur-v1`.",
      },
    },
  },
  render: (args) => (
    <Bench data={benchData()}>
      <PlanBench {...args} />
    </Bench>
  ),
};

export default meta;
type Story = StoryObj<typeof PlanBench>;

/** Opens on today: the fixture's current week. */
export const Default: Story = {};

/** Today has no fundur, so the marker reads "Héðan í frá" above the next one. */
export const PastAndAhead: Story = {
  args: { today: thisWeek(3) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Héðan í frá")).toBeInTheDocument();
    // Everything above the marker is past and drawn as such.
    const past = canvasElement.querySelectorAll('section[data-past="true"]');
    await expect(past.length).toBe(3);
  },
};

/** A fundur today: the marker reads "Í dag". */
export const Today: Story = {
  args: { today: thisWeek(2) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Í dag")).toBeInTheDocument();
  },
};

/** Nothing ahead: no marker, every sheet past. */
export const AllPast: Story = {
  args: { today: new Date(2099, 0, 1) },
};

export const Empty: Story = {
  render: () => (
    // BenchProvider is covered through PlanBench (every story here mounts it).
    <BenchProvider data={{ ...benchData(), fundir: [] }}>
      <PlanBench />
    </BenchProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Engir fundir á þessu starfsári/)).toBeVisible();
  },
};

/** The scratchpad: no dates, so every sheet reads "Ódagsett" and none is past. */
export const Undated: Story = {
  render: () => (
    <Bench data={undatedBenchData()}>
      <PlanBench />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Ódagsett").length).toBe(6);
    await expect(canvas.queryByText("Héðan í frá")).toBeNull();
  },
};

export const LongIcelandicText: Story = {
  render: () => (
    <Bench data={longTextBenchData()}>
      <PlanBench />
    </Bench>
  ),
};

/** This week's kjarni dealt out to the four flokkar. */
export const SplitSection: Story = {
  render: () => (
    <Bench data={splitBenchData()}>
      <PlanBench />
    </Bench>
  ),
};

export const EditorOpen: Story = {
  render: () => (
    <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-2-1" }]}>
      <PlanBench />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Heiti")).toHaveValue(
      "Áttavitinn: undirstöður"
    );
  },
};

function WithBankLayout({ data }: { data: PlanBenchData }) {
  return (
    <Bench data={data}>
      <div style={{ display: "grid", gap: "var(--sl-spacing-gap-lg)" }}>
        <BlockPalette />
        <PlanBench />
      </div>
    </Bench>
  );
}

/**
 * The bank and the bench under one provider, as PlanShell mounts them.
 *
 * "Bæta við" adds to the *active* fundur. Until a sheet has been focused that
 * is the first fundur in the data — here the oldest, already past and
 * scrolled away above the marker — not the one the bench opened on.
 */
export const WithBank: Story = {
  render: () => <WithBankLayout data={benchData()} />,
};

/** "Bæta við" adds a liður to the fundur being worked on and announces it. */
export const AddFromBank: Story = {
  render: () => <WithBankLayout data={benchData()} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const block = (name: string) =>
      within(canvas.getByText(name, { selector: "[class*='itemT']" }).closest("li") as HTMLElement);

    await step("adds to the active sheet and says so", async () => {
      await userEvent.click(
        block("Ratleikur um hverfið").getByRole("button", { name: "Bæta við" })
      );
      await waitFor(() =>
        expect(announced(canvasElement)).toBe("Lið bætt við: Ratleikur um hverfið.")
      );
      const active = canvasElement.querySelector<HTMLElement>('section[data-active="true"]');
      await expect(active).not.toBeNull();
      await expect(rowNames(active as HTMLElement)).toContain("Ratleikur um hverfið");
    });

    await step("follows the sheet the leader last worked in", async () => {
      // Clicking a row in another sheet makes that sheet the active one.
      await userEvent.click(canvas.getByRole("button", { name: /^Leikur að eigin vali/ }));
      await userEvent.click(block("Stórfiskaleikur").getByRole("button", { name: "Bæta við" }));
      const uglur = canvas.getByRole("region", { name: /^Flokksfundur Ugla/ });
      await waitFor(() => expect(rowNames(uglur)).toContain("Stórfiskaleikur"));
      await expect(announced(canvasElement)).toBe("Lið bætt við: Stórfiskaleikur.");
    });
  },
};

/** ▲/▼ reorder inside a band, and the move is announced. */
export const ReorderWithButtons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = canvas.getByRole("region", { name: /^Flokksfundur Arna/ });
    await expect(rowNames(sheet).slice(1, 4)).toEqual([
      "Áttavitinn: undirstöður",
      "Kortalestur í hverfinu",
      "Stórfiskaleikur",
    ]);
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Færa Áttavitinn: undirstöður niður" })
    );
    await expect(rowNames(sheet).slice(1, 3)).toEqual([
      "Kortalestur í hverfinu",
      "Áttavitinn: undirstöður",
    ]);
    await expect(announced(canvasElement)).toBe(
      "Liður færður í sæti 2 af 3: Áttavitinn: undirstöður."
    );
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Færa Áttavitinn: undirstöður upp" })
    );
    await expect(rowNames(sheet)[1]).toBe("Áttavitinn: undirstöður");
    // The first row of a band cannot move up: a move never leaves its band.
    await expect(
      within(sheet).getByRole("button", { name: "Færa Áttavitinn: undirstöður upp" })
    ).toBeDisabled();
  },
};

/** Keyboard drag: Space grabs, ↓ moves, Space drops; focus follows the block. */
export const KeyboardDrag: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = canvas.getByRole("region", { name: /^Flokksfundur Arna/ });
    const grabbed = row(sheet, "Áttavitinn: undirstöður");
    grabbed.focus();

    await userEvent.keyboard(" ");
    await waitFor(() => expect(announced(canvasElement)).toMatch(/^Liður gripinn: Áttavitinn/));
    await expect(grabbed).toHaveAttribute("data-grabbed", "true");

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(announced(canvasElement)).toBe("Liður færður í sæti 2 af 3: Áttavitinn: undirstöður.")
    );
    await expect(rowNames(sheet)[2]).toBe("Áttavitinn: undirstöður");
    await expect(document.activeElement).toBe(row(sheet, "Áttavitinn: undirstöður"));

    await userEvent.keyboard(" ");
    await waitFor(() => expect(announced(canvasElement)).toBe("Sleppt."));
    await expect(row(sheet, "Áttavitinn: undirstöður")).toHaveAttribute("data-grabbed", "false");
  },
};

/** The editor opens from ✎ and closes with Escape, handing focus back to the row. */
export const EditorOpensAndClosesWithEscape: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Breyta Áttavitinn: undirstöður" }));
    const name = await canvas.findByLabelText("Heiti");
    await expect(name).toHaveValue("Áttavitinn: undirstöður");

    await userEvent.click(name);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByLabelText("Heiti")).toBeNull());
    await expect(document.activeElement).toBe(row(canvasElement, "Áttavitinn: undirstöður"));
  },
};

/**
 * Mouse drag on the grip (dnd-kit's PointerSensor). Pointer events are sent
 * by hand, so the pointer has to stay inside the viewport: outside it dnd-kit
 * auto-scrolls and the drop lands somewhere else. The topmost sheet keeps it
 * there at both widths.
 */
export const MouseDrag: Story = {
  // No visual baseline: the visual runner holds animation frames until a story
  // has finished, and dnd-kit measures and moves the drag in animation frames.
  // The button and keyboard paths to a reorder have baselines.
  tags: ["skip-visual"],
  args: { today: new Date(2099, 0, 1) },
  render: (args) => (
    <Bench data={benchData()}>
      <PlanBench {...args} />
    </Bench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = canvas.getByRole("region", { name: /^Flokksfundur Refa/ });
    window.scrollTo(0, 0);
    const from = row(sheet, "Hnútar: pelastikk og réttur");
    const to = row(sheet, "Kötturinn og músin");
    const grip = from.querySelector<HTMLElement>("[class*='grip']") as HTMLElement;
    const start = grip.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const y = start.top + start.height / 2;
    const target = to.getBoundingClientRect().bottom - 6;
    const fire = (type: string, node: EventTarget, clientY: number) =>
      node.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY,
          pointerId: 1,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          isPrimary: true,
          pointerType: "mouse",
        })
      );
    // A timer, not requestAnimationFrame: a background test tab throttles
    // animation frames, and the visual runner holds them until the end.
    const frame = () => new Promise((resolve) => setTimeout(resolve, 20));

    fire("pointerdown", grip, y);
    for (let step = 1; step <= 8; step++) {
      await frame();
      fire("pointermove", document, y + ((target - y) * step) / 8);
    }
    await frame();
    fire("pointerup", document, target);

    await waitFor(() =>
      expect(announced(canvasElement)).toBe(
        "Liður færður í sæti 2 af 3: Hnútar: pelastikk og réttur."
      )
    );
    await expect(rowNames(sheet).slice(1, 3)).toEqual([
      "Kötturinn og músin",
      "Hnútar: pelastikk og réttur",
    ]);
  },
};
