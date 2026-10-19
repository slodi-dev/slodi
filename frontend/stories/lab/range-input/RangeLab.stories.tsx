import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import RangeInput from "@/components/ui/RangeInput";
import RangeLab, { type RangeEntry, type RangeLabProps } from "./RangeLab";

/**
 * RangeInput's two full-width number fields are too wide and clunky. The picked direction, C ·
 * Values on the handles, pairs a two-handled slider with values that ride on the handles: drag a
 * handle, or type a number. A handle at the end of the track means no limit ("0", "180+").
 *
 * These variations keep that slider and differ only in how a number is typed in by hand:
 * C1 inline edit, C2 tap to edit (popover), C3 steppers on the handle, C4 fields under the ends
 * and C5 presets plus custom. Every one clamps and orders the values, snaps to the step, commits
 * only on Enter, blur or a deliberate tap (never mid-digit), and speaks what changed.
 *
 * A keyboard-first spinbutton was considered and left out: the slider handles already step with
 * the arrow keys, PageUp/PageDown and Home/End, and C1 already lets you type digits.
 *
 * Picked: C · Values on the handles; the other directions (A stacked, B inline, D presets) were
 * removed on 2026-10-19.
 */
const meta = {
  title: "Lab/RangeInput",
  component: RangeLab,
  tags: ["skip-visual"],
  args: {
    entry: "inline",
    label: "Lengd",
    min: 0,
    max: 180,
    step: 5,
    unit: "mín",
    minValue: 15,
    maxValue: 60,
    onChange: () => {},
  },
  argTypes: {
    entry: {
      control: "inline-radio",
      options: ["inline", "popover", "steppers", "fields", "presets"],
    },
  },
} satisfies Meta<typeof RangeLab>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live(
  props: Omit<RangeLabProps, "onChange" | "minValue" | "maxValue"> & { start?: [number?, number?] }
) {
  const [[lo, hi], set] = useState<[number | undefined, number | undefined]>([
    props.start?.[0],
    props.start?.[1],
  ]);
  return (
    <div style={{ maxWidth: "18rem" }}>
      <RangeLab {...props} minValue={lo} maxValue={hi} onChange={(a, b) => set([a, b])} />
      <p
        style={{
          marginTop: "var(--sl-spacing-sm)",
          fontSize: "var(--sl-text-xs)",
          color: "hsl(var(--sl-color-text-secondary))",
        }}
      >
        Filter: {lo ?? "no minimum"} – {hi ?? "no maximum"}
      </p>
    </div>
  );
}

const DURATION = { label: "Lengd", min: 0, max: 180, step: 5, unit: "mín" } as const;

const VARIATIONS: { entry: RangeEntry; name: string; when: string }[] = [
  {
    entry: "inline",
    name: "C1 · Inline edit",
    when: "Best when people mostly drag and only sometimes type: the fewest parts, and typing is one click away.",
  },
  {
    entry: "popover",
    name: "C2 · Tap to edit",
    when: "Best on phones, where a tiny in-place field is fiddly: the tap opens a full-size field with steps and a clear Í lagi.",
  },
  {
    entry: "steppers",
    name: "C3 · Steppers on the handle",
    when: "Best for small nudges (5 minutes more or less) without dragging, and for people who find dragging hard.",
  },
  {
    entry: "fields",
    name: "C4 · Fields under the ends",
    when: "Best when typing is as common as dragging: the fields are always there and look like fields, nothing to discover.",
  },
  {
    entry: "presets",
    name: "C5 · Presets plus custom",
    when: "Best when most answers are round numbers (30, 60, 90 mín): one tap, with Annað… for the rest.",
  },
];

const heading = {
  margin: 0,
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  fontSize: "var(--sl-text-body-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
} as const;

function Current() {
  const [lo, setLo] = useState<number | undefined>(15);
  const [hi, setHi] = useState<number | undefined>(60);
  return (
    <div style={{ maxWidth: "18rem" }}>
      <RangeInput
        minValue={lo}
        maxValue={hi}
        onMinChange={setLo}
        onMaxChange={setHi}
        step={5}
        minLabel="Lágmark: mínútur"
        maxLabel="Hámark: mínútur"
        minPlaceholder="Frá"
        maxPlaceholder="Til"
      />
    </div>
  );
}

