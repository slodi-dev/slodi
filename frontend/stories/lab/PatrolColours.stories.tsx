/* token-check-ignore-file — a colour lab: it renders literal candidate colours on purpose. */
import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

/**
 * sc-600: patrol badge contrast lab.
 *
 * Fálkar and Drótt badges carry white text that fails WCAG AA (4.5:1). This
 * story lays the current badges next to candidate fixes, in light and dark
 * mode side by side, with every ratio computed here from the colour itself.
 * Nothing in app/slodi-tokens.css is changed — the values below are copies of
 * the HSL triplets in that file (light: the -500 step, dark: the -400 step).
 */

// ---------------------------------------------------------------- colour maths

type Hsl = readonly [h: number, s: number, l: number];
type Rgb = readonly [r: number, g: number, b: number];

function hslToRgb([h, s, l]: Hsl): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG 2.x relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Lower lightness in 0.5% steps (same hue and saturation) until `fg` reaches `target`. */
function darkenUntil(bg: Hsl, fg: Hsl, target = 4.5): Hsl {
  let l = bg[2];
  while (l > 0 && contrast(hslToRgb([bg[0], bg[1], l]), hslToRgb(fg)) < target) l -= 0.5;
  return [bg[0], bg[1], l];
}

// ---------------------------------------------------------------- the palette

const WHITE: Hsl = [0, 0, 100];
const NEAR_BLACK: Hsl = [0, 0, 10]; // --sl-primitive-drekar-on / rover-on
const NAVY: Hsl = [222, 47, 11]; // --sl-primitive-rekkar-on

type Mode = "light" | "dark";
type PatrolId = "drekar" | "falkar" | "drott" | "rekkar" | "rover" | "adrir";
type Swatch = { bg: Hsl; fg: Hsl };
type PatrolSet = Record<PatrolId, Swatch>;

const NAMES: Record<PatrolId, string> = {
  drekar: "Drekar",
  falkar: "Fálkar",
  drott: "Drótt",
  rekkar: "Rekkar",
  rover: "Róver",
  adrir: "Aðrir",
};
const ORDER: PatrolId[] = ["drekar", "falkar", "drott", "rekkar", "rover", "adrir"];

/** Badge background = --sl-color-patrol-<id>, text = its -foreground (slodi-tokens.css). */
const CURRENT: Record<Mode, PatrolSet> = {
  light: {
    drekar: { bg: [48, 77, 61], fg: NEAR_BLACK },
    falkar: { bg: [347, 51, 57], fg: WHITE },
    drott: { bg: [168, 48, 42], fg: WHITE },
    rekkar: { bg: [177, 58, 59], fg: NAVY },
    rover: { bg: [28, 65, 59], fg: NEAR_BLACK },
    adrir: { bg: [270, 46, 64], fg: WHITE },
  },
  dark: {
    drekar: { bg: [48, 69, 55], fg: NEAR_BLACK },
    falkar: { bg: [347, 44, 55], fg: WHITE },
    drott: { bg: [168, 45, 50], fg: WHITE },
    rekkar: { bg: [177, 58, 60], fg: NAVY },
    rover: { bg: [28, 65, 60], fg: NEAR_BLACK },
    adrir: { bg: [270, 46, 65], fg: WHITE },
  },
};

/** Page backgrounds the badges sit on (--sl-color-background). */
const PAGE: Record<Mode, { bg: Hsl; fg: Hsl }> = {
  light: { bg: [150, 20, 99], fg: [150, 20, 12] },
  dark: { bg: [150, 12, 9], fg: [150, 8, 95] },
};

type Option = {
  key: string;
  title: string;
  note: string;
  /** Replacement swatches; patrols not listed keep their current colours. */
  swatches: (mode: Mode) => Partial<PatrolSet>;
};

const OPTIONS: Option[] = [
  {
    key: "a",
    title: "(a) Keep the colour, dark text",
    note: "Background untouched, text switches to the near-black used on Drekar and Róver. Works for Drótt; Fálkar sits in the mid-luminance dead zone where neither white nor black reaches 4.5:1.",
    swatches: (m) => ({
      falkar: { bg: CURRENT[m].falkar.bg, fg: NEAR_BLACK },
      drott: { bg: CURRENT[m].drott.bg, fg: NEAR_BLACK },
    }),
  },
  {
    key: "b",
    title: "(b) Same hue and saturation, darkened to 4.5:1",
    note: "Lightness lowered in 0.5% steps until white text just passes. The smallest visual change that is compliant, but with no headroom.",
    swatches: (m) => ({
      falkar: { bg: darkenUntil(CURRENT[m].falkar.bg, WHITE), fg: WHITE },
      drott: { bg: darkenUntil(CURRENT[m].drott.bg, WHITE), fg: WHITE },
    }),
  },
  {
    key: "c",
    title: "(c) Shifted hue, darkened to 4.5:1",
    note: "Fálkar moves from 347° to a more saturated crimson-raspberry (340°, 60%); Drótt moves from 168° towards green (155°, 50%), away from Rekkar's 177° cyan, so the two teals stop being siblings.",
    swatches: () => ({
      falkar: { bg: darkenUntil([340, 60, 60], WHITE), fg: WHITE },
      drott: { bg: darkenUntil([155, 50, 50], WHITE), fg: WHITE },
    }),
  },
  {
    key: "d",
    title: "(d) Use the existing -600 step in both modes",
    note: "No new primitives: point the badge background at --sl-primitive-falkar-600 / --sl-primitive-drott-600 (which already exist) in light and dark. Comfortable headroom above 4.5:1.",
    swatches: () => ({
      falkar: { bg: [347, 44, 47], fg: WHITE },
      drott: { bg: [168, 45, 35], fg: WHITE },
    }),
  },
  {
    key: "e",
    title: "(e) Soft badge: tinted background, dark coloured text",
    note: "A different badge style for these two: the -50 tint with -800 text in light mode, the -900 shade with -100 text in dark. High contrast, but visually quieter than the solid badges beside it — it would only make sense if every patrol switched to it.",
    swatches: (m) =>
      m === "light"
        ? {
            falkar: { bg: [347, 38, 95], fg: [347, 44, 30] },
            drott: { bg: [168, 43, 95], fg: [168, 45, 22] },
          }
        : {
            falkar: { bg: [347, 44, 20], fg: [347, 38, 85] },
            drott: { bg: [168, 45, 15], fg: [168, 43, 85] },
          },
  },
  {
    key: "rec",
    title: "Recommended: (d) for Fálkar and Drótt, plus Aðrir fixed the same way",
    note: "Aðrir (270°, white text) also fails AA today (3.40 light / 3.25 dark), though it is not in the ticket. Shown here with its existing -600 step (270° 41% 56%). Every badge in this row passes.",
    swatches: () => ({
      falkar: { bg: [347, 44, 47], fg: WHITE },
      drott: { bg: [168, 45, 35], fg: WHITE },
      adrir: { bg: [270, 41, 56], fg: WHITE },
    }),
  },
];

