import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import RangeInput from "@/components/ui/RangeInput";
import RangeLab, { type RangeLabProps, type RangeLayout } from "./RangeLab";

/**
 * RangeInput's two full-width number fields are too wide and clunky. These pair a two-handled
 * slider with small number fields: drag either handle in or out, or type a value, and the
 * other stays in step. The track always shows the lowest and highest possible value.
 */
const meta = {
  title: "Lab/RangeInput",
  component: RangeLab,
  tags: ["skip-visual"],
  args: {
    layout: "stacked",
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
    layout: { control: "inline-radio", options: ["stacked", "inline", "bubbles", "presets"] },
  },
} satisfies Meta<typeof RangeLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const PRESETS = [
  { label: "Undir 15 mín", max: 15 },
  { label: "15–30", min: 15, max: 30 },
  { label: "30–60", min: 30, max: 60 },
  { label: "Yfir 60", min: 60 },
];

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
    layout: "stacked",
    name: "A · Slider and fields",
    idea: "Slider on top, the scale under it, two small fields below.",
  },
  {
    layout: "inline",
    name: "B · Fields at the ends",
    idea: "One line: field, slider, field. The most compact.",
  },
  {
    layout: "bubbles",
    name: "C · Values on the handles",
    idea: "The value rides on each handle; no fields, arrow keys for precision.",
  },
  {
    layout: "presets",
    name: "D · Presets and slider",
    idea: "The common ranges in one tap, the slider for the rest.",
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

/** Every layout at filter-sidebar width, all live: drag, type, or use the arrow keys. */
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
            presets={PRESETS}
          />
        </section>
      ))}
    </div>
  ),
};

/** The other two filters that use RangeInput, in layout A. */
export const OtherFilters: Story = {
  name: "Other filters",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <p style={heading}>Participants</p>
        <Live layout="stacked" label="Fjöldi" min={1} max={60} unit="" start={[undefined, 20]} />
      </section>
      <section>
        <p style={heading}>Prep time</p>
        <Live layout="stacked" label="Undirbúningur" min={0} max={120} step={5} unit="mín" />
      </section>
    </div>
  ),
};

export const Playground: Story = { name: "Playground" };
