import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LiveSheet, longTextBenchData } from "@/stories/vinnubekkur/benchHarness";
import { Bench, FUNDUR, LiveRowLab, REORDER, SheetLabDemo, benchData } from "./labHarness";
import { LOOKS, type FundurSheetLook } from "./sheetModel";

/**
 * FundurSheet + LidurRow style variations. The form is the current sheet's: the header, the
 * three beinagrind bands with "Skipta á flokka", the rows with their handle, clock, duration
 * and ↑ ↓ ✎ ✕, the editor under its row, the footer. Every button, key and drag goes through
 * the real bench reducer. F0 is the current sheet with its problems fixed; F1–F4 are styles
 * on top of F0. What was wrong and why each style: Lab → FundurSheet → About.
 */

const meta = {
  title: "Lab/FundurSheet/Styles",
  component: SheetLabDemo,
  tags: ["skip-visual"],
  args: { look: "lagad", fixture: "normal" },
  argTypes: {
    look: { control: "inline-radio", options: LOOKS.map((l) => l.look) },
    fixture: {
      control: "inline-radio",
      options: ["normal", "overTime", "undecided", "split", "undated", "past"],
    },
  },
} satisfies Meta<typeof SheetLabDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
  maxWidth: "46rem",
} as const;
const stack = { display: "grid", gap: "var(--sl-spacing-xl)" } as const;

/** The current sheet first, then each style, all on this week's 100 / 90 mín fundur. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={stack}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>What the bench uses today.</p>
        <Bench data={benchData()}>
          <LiveSheet fundurId={FUNDUR.overTime} />
        </Bench>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.story}</p>
          <SheetLabDemo look={l.look} fixture="overTime" labelSuffix={` (${l.name})`} />
        </section>
      ))}
    </div>
  ),
};

/* ── One set of stories per style ── */

const phone = { viewport: { value: "phone", isRotated: false } };

/** Clock text of one row. */
function clockOf(root: HTMLElement, lidurId: string): string {
  const row = root.querySelector<HTMLElement>(`[data-lidur-row="${lidurId}"]`);
  return row?.querySelector("[data-clock]")?.textContent ?? "";
}

