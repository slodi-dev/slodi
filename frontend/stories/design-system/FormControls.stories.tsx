import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { expect } from "storybook/test";

/**
 * The form-control border, in every state, with its contrast measured live.
 *
 * A text field, textarea, select or combobox has no fill that sets it apart
 * from the page, so its border is the only thing that says "you can type
 * here". WCAG 1.4.11 asks 3:1 for that edge. The rest border is
 * `--sl-input-border` → `--sl-color-border-strong` (TOK-04); `--sl-color-border`
 * is for cards and dividers, which have other cues, and is only 1.38:1.
 */

type State = "rest" | "hover" | "focus" | "error" | "disabled";

/** What each state paints, by token. Hover and focus are pinned inline so the
 *  sheet can show them side by side; the live fields at the bottom are real. */
const STATE_BORDER: Record<State, string> = {
  rest: "--sl-input-border",
  hover: "--sl-input-border-hover",
  focus: "--sl-input-border-focus",
  error: "--sl-input-border-error",
  disabled: "--sl-input-border",
};

const LABEL: Record<State, string> = {
  rest: "Hvíld",
  hover: "Bendill yfir",
  focus: "Í fókus",
  error: "Villa",
  disabled: "Óvirkt",
};

function parseRgb(value: string): [number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return [r, g, b];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: string, b: string): number {
  const x = parseRgb(a);
  const y = parseRgb(b);
  if (!x || !y) return 0;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Border against the field's own fill and against the page, whichever is lower. */
function measure(el: HTMLElement): number {
  const field = getComputedStyle(el);
  const page = getComputedStyle(document.body).backgroundColor;
  return Math.min(
    ratio(field.borderTopColor, field.backgroundColor),
    ratio(field.borderTopColor, page)
  );
}

function Row({ state, children }: { state: State; children: (style: CSSProperties) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    const control = ref.current?.querySelector<HTMLElement>("input, textarea, select");
    if (control) setValue(measure(control));
  }, []);

  const style: CSSProperties = { borderColor: `hsl(var(${STATE_BORDER[state]}))` };
  if (state === "focus") style.boxShadow = "0 0 0 3px hsl(var(--sl-color-focus-ring))";

  return (
    <div
      ref={ref}
      data-state={state}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(7rem, auto) 1fr auto",
        gap: "var(--sl-spacing-gap-md)",
        alignItems: "center",
      }}
    >
      <strong>{LABEL[state]}</strong>
      {children(style)}
      <code data-ratio={value ?? ""} style={{ whiteSpace: "nowrap" }}>
        {value === null ? "…" : `${value.toFixed(2)}:1`}
        <span className="sl-sr-only"> {STATE_BORDER[state]}</span>
      </code>
    </div>
  );
}

const STATES: State[] = ["rest", "hover", "focus", "error", "disabled"];

function Sheet({ control }: { control: "input" | "textarea" | "select" }) {
  return (
    <div style={{ display: "grid", gap: "var(--sl-spacing-gap-md)", maxWidth: 640 }}>
      {STATES.map((state) => (
        <Row key={state} state={state}>
          {(style) => {
            const common = {
              className: state === "error" ? "sl-input sl-input-error" : "sl-input",
              style,
              disabled: state === "disabled",
              "aria-invalid": state === "error" || undefined,
              "aria-label": `${LABEL[state]} (${control})`,
            };
            if (control === "textarea")
              return <textarea {...common} rows={2} defaultValue="Ratleikur í Heiðmörk" />;
            if (control === "select")
              return (
                <select {...common} defaultValue="drekar">
                  <option value="drekar">Drekaskátar</option>
                  <option value="falkar">Fálkaskátar</option>
                </select>
              );
            return <input {...common} type="text" placeholder="Leita að dagskrá" />;
          }}
        </Row>
      ))}
    </div>
  );
}

const meta = {
  title: "Design system/Form controls",
  parameters: {
    docs: {
      description: {
        component:
          "Every state of a form control's border, with the contrast against the field " +
          "and the page measured in the browser. Rest is `--sl-input-border` = " +
          "`--sl-color-border-strong`: **3.66:1** on the light surface, **3.76:1** on the " +
          "dark one (was `--sl-color-border`, 1.38 / 1.67 — TOK-04). Hover goes darker " +
          "(`--sl-color-border-strong-hover`, 5.29 / 5.82), never lighter, so pointing at a " +
          "field never drops it under 3:1. Use `--sl-input-border*` for any text field, " +
          "textarea, select, search box or combobox; keep `--sl-color-border` for cards and " +
          "dividers. Hover and focus are pinned inline here so they sit side by side.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Rest, hover, focus and error are the control's only edge: each needs 3:1.
    // Disabled is exempt (1.4.11 excludes inactive components).
    for (const state of ["rest", "hover", "focus", "error"] as const) {
      const row = canvasElement.querySelector<HTMLElement>(`[data-state="${state}"]`);
      const control = row?.querySelector<HTMLElement>("input, textarea, select");
      await expect(control).toBeTruthy();
      await expect(measure(control!)).toBeGreaterThanOrEqual(3);
    }
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = { render: () => <Sheet control="input" /> };

export const Textarea: Story = { render: () => <Sheet control="textarea" /> };

export const Select: Story = { render: () => <Sheet control="select" /> };