function AllVariations() {
  return (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Current RangeInput</h3>
        <p style={idea}>Two wide number fields.</p>
        <Current />
      </section>
      {VARIATIONS.map((v) => (
        <section key={v.entry}>
          <h3 style={heading}>{v.name}</h3>
          <p style={idea}>{v.when}</p>
          <Live entry={v.entry} {...DURATION} start={[15, 60]} />
        </section>
      ))}
    </div>
  );
}

/** The current control, then every way of typing a number, all live at filter-sidebar width. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => <AllVariations />,
};

const slider = (canvas: ReturnType<typeof within>, side: "lágmark" | "hámark") =>
  canvas.getByRole("slider", { name: `Lengd: ${side}` });

/** C1: click (or Tab to) the value on the handle and type. Enter or blur commits, Escape reverts. */
export const InlineEdit: Story = {
  name: "C1 · Inline edit",
  render: () => <Live entry="inline" {...DURATION} start={[15, 60]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lo = canvas.getByRole("spinbutton", { name: "Lengd: lágmark" });
    await userEvent.clear(lo);
    await userEvent.type(lo, "2");
    // Half-typed: the slider hasn't moved yet.
    await expect(slider(canvas, "lágmark")).toHaveValue("15");
    await userEvent.type(lo, "5{Enter}");
    await expect(slider(canvas, "lágmark")).toHaveValue("25");
    const hi = canvas.getByRole("spinbutton", { name: "Lengd: hámark" });
    await userEvent.clear(hi);
    await userEvent.type(hi, "999{Enter}");
    // Clamped to the top of the scale, which means no limit.
    await expect(slider(canvas, "hámark")).toHaveValue("180");
    await expect(slider(canvas, "hámark")).toHaveAttribute("aria-valuetext", "Ekkert hámark");
    await userEvent.clear(lo);
    await userEvent.type(lo, "40{Escape}");
    await userEvent.tab();
    await expect(slider(canvas, "lágmark")).toHaveValue("25");
  },
};

/** C2: tap a value to open a small field with −/+ and "Í lagi". Escape or a click outside cancels. */
export const TapToEdit: Story = {
  name: "C2 · Tap to edit",
  render: () => <Live entry="popover" {...DURATION} start={[15, 60]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const open = (side: "lágmark" | "hámark") =>
      userEvent.click(canvas.getByRole("button", { name: new RegExp(`^Lengd: ${side}`) }));

    await open("lágmark");
    const dialog = await canvas.findByRole("dialog", { name: "Lengd: lágmark" });
    const field = within(dialog).getByRole("spinbutton");
    await expect(field).toHaveFocus();
    await userEvent.clear(field);
    await userEvent.type(field, "30");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hækka um 5" }));
    await expect(field).toHaveValue(35);
    // Nothing reaches the slider until Í lagi.
    await expect(slider(canvas, "lágmark")).toHaveValue("15");
    await userEvent.click(within(dialog).getByRole("button", { name: "Í lagi" }));
    await expect(slider(canvas, "lágmark")).toHaveValue("35");
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvas.getByRole("button", { name: /^Lengd: lágmark/ })).toHaveFocus();

    // A minimum above the maximum stops at the maximum.
    await open("lágmark");
    await userEvent.keyboard("{Control>}a{/Control}90{Enter}");
    await expect(slider(canvas, "lágmark")).toHaveValue("60");

    // Escape cancels.
    await open("hámark");
    await userEvent.keyboard("{Control>}a{/Control}120{Escape}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(slider(canvas, "hámark")).toHaveValue("60");

    // So does a click outside.
    await open("hámark");
    await userEvent.keyboard("{Control>}a{/Control}120");
    await userEvent.click(canvas.getByText(/^Filter:/));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(slider(canvas, "hámark")).toHaveValue("60");
  },
};