function storiesFor(look: FundurSheetLook, name: string) {
  return {
    normal: { name, args: { look, fixture: "normal" } } satisfies Story,
    overTime: {
      name: `${name}: over time`,
      args: { look, fixture: "overTime" },
      play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        // Said twice now: in the header and in the footer.
        await expect(canvas.getByText("10 mín yfir")).toBeInTheDocument();
        await expect(canvas.getByText("100 / 90 mín · 10 yfir")).toBeInTheDocument();
      },
    } satisfies Story,
    undecided: {
      name: `${name}: undecided`,
      args: { look, fixture: "undecided" },
      play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText("2 liðir enn óákveðnir")).toBeInTheDocument();
      },
    } satisfies Story,
    split: {
      name: `${name}: split and merge`,
      args: { look, fixture: "normal" },
      play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);
        const kjarni = () =>
          canvas.getAllByRole("button", { name: /Skipta á flokka|Sameina í eitt/ })[1];
        await step("split", async () => {
          await userEvent.click(kjarni());
          await expect(kjarni()).toHaveAttribute("aria-pressed", "true");
          await expect(canvas.getByText(/Lengsti flokkur ræður/)).toBeInTheDocument();
        });
        await step("merge", async () => {
          await userEvent.click(kjarni());
          await expect(kjarni()).toHaveTextContent("Skipta á flokka");
          await expect(canvas.getByText("Áttavitinn: undirstöður")).toBeInTheDocument();
        });
      },
    } satisfies Story,
    undated: {
      name: `${name}: undated`,
      args: { look, fixture: "undated" },
      play: async ({ canvasElement }) => {
        await expect(within(canvasElement).getByText("Ódagsett")).toBeInTheDocument();
        // No clock, so the rows count from the start instead of all saying "—".
        await expect(clockOf(canvasElement, REORDER.overtaken)).toBe("+0:10");
      },
    } satisfies Story,
    past: { name: `${name}: past`, args: { look, fixture: "past" } } satisfies Story,
    phone: {
      name: `${name}: phone`,
      args: { look, fixture: "normal" },
      globals: phone,
    } satisfies Story,
    dark: {
      name: `${name}: dark`,
      args: { look, fixture: "overTime" },
      globals: { theme: "dark" },
    } satisfies Story,
    /** ✎ opens the real LidurEditor under its row, and closes it again. */
    editor: {
      name: `${name}: editor`,
      args: { look, fixture: "normal" },
      play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const edit = canvas.getByRole("button", { name: "Breyta Kortalestur í hverfinu" });
        await userEvent.click(edit);
        const close = await canvas.findByRole("button", {
          name: "Loka ritli fyrir Kortalestur í hverfinu",
        });
        await expect(close).toHaveAttribute("aria-expanded", "true");
        await userEvent.click(close);
        await expect(
          canvas.getByRole("button", { name: "Breyta Kortalestur í hverfinu" })
        ).toHaveAttribute("aria-expanded", "false");
      },
    } satisfies Story,
    /**
     * ↑ moves Kortalestur above Áttavitinn and both start times follow; then the keyboard path
     * (Space, ↓, Space) puts it back, announced at each step.
     */
    reorder: {
      name: `${name}: reorder`,
      args: { look, fixture: "normal" },
      play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);
        await expect(clockOf(canvasElement, REORDER.overtaken)).toBe("19:40");
        await expect(clockOf(canvasElement, REORDER.moved)).toBe("20:10");

        await step("↑ moves it up and the times follow", async () => {
          await userEvent.click(
            canvas.getByRole("button", { name: "Færa Kortalestur í hverfinu upp" })
          );
          await waitFor(() => expect(clockOf(canvasElement, REORDER.moved)).toBe("19:40"));
          await expect(clockOf(canvasElement, REORDER.overtaken)).toBe("20:05");
          await expect(canvasElement).toHaveTextContent(
            "Liður færður í sæti 1 af 3: Kortalestur í hverfinu."
          );
        });

        await step("the keyboard puts it back", async () => {
          const row = canvasElement.querySelector<HTMLElement>(
            `[data-lidur-row="${REORDER.moved}"]`
          );
          row?.focus();
          await userEvent.keyboard(" ");
          await expect(canvasElement).toHaveTextContent(/Liður gripinn: Kortalestur í hverfinu/);
          await userEvent.keyboard("{ArrowDown}");
          await waitFor(() => expect(clockOf(canvasElement, REORDER.moved)).toBe("20:10"));
          await expect(clockOf(canvasElement, REORDER.overtaken)).toBe("19:40");
          await userEvent.keyboard(" ");
          await expect(canvasElement).toHaveTextContent("Sleppt.");
        });
      },
    } satisfies Story,
  };
}

const f0 = storiesFor("lagad", "F0 · Current, fixed up");
export const Lagad: Story = f0.normal;
export const LagadOverTime: Story = f0.overTime;
export const LagadUndecided: Story = f0.undecided;
export const LagadSplit: Story = f0.split;
export const LagadUndated: Story = f0.undated;
export const LagadPast: Story = f0.past;
export const LagadPhone: Story = f0.phone;
export const LagadDark: Story = f0.dark;
export const LagadEditor: Story = f0.editor;
export const LagadReorder: Story = f0.reorder;

const f1 = storiesFor("hreint", "F1 · Quiet");
export const Hreint: Story = f1.normal;
export const HreintOverTime: Story = f1.overTime;
export const HreintUndecided: Story = f1.undecided;
export const HreintSplit: Story = f1.split;
export const HreintUndated: Story = f1.undated;
export const HreintPast: Story = f1.past;
export const HreintPhone: Story = f1.phone;
export const HreintDark: Story = f1.dark;
export const HreintEditor: Story = f1.editor;
export const HreintReorder: Story = f1.reorder;

