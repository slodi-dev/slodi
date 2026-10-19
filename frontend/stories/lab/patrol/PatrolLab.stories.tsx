import type { Meta, StoryObj } from "@storybook/nextjs-vite";

/**
 * Proposed patrol colours where the badge text is the **same colour in light and dark mode**.
 * Each patrol gets a light-mode and a dark-mode shade (same hue and saturation, different
 * lightness), chosen so the one text colour passes WCAG AA (4.5:1) on both. Contrast is
 * measured live in the browser and shown on every badge.
 *
 * Both panels are drawn on fixed light and dark surfaces, so they can be compared side by side
 * whatever the toolbar theme says.
 */
/* Six vivid, unmistakable colours (review 2026-10-19): Drekar yellow, Fálkar red, Drótt green,
   Rekkar blue, Róver orange, Aðrir purple. */
const meta = {
  title: "Lab/PatrolBadges",
  tags: ["skip-visual"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Shades = { light: string; dark: string };
type SetName = "ink" | "white" | "mixed";
const PATROLS: { key: string; name: string; ink: Shades; white: Shades }[] = [
  {
    key: "drekar",
    name: "Drekaskátar",
    ink: { light: "48 92% 52%", dark: "48 92% 62%" },
    white: { light: "48 92% 26.5%", dark: "48 92% 28.5%" },
  },
  {
    key: "falkar",
    name: "Fálkaskátar",
    ink: { light: "356 82% 61.0%", dark: "356 82% 71.0%" },
    white: { light: "356 82% 47.5%", dark: "356 82% 49.5%" },
  },
  {
    key: "drott",
    name: "Dróttskátar",
    ink: { light: "134 70% 52%", dark: "134 70% 62%" },
    white: { light: "134 70% 29.0%", dark: "134 70% 31.0%" },
  },
  {
    key: "rekkar",
    name: "Rekkaskátar",
    ink: { light: "212 88% 55.0%", dark: "212 88% 65.0%" },
    white: { light: "212 88% 45.5%", dark: "212 88% 47.5%" },
  },
  {
    key: "rover",
    name: "Róverskátar",
    ink: { light: "26 92% 52%", dark: "26 92% 62%" },
    white: { light: "26 92% 36.5%", dark: "26 92% 38.5%" },
  },
  {
    key: "adrir",
    name: "Aðrir",
    ink: { light: "272 72% 65.5%", dark: "272 72% 75.5%" },
    white: { light: "272 72% 57.0%", dark: "272 72% 59.0%" },
  },
];

const INK = "0 0% 10%";
const WHITE = "0 0% 100%";
/* The app's light and dark surfaces (--sl-color-surface in each mode). */
const SURFACE = { light: "0 0% 100%", dark: "150 12% 11%" };

function hslToRgb(hsl: string): [number, number, number] {
  const [h, s, l] = hsl.replace(/%/g, "").split(/\s+/).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
function contrast(a: string, b: string) {
  const lum = (c: string) =>
    hslToRgb(c)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function Badge({ bg, fg, name }: { bg: string; fg: string; name: string }) {
  const ratio = contrast(bg, fg);
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "var(--sl-spacing-xs)",
      }}
    >
      <span
        style={{
          padding: "var(--sl-spacing-xs) var(--sl-spacing-inset-sm)",
          borderRadius: "var(--sl-radius-badge)",
          background: `hsl(${bg})`,
          color: `hsl(${fg})`,
          fontSize: "var(--sl-text-caption)",
          fontWeight: "var(--sl-font-weight-semibold)",
        }}
      >
        {name}
      </span>
      <small style={{ fontSize: "var(--sl-text-xs)", opacity: 0.85 }}>
        {ratio.toFixed(2).replace(".", ",")}:1 {ratio >= 4.5 ? "✓ AA" : "✗ below AA"}
      </small>
    </span>
  );
}

/** Set C is set B, except Drekar keeps a bright yellow with dark text. */
function pick(p: (typeof PATROLS)[number], set: SetName, mode: "light" | "dark") {
  if (set === "ink" || (set === "mixed" && p.key === "drekar")) return { bg: p.ink[mode], fg: INK };
  return { bg: p.white[mode], fg: WHITE };
}

function Panel({ mode, set }: { mode: "light" | "dark"; set: SetName }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sl-spacing-md)",
        padding: "var(--sl-spacing-md)",
        borderRadius: "var(--sl-radius-card)",
        background: `hsl(${SURFACE[mode]})`,
        color: `hsl(${mode === "light" ? INK : WHITE})`,
      }}
    >
      <strong
        style={{
          flexBasis: "100%",
          fontSize: "var(--sl-text-xs)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {mode === "light" ? "Light" : "Dark"}
      </strong>
      {PATROLS.map((p) => (
        <Badge key={p.key} {...pick(p, set, mode)} name={p.name} />
      ))}
    </div>
  );
}

function Set({ set, title, idea }: { set: SetName; title: string; idea: string }) {
  return (
    <section style={{ display: "grid", gap: "var(--sl-spacing-sm)" }}>
      <h3
        style={{
          margin: 0,
          font: "var(--sl-font-weight-semibold) var(--sl-text-body) var(--sl-font-family-body)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "var(--sl-text-body-sm)",
          color: "hsl(var(--sl-color-text-secondary))",
        }}
      >
        {idea}
      </p>
      <Panel mode="light" set={set} />
      <Panel mode="dark" set={set} />
    </section>
  );
}

/** Both proposals, each on a light and a dark surface. */
export const Comparison: Story = {
  name: "Comparison",
  render: () => (
    <div style={{ display: "grid", gap: "var(--sl-spacing-xl)", maxWidth: "52rem" }}>
      <Set
        set="ink"
        title="A · Dark text everywhere"
        idea="Every colour light enough for near-black text. In dark mode they get lighter and glow on the dark surface. Yellow stays yellow."
      />
      <Set
        set="white"
        title="B · White text everywhere"
        idea="Every colour dark enough for white text. Vivid, except yellow: white on a bright yellow can never reach AA, so Drekar turns mustard."
      />
      <Set
        set="mixed"
        title="C · White text, bright yellow with dark text"
        idea="Set B, but Drekar keeps a bright yellow with dark text: the one exception to a single text colour."
      />
    </div>
  ),
};

/** The token values each proposal would set, to paste into slodi-tokens.css once one is picked. */
export const Tokens: Story = {
  render: () => (
    <pre
      style={{
        fontFamily: "var(--sl-font-family-code)",
        fontSize: "var(--sl-text-code)",
        whiteSpace: "pre-wrap",
      }}
    >
      {(["ink", "white", "mixed"] as const)
        .map((set) =>
          [
            `/* ${{ ink: "A · dark text", white: "B · white text", mixed: "C · white text, yellow with dark text" }[set]} */`,
            ...PATROLS.flatMap((p) => {
              const light = pick(p, set, "light");
              const dark = pick(p, set, "dark");
              return [
                `--sl-color-patrol-${p.key}: ${light.bg};   /* dark: ${dark.bg} */`,
                `--sl-color-patrol-${p.key}-foreground: ${light.fg};   /* same in both modes */`,
              ];
            }),
          ].join("\n")
        )
        .join("\n\n")}
    </pre>
  ),
};
