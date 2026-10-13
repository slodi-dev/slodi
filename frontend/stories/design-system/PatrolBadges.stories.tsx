import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useRef, useState } from "react";

/**
 * The six patrol colours as the app uses them: a pill with the patrol's name,
 * its `-foreground` ink on the base colour. This used to live on /palette
 * (retired, TOK-15); the Tokens page has the swatches and ramps, this story
 * has the badge as it actually renders, with the text contrast measured live
 * in the current theme.
 */

const PATROLS = [
  { key: "drekar", name: "Drekaskátar" },
  { key: "falkar", name: "Fálkaskátar" },
  { key: "drott", name: "Dróttskátar" },
  { key: "rekkar", name: "Rekkaskátar" },
  { key: "rover", name: "Róverskátar" },
  { key: "adrir", name: "Aðrir" },
] as const;

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

function contrast(el: HTMLElement): number {
  const s = getComputedStyle(el);
  const fg = parseRgb(s.color);
  const bg = parseRgb(s.backgroundColor);
  if (!fg || !bg) return 0;
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function Badge({ patrol, name, large }: { patrol: string; name: string; large?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    if (ref.current) setRatio(contrast(ref.current));
  }, []);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        ref={ref}
        className={`sl-bg-patrol-${patrol}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: large ? "0.4rem 1rem" : "0.2rem 0.7rem",
          borderRadius: "var(--sl-radius-pill)",
          fontSize: large ? "var(--sl-text-body)" : "var(--sl-text-caption)",
          fontWeight: 600,
        }}
      >
        {name}
      </span>
      <code style={{ fontSize: "var(--sl-text-caption)" }}>
        {ratio === null ? "…" : `${ratio.toFixed(2)}:1`}
      </code>
    </span>
  );
}

function Sheet({ large }: { large?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sl-spacing-gap-md)" }}>
      {PATROLS.map((p) => (
        <Badge key={p.key} patrol={p.key} name={p.name} large={large} />
      ))}
    </div>
  );
}

const meta = {
  title: "Design system/Patrol badges",
  parameters: {
    // Known violation: color-contrast on the Fálkar, Drótt and Aðrir badges —
    // their -foreground on the -500 base is under 4.5:1 (sc-600). PR #180
    // moves them to -600; once it is on main, drop this so the story fails on
    // any patrol pair that slips under AA again.
    a11y: { test: "todo" },
    docs: {
      description: {
        component:
          "The six patrol colours as badges: `.sl-bg-patrol-*` (base + `-foreground`), caption " +
          "and body size, with the text contrast measured in the current theme. AA asks 4.5:1 " +
          "for the caption badge. Picking a patrol in **Sveit** on the toolbar also swaps " +
          "`--sl-color-primary`; swatches and the hover/active ramps are on the Tokens page.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Caption: Story = { render: () => <Sheet /> };

export const Body: Story = { render: () => <Sheet large /> };
