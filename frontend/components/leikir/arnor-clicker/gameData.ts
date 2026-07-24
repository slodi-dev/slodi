// Arnór-Clicker game data & pure helpers — economy, Icelandic number formatting,
// the orbit "odometer" decomposition, and the Þingstig prestige formula.
// Numbers per docs/design/arnor-clicker/SPEC.md §9. All functions are pure.

import type { CSSProperties } from "react";
import type { IconKey } from "./icons";

/** Inline-style object that also carries CSS custom properties (`--foo`). */
export type Vars = CSSProperties & Record<string, string>;

/** Fundarhiti boost: a golden Arnór multiplies click + passive output by this. */
export const GOLDEN_MULT = 7;
/** The active boost multiplier: GOLDEN_MULT while the buff is live, else 1. */
export function goldenMultiplier(goldenUntil: number, now: number): number {
  return now < goldenUntil ? GOLDEN_MULT : 1;
}

export interface Worker {
  key: string;
  name: string;
  icon: IconKey;
  /** CSS colour expression for the token background (a Slóði token). */
  color: string;
  /** Icon stroke colour (ink or white) for AAA contrast on the token. */
  fg: string;
  baseCost: number;
  growth: number;
  /** fundarstig per second, per one owned. */
  out: number;
}

const INK = "hsl(var(--sl-color-text-inverse))";

// Ordered ladder (Fundarsköp) — the 20-worker Skátaþing progression, grounded in
// the BÍS bylaws: meeting atoms → the machinery → the five permanent councils →
// Skátaandinn. Each has a distinct hue in one tonal band; dark icon strokes on
// the yellows/golds, white on the rest.
export const WORKERS: Worker[] = [
  {
    key: "thingfulltrui",
    name: "Þingfulltrúi",
    icon: "user",
    color: "hsl(150 48% 40%)",
    fg: INK,
    baseCost: 15,
    growth: 1.15,
    out: 0.1,
  },
  {
    key: "kosning",
    name: "Kosning",
    icon: "hand",
    color: "hsl(175 52% 40%)",
    fg: INK,
    baseCost: 100,
    growth: 1.15,
    out: 1,
  },
  {
    key: "kaffipasa",
    name: "Kaffipása",
    icon: "coffee",
    color: "hsl(25 50% 44%)",
    fg: INK,
    baseCost: 1_100,
    growth: 1.15,
    out: 8,
  },
  {
    key: "umraeduhopar",
    name: "Umræðuhópar",
    icon: "chat",
    color: "hsl(42 68% 48%)",
    fg: "currentColor",
    baseCost: 12_000,
    growth: 1.14,
    out: 47,
  },
  {
    key: "lagabreytingartillaga",
    name: "Lagabreytingartillaga",
    icon: "scroll",
    color: "hsl(78 45% 43%)",
    fg: INK,
    baseCost: 130_000,
    growth: 1.13,
    out: 260,
  },
  {
    key: "rifrildi",
    name: "Rifrildi í pontu",
    icon: "mega",
    color: "hsl(6 70% 52%)",
    fg: INK,
    baseCost: 1_400_000,
    growth: 1.12,
    out: 1_400,
  },
  {
    key: "ritari",
    name: "Ritari",
    icon: "pen",
    color: "hsl(212 42% 46%)",
    fg: INK,
    baseCost: 20_000_000,
    growth: 1.11,
    out: 7_800,
  },
  {
    key: "kjornefnd",
    name: "Kjörnefnd",
    icon: "clipboard",
    color: "hsl(192 58% 45%)",
    fg: INK,
    baseCost: 260_000_000,
    growth: 1.1,
    out: 44_000,
  },
  {
    key: "fjarmal",
    name: "Fjármálaumræður",
    icon: "coins",
    color: "hsl(46 78% 48%)",
    fg: "currentColor",
    baseCost: 3_300_000_000,
    growth: 1.1,
    out: 260_000,
  },
  {
    key: "arsskyrsla",
    name: "Ársskýrsla stjórnar",
    icon: "file",
    color: "hsl(224 50% 50%)",
    fg: INK,
    baseCost: 45_000_000_000,
    growth: 1.09,
    out: 1_600_000,
  },
  {
    key: "allsherjar",
    name: "Allsherjarnefnd",
    icon: "users",
    color: "hsl(248 42% 52%)",
    fg: INK,
    baseCost: 600_000_000_000,
    growth: 1.09,
    out: 9_500_000,
  },
  {
    key: "uppstillingarnefnd",
    name: "Uppstillingarnefnd",
    icon: "userCheck",
    color: "hsl(280 44% 52%)",
    fg: INK,
    baseCost: 8_000_000_000_000,
    growth: 1.08,
    out: 62_000_000,
  },
  {
    key: "taeknilegir",
    name: "Tæknilegir örðugleikar",
    icon: "alert",
    color: "hsl(354 72% 55%)",
    fg: INK,
    baseCost: 110_000_000_000_000,
    growth: 1.08,
    out: 430_000_000,
  },
  {
    key: "onnurmal",
    name: "Önnur mál",
    icon: "list",
    color: "hsl(316 40% 50%)",
    fg: INK,
    baseCost: 1_500_000_000_000_000,
    growth: 1.08,
    out: 2_800_000_000,
  },
  {
    key: "utilifsrad",
    name: "Útilífsráð",
    icon: "tent",
    color: "hsl(158 52% 34%)",
    fg: INK,
    baseCost: 21_000_000_000_000_000,
    growth: 1.07,
    out: 18_000_000_000,
  },
  {
    key: "ungmennarad",
    name: "Ungmennaráð",
    icon: "flag",
    color: "hsl(182 62% 42%)",
    fg: INK,
    baseCost: 3.0e17,
    growth: 1.07,
    out: 130_000_000_000,
  },
  {
    key: "althjodarad",
    name: "Alþjóðaráð",
    icon: "globe",
    color: "hsl(205 66% 48%)",
    fg: INK,
    baseCost: 4.2e18,
    growth: 1.07,
    out: 900_000_000_000,
  },
  {
    key: "starfsrad",
    name: "Starfsráð",
    icon: "cog",
    color: "hsl(232 46% 52%)",
    fg: INK,
    baseCost: 6.0e19,
    growth: 1.07,
    out: 6.5e12,
  },
  {
    key: "skataskolinn",
    name: "Skátaskólinn",
    icon: "book",
    color: "hsl(262 50% 55%)",
    fg: INK,
    baseCost: 8.5e20,
    growth: 1.07,
    out: 4.8e13,
  },
  {
    key: "skataandinn",
    name: "Skátaandinn",
    icon: "sparkles",
    color: "hsl(43 95% 55%)",
    fg: "currentColor",
    baseCost: 1.2e22,
    growth: 1.07,
    out: 3.8e14,
  },
];