// ---------------------------------------------------------------- rendering

const AA = 4.5;

function Badge({ id, swatch, changed }: { id: PatrolId; swatch: Swatch; changed: boolean }) {
  const bg = hslToRgb(swatch.bg);
  const fg = hslToRgb(swatch.fg);
  const ratio = contrast(bg, fg);
  const pass = ratio >= AA;
  return (
    <figure
      data-patrol={id}
      data-ratio={ratio.toFixed(2)}
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 6,
        borderRadius: 8,
        outline: changed ? "2px dashed currentColor" : "none",
        outlineOffset: 1,
        minWidth: 88,
      }}
    >
      <span
        className="sl-badge"
        style={{ backgroundColor: toHex(bg), color: toHex(fg), fontWeight: 600 }}
      >
        {NAMES[id]}
      </span>
      <figcaption style={{ fontSize: 11, lineHeight: 1.35, textAlign: "center" }}>
        <code>{toHex(bg)}</code>
        <br />
        on <code>{toHex(fg)}</code>
        <br />
        <strong>{ratio.toFixed(2)}:1</strong> {pass ? "✓ AA" : "✗ fail"}
      </figcaption>
    </figure>
  );
}

function Panel({ mode, children }: { mode: Mode; children: ReactNode }) {
  const style: CSSProperties = {
    flex: "1 1 320px",
    background: toHex(hslToRgb(PAGE[mode].bg)),
    color: toHex(hslToRgb(PAGE[mode].fg)),
    border: "1px solid #8884",
    borderRadius: 12,
    padding: 12,
  };
  return (
    <div style={style} data-mode={mode}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {mode === "light" ? "Light" : "Dark"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{children}</div>
    </div>
  );
}

function Row({
  id,
  title,
  note,
  override,
}: {
  id: string;
  title: string;
  note?: string;
  override: (mode: Mode) => Partial<PatrolSet>;
}) {
  return (
    <section data-option={id} style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>{title}</h2>
      {note && <p style={{ fontSize: 13, margin: "0 0 8px", maxWidth: 820 }}>{note}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {(["light", "dark"] as const).map((mode) => {
          const changes = override(mode);
          return (
            <Panel key={mode} mode={mode}>
              {ORDER.map((p) => (
                <Badge
                  key={p}
                  id={p}
                  swatch={changes[p] ?? CURRENT[mode][p]}
                  changed={p in changes}
                />
              ))}
            </Panel>
          );
        })}
      </div>
    </section>
  );
}

function PatrolColourLab() {
  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Patrol badge colours (sc-600)</h1>
      <p style={{ fontSize: 13, margin: "0 0 20px", maxWidth: 820 }}>
        Ratios are WCAG 2.x contrast, computed in this story from the hex shown. AA for normal text
        is 4.5:1. Dashed outline = changed from today. Each row shows all six patrols together so
        you can judge whether they stay distinguishable. The real tokens are unchanged.
      </p>
      <Row id="current" title="Current" override={() => ({})} />
      {OPTIONS.map((o) => (
        <Row key={o.key} id={o.key} title={o.title} note={o.note} override={o.swatches} />
      ))}
    </div>
  );
}

const meta = {
  title: "Lab/Patrol colours",
  component: PatrolColourLab,
  parameters: {
    layout: "padded",
    // Intentionally shows failing combinations: report, never fail.
    a11y: { test: "todo" },
  },
} satisfies Meta<typeof PatrolColourLab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Alternatives: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ratio = (option: string, mode: Mode, patrol: PatrolId) =>
      canvasElement
        .querySelector(`[data-option="${option}"] [data-mode="${mode}"] [data-patrol="${patrol}"]`)
        ?.getAttribute("data-ratio");

    // The ticket's numbers, reproduced from the current tokens.
    await expect(ratio("current", "light", "falkar")).toBe("4.07");
    await expect(ratio("current", "dark", "falkar")).toBe("4.28");
    await expect(ratio("current", "light", "drott")).toBe("3.23");
    await expect(ratio("current", "dark", "drott")).toBe("2.41");

    // The recommended row passes everywhere.
    const rec = canvasElement.querySelectorAll('[data-option="rec"] [data-ratio]');
    await expect(rec.length).toBe(12);
    for (const el of rec) {
      await expect(Number(el.getAttribute("data-ratio"))).toBeGreaterThanOrEqual(AA);
    }
    await expect(canvas.getByText("Patrol badge colours (sc-600)")).toBeVisible();
  },
};
