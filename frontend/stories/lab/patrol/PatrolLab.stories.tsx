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
const meta = {
  title: "Lab/PatrolBadges",
  tags: ["skip-visual"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Shades = { light: string; dark: string };
const PATROLS: { key: string; name: string; ink: Shades; white: Shades }[] = [
  {
    key: "drekar",
    name: "Drekaskátar",
    ink: { light: "48 72% 39.5%", dark: "48 72% 53.5%" },
    white: { light: "48 72% 28.5%", dark: "48 72% 31.5%" },
  },
  {
    key: "falkar",
    name: "Fálkaskátar",
    ink: { light: "347 52% 63.0%", dark: "347 52% 77.0%" },
    white: { light: "347 52% 50.0%", dark: "347 52% 53.0%" },
  },
  {
    key: "drott",
    name: "Dróttskátar",
    ink: { light: "168 48% 43.0%", dark: "168 48% 57.0%" },
    white: { light: "168 48% 31.5%", dark: "168 48% 34.5%" },
  },
  {
    key: "rekkar",
    name: "Rekkaskátar",
    ink: { light: "177 56% 40.5%", dark: "177 56% 54.5%" },
    white: { light: "177 56% 29.5%", dark: "177 56% 32.5%" },
  },
  {
    key: "rover",
    name: "Róverskátar",
    ink: { light: "28 66% 49.5%", dark: "28 66% 63.5%" },
    white: { light: "28 66% 37.5%", dark: "28 66% 40.5%" },
  },
  {
    key: "adrir",
    name: "Aðrir",
    ink: { light: "270 50% 66.0%", dark: "270 50% 80.0%" },
    white: { light: "270 50% 54.0%", dark: "270 50% 57.0%" },
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

function Panel({ mode, set }: { mode: "light" | "dark"; set: "ink" | "white" }) {
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
        <Badge key={p.key} bg={p[set][mode]} fg={set === "ink" ? INK : WHITE} name={p.name} />
      ))}
    </div>
  );
}

function Set({ set, title, idea }: { set: "ink" | "white"; title: string; idea: string }) {
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
        title="A · Dark text everywhere (recommended)"
        idea="Every colour light enough for near-black text. In dark mode they get lighter and glow on the dark surface. Yellow stays yellow."
      />
      <Set
        set="white"
        title="B · White text everywhere"
        idea="Every colour dark enough for white text. It passes, but Drekar turns olive and Rekkar nearly dark green: the identity colours are lost."
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
      {["ink", "white"]
        .map((set) =>
          [
            `/* ${set === "ink" ? "A · dark text" : "B · white text"} */`,
            ...PATROLS.map((p) => {
              const s = p[set as "ink" | "white"];
              return `--sl-color-patrol-${p.key}: ${s.light};   /* dark: ${s.dark} */`;
            }),
            `--sl-color-patrol-*-foreground: ${set === "ink" ? INK : WHITE};   /* same in both modes */`,
          ].join("\n")
        )
        .join("\n\n")}
    </pre>
  ),
};