export interface Upgrade {
  key: string;
  name: string;
  desc: string;
  cost: number;
  /** Multiply click power. */
  click?: number;
  /** Multiply all worker output. */
  work?: number;
}

export const UPGRADES: Upgrade[] = [
  {
    key: "ristabraud",
    name: "Ristabrauð handa Arnóri",
    desc: "Tvöfaldar smellikraft Arnórs.",
    cost: 500,
    click: 2,
  },
  {
    key: "fundarhamar",
    name: "Nýr fundarhamar",
    desc: "Þrefaldar smellikraft.",
    cost: 25_000,
    click: 3,
  },
  {
    key: "kaffi",
    name: "Kaffi á könnunni",
    desc: "+50% á öll fundarsköp.",
    cost: 60_000,
    work: 1.5,
  },
];

// ── Economy ────────────────────────────────────────────────────────────────
/** Closed-form cost of buying `qty` more of a worker currently owned `owned`. */
export function costOf(w: Worker, owned: number, qty: number): number {
  const g = w.growth;
  return Math.ceil((w.baseCost * Math.pow(g, owned) * (Math.pow(g, qty) - 1)) / (g - 1));
}

// ── Prestige (Þingstig) ──────────────────────────────────────────────────────
// Tuned so you grab a satisfying first haul early — first prestige ~tier 7–8
// yields ~10 Þingstig — then it gets harder and harder: on a √ curve each extra
// point needs quadratically more lifetime (the P-th point costs ∝ P). Þingstig
// reaches the 999,999 leaderboard cap around tier ~17, so the top few tiers are
// pure multiplier flex.
export const PRESTIGE_UNLOCK = 1e8;
const K = 10;
const SCALE = 1e8;
/** Þingstig you would earn for a run that produced `lifetime` fundarstig. */
export function thingstigFor(lifetime: number): number {
  if (lifetime < PRESTIGE_UNLOCK) return 0;
  return Math.floor(K * Math.sqrt(lifetime / SCALE));
}
/** Each Þingstig gives +0.5% to everything (compounds across prestiges). */
export const PRESTIGE_MULT_PER_POINT = 0.005;

