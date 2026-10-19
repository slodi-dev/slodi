import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LiveSheet, longTextBenchData } from "@/stories/vinnubekkur/benchHarness";
import { Bench, FUNDUR, LiveRowLab, REORDER, SheetLabDemo, benchData } from "./labHarness";
import { LOOKS, type FundurSheetLook } from "./sheetModel";

/**
 * FundurSheet and LidurRow variations. The current sheet is accurate but reads
 * evenly: a 24px uppercase title, then everything else at 12px in grey, so the
 * running order, the fit and what's undecided all have the same weight. These
 * four directions each answer one of the leader's questions first. Why, and
 * when each fits: Lab → FundurSheet → About.
 */

const meta = {
  title: "Lab/FundurSheet/Directions",
  component: SheetLabDemo,
  tags: ["skip-visual"],
  args: { look: "dagskra", fixture: "normal" },
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

/** The current sheet first, then each direction, all on this week's 100 / 90 mín fundur. */
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

/* ── One set of stories per direction ── */

const phone = { viewport: { value: "phone", isRotated: false } };

/** Clock text of one row, as the look draws it. */
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
        await expect(
          within(canvasElement).getAllByText("100 / 90 mín · 10 yfir").length
        ).toBeGreaterThan(0);
      },
    } satisfies Story,
    undecided: { name: `${name}: undecided`, args: { look, fixture: "undecided" } } satisfies Story,
    split: { name: `${name}: split section`, args: { look, fixture: "split" } } satisfies Story,
    undated: {
      name: `${name}: undated`,
      args: { look, fixture: "undated" },
      play: async ({ canvasElement }) => {
        // No clock, so the rows count from the start instead.
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
    /**
     * ▲ moves Kortalestur above Áttavitinn and both start times follow; then the
     * keyboard path (Space, ↓, Space) puts it back, announced at each step.
     */
    reorder: {
      name: `${name}: reorder`,
      args: { look, fixture: "normal" },
      play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);
        await expect(clockOf(canvasElement, REORDER.overtaken)).toBe("19:40");
        await expect(clockOf(canvasElement, REORDER.moved)).toBe("20:10");

        await step("▲ moves it up and the times follow", async () => {
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

const a = storiesFor("dagskra", "A · Dagskrá");
export const Dagskra: Story = a.normal;
export const DagskraOverTime: Story = a.overTime;
export const DagskraUndecided: Story = a.undecided;
export const DagskraSplit: Story = a.split;
export const DagskraUndated: Story = a.undated;
export const DagskraPast: Story = a.past;
export const DagskraPhone: Story = a.phone;
export const DagskraDark: Story = a.dark;
export const DagskraReorder: Story = a.reorder;

const b = storiesFor("timalina", "B · Tímalína");
export const Timalina: Story = b.normal;
export const TimalinaOverTime: Story = b.overTime;
export const TimalinaUndecided: Story = b.undecided;
export const TimalinaSplit: Story = b.split;
export const TimalinaUndated: Story = b.undated;
export const TimalinaPast: Story = b.past;
export const TimalinaPhone: Story = b.phone;
export const TimalinaDark: Story = b.dark;
export const TimalinaReorder: Story = b.reorder;

const c = storiesFor("gatlisti", "C · Gátlisti");
export const Gatlisti: Story = c.normal;
export const GatlistiOverTime: Story = c.overTime;
export const GatlistiUndecided: Story = {
  ...c.undecided,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2 óákveðnir")).toBeInTheDocument();
    // A to-do jumps to its row.
    await userEvent.click(canvas.getByRole("button", { name: "Óákveðið Leikur" }));
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-lidur-row="mock-lidur-5-2"]')).toHaveFocus()
    );
  },
};
export const GatlistiSplit: Story = c.split;
export const GatlistiUndated: Story = c.undated;
export const GatlistiPast: Story = c.past;
export const GatlistiPhone: Story = c.phone;
export const GatlistiDark: Story = c.dark;
export const GatlistiReorder: Story = c.reorder;

const d = storiesFor("thett", "D · Þétt tafla");
export const Thett: Story = d.normal;
export const ThettOverTime: Story = d.overTime;
export const ThettUndecided: Story = d.undecided;
export const ThettSplit: Story = d.split;
export const ThettUndated: Story = d.undated;
export const ThettPast: Story = d.past;
export const ThettPhone: Story = d.phone;
export const ThettDark: Story = d.dark;
export const ThettReorder: Story = d.reorder;

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
  fontSize: "var(--sl-text-overline)",
} as const;

/** Every direction's row in each status, with endurmat, selected and a long title. */
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

/** Any direction on any fixture. Changing a control remounts it with fresh bench state. */
export const Playground: Story = {
  name: "Playground",
  render: (args) => <SheetLabDemo key={`${args.look}:${args.fixture}`} {...args} />,
};
