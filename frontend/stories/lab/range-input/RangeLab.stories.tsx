import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import RangeInput from "@/components/ui/RangeInput";
import RangeLab, { type RangeLabProps, type RangeLayout } from "./RangeLab";

/**
 * RangeInput's two full-width number fields are too wide and clunky. This pairs a two-handled
 * slider with values that ride on the handles: drag either handle in or out, or click its value
 * and type, and the other stays in step. The track always shows the lowest and highest possible
 * value.
 *
 * Picked: C · Values on the handles; the other directions (A stacked, B inline, D presets) were
 * removed on 2026-10-19.
 */
const meta = {
  title: "Lab/RangeInput",
  component: RangeLab,
  tags: ["skip-visual"],
  args: {
    layout: "bubbles",
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
    layout: { control: "inline-radio", options: ["bubbles"] },
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

const LOOKS: { layout: RangeLayout; name: string; idea: string }[] = [
  {
    layout: "bubbles",
    name: "C · Values on the handles",
    idea: "The value rides on each handle, and you can click it and type: drag for speed, type for precision.",
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

/** The current control and the picked layout at filter-sidebar width, all live: drag, type, or use the arrow keys. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <p style={heading}>Current</p>
        <p style={idea}>Two wide number fields.</p>
        <Current />
      </section>
      {LOOKS.map((l) => (
        <section key={l.layout}>
          <p style={heading}>{l.name}</p>
          <p style={idea}>{l.idea}</p>
          <Live
            layout={l.layout}
            label="Lengd"
            min={0}
            max={180}
            step={5}
            unit="mín"
            start={[15, 60]}
          />
        </section>
      ))}
    </div>
  ),
};

/** The other two filters that use RangeInput, in layout C. */
export const OtherFilters: Story = {
  name: "Other filters",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <p style={heading}>Participants</p>
        <Live layout="bubbles" label="Fjöldi" min={1} max={60} unit="" start={[undefined, 20]} />
      </section>
      <section>
        <p style={heading}>Prep time</p>
        <Live layout="bubbles" label="Undirbúningur" min={0} max={120} step={5} unit="mín" />
      </section>
    </div>
  ),
};

/** C on its own: drag a handle, or click its value and type. Enter commits, Escape reverts. */
export const ValuesOnHandles: Story = {
  name: "C · Values on the handles",
  render: () => (
    <Live layout="bubbles" label="Lengd" min={0} max={180} step={5} unit="mín" start={[15, 60]} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lo = canvas.getByRole("spinbutton", { name: "Lengd: lágmark" });
    await userEvent.clear(lo);
    await userEvent.type(lo, "25{Enter}");
    await expect(canvas.getByRole("slider", { name: "Lengd: lágmark" })).toHaveValue("25");
    const hi = canvas.getByRole("spinbutton", { name: "Lengd: hámark" });
    await userEvent.clear(hi);
    await userEvent.type(hi, "999{Enter}");
    // Clamped to the top of the scale.
    await expect(canvas.getByRole("slider", { name: "Lengd: hámark" })).toHaveValue("180");
    await userEvent.clear(lo);
    await userEvent.type(lo, "40{Escape}");
    await userEvent.tab();
    await expect(canvas.getByRole("slider", { name: "Lengd: lágmark" })).toHaveValue("25");
  },
};

export const Playground: Story = { name: "Playground" };