const f2 = storiesFor("stimplar", "F2 · Stamped");
export const Stimplar: Story = f2.normal;
export const StimplarOverTime: Story = f2.overTime;
export const StimplarUndecided: Story = f2.undecided;
export const StimplarSplit: Story = f2.split;
export const StimplarUndated: Story = f2.undated;
export const StimplarPast: Story = f2.past;
export const StimplarPhone: Story = f2.phone;
export const StimplarDark: Story = f2.dark;
export const StimplarEditor: Story = f2.editor;
export const StimplarReorder: Story = f2.reorder;

const f3 = storiesFor("blad", "F3 · Run sheet");
export const Blad: Story = f3.normal;
export const BladOverTime: Story = f3.overTime;
export const BladUndecided: Story = f3.undecided;
export const BladSplit: Story = f3.split;
export const BladUndated: Story = f3.undated;
export const BladPast: Story = f3.past;
export const BladPhone: Story = f3.phone;
export const BladDark: Story = f3.dark;
export const BladEditor: Story = f3.editor;
export const BladReorder: Story = f3.reorder;

const f4 = storiesFor("flokkur", "F4 · Patrol colour");
export const Flokkur: Story = f4.normal;
export const FlokkurOverTime: Story = f4.overTime;
export const FlokkurUndecided: Story = f4.undecided;
export const FlokkurSplit: Story = f4.split;
export const FlokkurUndated: Story = f4.undated;
export const FlokkurPast: Story = f4.past;
export const FlokkurPhone: Story = f4.phone;
export const FlokkurDark: Story = f4.dark;
export const FlokkurEditor: Story = f4.editor;
export const FlokkurReorder: Story = f4.reorder;

/* ── LidurRow close-up ── */

const CASES: { label: string; fundurId: string; lidurId: string; selected?: boolean }[] = [
  { label: "Staðfest", fundurId: FUNDUR.overTime, lidurId: "mock-lidur-2-1" },
  { label: "Drög", fundurId: FUNDUR.overTime, lidurId: "mock-lidur-2-2" },
  { label: "Óvíst", fundurId: FUNDUR.pastSveit, lidurId: "mock-lidur-1-3" },
  { label: "Óákveðið", fundurId: FUNDUR.nextUglur, lidurId: "mock-lidur-3-2" },
  { label: "Endurmat frá síðast", fundurId: FUNDUR.pastRefir, lidurId: "mock-lidur-0-2" },
  { label: "Selected", fundurId: FUNDUR.overTime, lidurId: "mock-lidur-2-3", selected: true },
];

const caption = {
  margin: "var(--sl-spacing-sm) 0 var(--sl-spacing-xs)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-caption)",
} as const;

/** Every style's row in each status, with endurmat, selected and a long title. */
export const RowCloseUp: Story = {
  name: "LidurRow close-up",
  render: () => (
    <div style={stack}>
      {LOOKS.map((l) => (
        <section key={l.look} style={{ maxWidth: "46rem" }}>
          <h3 style={heading}>{l.name}</h3>
          <Bench data={benchData()}>
            {CASES.map((row) => (
              <div key={row.label}>
                <p style={caption}>{row.label}</p>
                <LiveRowLab look={l.look} {...row} />
              </div>
            ))}
          </Bench>
          <p style={caption}>Long title, with endurmat</p>
          <Bench data={longTextBenchData()}>
            <LiveRowLab look={l.look} fundurId={FUNDUR.overTime} lidurId="mock-lidur-2-1" />
          </Bench>
        </section>
      ))}
    </div>
  ),
};

/** Any style on any fixture. Changing a control remounts it with fresh bench state. */
export const Playground: Story = {
  name: "Playground",
  render: (args) => <SheetLabDemo key={`${args.look}:${args.fixture}`} {...args} />,
};