// ── Live multipliers (pure) ──────────────────────────────────────────────────
/** Product of all owned work-multiplier upgrades (×1 if none). */
export const workMult = (ups: Set<string>) =>
  UPGRADES.reduce((m, u) => (u.work && ups.has(u.key) ? m * u.work : m), 1);
/** Product of all owned click-multiplier upgrades (×1 if none). */
export const clickMult = (ups: Set<string>) =>
  UPGRADES.reduce((m, u) => (u.click && ups.has(u.key) ? m * u.click : m), 1);
/** Permanent prestige multiplier from current Þingstig. */
export const prestigeMult = (tsCur: number) => 1 + PRESTIGE_MULT_PER_POINT * tsCur;
/** Passive fundarstig/sec from owned workers, with upgrade + prestige multipliers. */
export const baseRateOf = (counts: number[], ups: Set<string>, tsCur: number) =>
  WORKERS.reduce((s, w, i) => s + w.out * (counts[i] ?? 0), 0) *
  workMult(ups) *
  prestigeMult(tsCur);

// ── Orbit odometer ───────────────────────────────────────────────────────────
// Base-5 place-value ring ladder: five orbitals on a ring combine into one on
// the next ring up (1s → 5s → 25s → 125s → …). One icon on ring r therefore
// stands for RING_VALUES[r] workers, and each ring shows at most four icons
// before the fifth carries up.
export const RING_VALUES = [1, 5, 25, 125, 625, 3125, 15625, 78125];
const RING_ICON_CAP = 5;

/**
 * Greedy odometer decomposition: how many icons of a worker appear on each ring,
 * given `count` owned. Inner rings fill fast; outer rings each stand for many.
 */
export function decomposeToRings(count: number): number[] {
  const out = new Array(RING_VALUES.length).fill(0);
  let rem = count;
  for (let r = RING_VALUES.length - 1; r >= 0; r--) {
    const n = Math.floor(rem / RING_VALUES[r]);
    if (n > 0) {
      out[r] = Math.min(n, RING_ICON_CAP);
      rem -= n * RING_VALUES[r];
    }
  }
  return out;
}

// ── Icelandic long-scale formatting ─────────────────────────────────────────
// billjón = 10^12 (long scale). Comma decimals, 3 sig figs, then scientific.
const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};
function superscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUP[d] ?? d)
    .join("");
}

interface Scale {
  min: number;
  suf: string;
  name: string;
}
const SCALES: Scale[] = [
  { min: 1e15, suf: "bilja.", name: "billjarður" },
  { min: 1e12, suf: "bilj.", name: "billjón" },
  { min: 1e9, suf: "ma.", name: "milljarður" },
  { min: 1e6, suf: "m.", name: "milljón" },
  { min: 1e3, suf: "þ.", name: "þúsund" },
];

export interface ScoreParts {
  num: string;
  suf: string;
  name: string;
  pow: string;
}

function isNum(n: number, max = 2): string {
  return n.toLocaleString("is-IS", { maximumFractionDigits: max });
}

/** Structured score for the readout plate (number, suffix, long-scale name). */
export function scoreParts(v: number): ScoreParts {
  if (v >= 1e18) {
    const e = Math.floor(Math.log10(v));
    return { num: isNum(v / Math.pow(10, e)), suf: `·10${superscript(e)}`, name: "", pow: "" };
  }
  for (const s of SCALES) {
    if (v >= s.min)
      return {
        num: isNum(v / s.min),
        suf: s.suf,
        name: s.name,
        pow: `10${superscript(Math.log10(s.min))}`,
      };
  }
  return { num: isNum(Math.floor(v), 0), suf: "", name: "fundarstig", pow: "" };
}

/** Compact one-line format, e.g. "1,24 m." — for rates, costs, worker output. */
export function fmt(v: number): string {
  if (v >= 1e18) {
    const e = Math.floor(Math.log10(v));
    return `${isNum(v / Math.pow(10, e))}·10${superscript(e)}`;
  }
  for (const s of SCALES) {
    if (v >= s.min) return `${isNum(v / s.min)} ${s.suf}`;
  }
  return isNum(v, v < 10 ? 1 : 0);
}