/** C3: − and + beside each value step by 5, and keep stepping while held. The number can still be typed. */
export const Steppers: Story = {
  name: "C3 · Steppers on the handle",
  render: () => <Live entry="steppers" {...DURATION} start={[15, 60]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Lengd: hækka lágmark" }));
    await expect(slider(canvas, "lágmark")).toHaveValue("20");
    await expect(canvas.getByRole("status")).toHaveTextContent("Lengd: lágmark 20 mín");

    // Held down, it repeats.
    const up = canvas.getByRole("button", { name: "Lengd: hækka hámark" });
    // Pressed and released as raw pointer events: separate userEvent.pointer calls forget the press.
    fireEvent.pointerDown(up, { button: 0 });
    await waitFor(() =>
      expect(Number((slider(canvas, "hámark") as HTMLInputElement).value)).toBeGreaterThanOrEqual(
        80
      )
    );
    fireEvent.pointerUp(up);
    const settled = (slider(canvas, "hámark") as HTMLInputElement).value;
    await new Promise((r) => setTimeout(r, 300));
    await expect(slider(canvas, "hámark")).toHaveValue(settled);

    // Typing still works.
    const lo = canvas.getByRole("spinbutton", { name: "Lengd: lágmark" });
    await userEvent.clear(lo);
    await userEvent.type(lo, "45{Enter}");
    await expect(slider(canvas, "lágmark")).toHaveValue("45");

    // − at the bottom of the scale stays at "no limit".
    await userEvent.clear(lo);
    await userEvent.type(lo, "5{Enter}");
    await userEvent.click(canvas.getByRole("button", { name: "Lengd: lækka lágmark" }));
    await userEvent.click(canvas.getByRole("button", { name: "Lengd: lækka lágmark" }));
    await expect(slider(canvas, "lágmark")).toHaveAttribute("aria-valuetext", "Ekkert lágmark");
  },
};

/** C4: the values on the handles are for reading; type into "Frá" and "Til" under the ends. Both stay in step. */
export const FieldsUnderEnds: Story = {
  name: "C4 · Fields under the ends",
  render: () => <Live entry="fields" {...DURATION} start={[15, 60]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const from = canvas.getByRole("spinbutton", { name: "Lengd: frá" });
    await userEvent.clear(from);
    await userEvent.type(from, "3");
    await expect(slider(canvas, "lágmark")).toHaveValue("15");
    await userEvent.type(from, "0{Enter}");
    await expect(slider(canvas, "lágmark")).toHaveValue("30");

    // Moving the handle updates the field.
    fireEvent.change(slider(canvas, "hámark"), { target: { value: "90" } });
    await expect(canvas.getByRole("spinbutton", { name: "Lengd: til" })).toHaveValue(90);

    // Emptying a field lifts that limit.
    const to = canvas.getByRole("spinbutton", { name: "Lengd: til" });
    await userEvent.clear(to);
    await userEvent.tab();
    await expect(slider(canvas, "hámark")).toHaveAttribute("aria-valuetext", "Ekkert hámark");
    await expect(to).toHaveAttribute("placeholder", "180+");
  },
};

/** C5: tap a value for a list of common values; "Annað…" reveals a number field. */
export const Presets: Story = {
  name: "C5 · Presets plus custom",
  render: () => <Live entry="presets" {...DURATION} start={[15, 60]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Lengd: lágmark/ }));
    let dialog = await canvas.findByRole("dialog", { name: "Lengd: lágmark" });
    // Focus starts on the current value, and values above the maximum aren't offered.
    await expect(within(dialog).getByRole("button", { name: "15 mín" })).toHaveFocus();
    await expect(within(dialog).queryByRole("button", { name: "90 mín" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "30 mín" }));
    await expect(slider(canvas, "lágmark")).toHaveValue("30");

    await userEvent.click(canvas.getByRole("button", { name: /^Lengd: hámark/ }));
    dialog = await canvas.findByRole("dialog", { name: "Lengd: hámark" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Annað…" }));
    const field = within(dialog).getByRole("spinbutton");
    await expect(field).toHaveFocus();
    await userEvent.clear(field);
    await userEvent.type(field, "75{Enter}");
    await expect(slider(canvas, "hámark")).toHaveValue("75");

    await userEvent.click(canvas.getByRole("button", { name: /^Lengd: hámark/ }));
    dialog = await canvas.findByRole("dialog", { name: "Lengd: hámark" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Ekkert hámark" }));
    await expect(slider(canvas, "hámark")).toHaveValue("180");
    await expect(canvas.getByRole("button", { name: /^Lengd: hámark/ })).toHaveTextContent("180+");
  },
};

/** Every variation at phone width (390px), where hit areas grow to 48px. */
export const Phone: Story = {
  name: "Phone",
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <AllVariations />,
};

/** The other two filters that use RangeInput, with C1. */
export const OtherFilters: Story = {
  name: "Other filters",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Participants</h3>
        <Live entry="inline" label="Fjöldi" min={1} max={60} start={[undefined, 20]} />
      </section>
      <section>
        <h3 style={heading}>Prep time</h3>
        <Live entry="inline" label="Undirbúningur" min={0} max={120} step={5} unit="mín" />
      </section>
    </div>
  ),
};

export const Playground: Story = { name: "Playground" };
