import { describe, expect, it } from "vitest";

import {
  WORKERS,
  UPGRADES,
  costOf,
  thingstigFor,
  PRESTIGE_UNLOCK,
  decomposeToRings,
  RING_VALUES,
  workMult,
  clickMult,
  prestigeMult,
  baseRateOf,
  goldenMultiplier,
  GOLDEN_MULT,
  scoreParts,
  fmt,
} from "../gameData";

// These are the pure economy + formatting helpers the whole game balances on.
// If a refactor changes any of these numbers, the game silently breaks (wrong
// costs, wrong prestige payouts, wrong leaderboard scores) — these tests are the
// tripwire that catches it before production.

const thingfulltrui = WORKERS[0]; // baseCost 15, growth 1.15, out 0.1

// ── costOf ────────────────────────────────────────────────────────────────────
describe("costOf", () => {
  it("first unit of a worker equals its base cost", () => {
    expect(costOf(thingfulltrui, 0, 1)).toBe(15);
  });

  it("gets more expensive as you own more (geometric growth)", () => {
    expect(costOf(thingfulltrui, 1, 1)).toBe(18); // 15 * 1.15, rounded up
    expect(costOf(thingfulltrui, 10, 1)).toBe(61);
    expect(costOf(thingfulltrui, 5, 1)).toBeGreaterThan(costOf(thingfulltrui, 4, 1));
  });

  it("bulk buy is the closed-form sum of the ladder", () => {
    expect(costOf(thingfulltrui, 0, 5)).toBe(102);
  });

  it("bulk cost is at least the sum of its cheapest units", () => {
    const bulk = costOf(thingfulltrui, 0, 3);
    const first = costOf(thingfulltrui, 0, 1);
    expect(bulk).toBeGreaterThan(first * 3 - 3); // ~sum, allowing ceil rounding
    expect(bulk).toBeGreaterThanOrEqual(first);
  });

  it("returns a whole number (currency is integer fundarstig)", () => {
    expect(Number.isInteger(costOf(thingfulltrui, 7, 4))).toBe(true);
  });
});

// ── thingstigFor (prestige payout) ────────────────────────────────────────────
describe("thingstigFor", () => {
  it("pays nothing below the prestige unlock threshold", () => {
    expect(thingstigFor(0)).toBe(0);
    expect(thingstigFor(PRESTIGE_UNLOCK - 1)).toBe(0);
  });

  it("pays 10 Þingstig exactly at the unlock threshold", () => {
    expect(thingstigFor(PRESTIGE_UNLOCK)).toBe(10);
  });

  it("scales with the square root of lifetime fundarstig", () => {
    expect(thingstigFor(4 * PRESTIGE_UNLOCK)).toBe(20); // 2× sqrt
    expect(thingstigFor(9 * PRESTIGE_UNLOCK)).toBe(30); // 3× sqrt
  });

  it("is monotonically non-decreasing", () => {
    let prev = -1;
    for (const lifetime of [0, 1e7, 1e8, 5e8, 1e9, 1e12]) {
      const ts = thingstigFor(lifetime);
      expect(ts).toBeGreaterThanOrEqual(prev);
      prev = ts;
    }
  });

  it("always returns an integer", () => {
    expect(Number.isInteger(thingstigFor(3.3e8))).toBe(true);
  });
});

// ── decomposeToRings (orbit odometer) ─────────────────────────────────────────
describe("decomposeToRings", () => {
  it("no workers → no orbitals", () => {
    expect(decomposeToRings(0)).toEqual(RING_VALUES.map(() => 0));
  });

  it("places 1–4 on the innermost ring", () => {
    expect(decomposeToRings(4)[0]).toBe(4);
    expect(
      decomposeToRings(4)
        .slice(1)
        .every((n) => n === 0)
    ).toBe(true);
  });

  it("carries five inner orbitals up into one on the next ring", () => {
    expect(decomposeToRings(5)).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(decomposeToRings(6)).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("caps each ring at five icons regardless of count", () => {
    const rings = decomposeToRings(1_000_000);
    expect(rings.every((n) => n <= 5)).toBe(true);
  });

  it("reconstructs the count from ring place-values when uncapped", () => {
    // 6 = 1×5 + 1×1, and 6 is small enough that no ring hits its cap.
    const rings = decomposeToRings(6);
    const total = rings.reduce((s, n, r) => s + n * RING_VALUES[r], 0);
    expect(total).toBe(6);
  });
});

// ── upgrade multipliers ───────────────────────────────────────────────────────
describe("clickMult / workMult", () => {
  it("no upgrades → ×1", () => {
    const none = new Set<string>();
    expect(clickMult(none)).toBe(1);
    expect(workMult(none)).toBe(1);
  });

  it("click upgrades multiply together, ignoring work upgrades", () => {
    expect(clickMult(new Set(["ristabraud"]))).toBe(2);
    expect(clickMult(new Set(["ristabraud", "fundarhamar"]))).toBe(6); // 2 × 3
    expect(clickMult(new Set(["kaffi"]))).toBe(1); // work-only upgrade
  });

  it("work upgrades multiply worker output, ignoring click upgrades", () => {
    expect(workMult(new Set(["kaffi"]))).toBe(1.5);
    expect(workMult(new Set(["ristabraud", "fundarhamar"]))).toBe(1); // click-only
  });

  it("unknown keys have no effect", () => {
    expect(clickMult(new Set(["does-not-exist"]))).toBe(1);
  });
});

// ── prestigeMult ──────────────────────────────────────────────────────────────
describe("prestigeMult", () => {
  it("no Þingstig → ×1", () => {
    expect(prestigeMult(0)).toBe(1);
  });

  it("each point adds 0.5%", () => {
    expect(prestigeMult(100)).toBeCloseTo(1.5, 10);
    expect(prestigeMult(200)).toBeCloseTo(2, 10);
  });
});

// ── baseRateOf (passive production) ───────────────────────────────────────────
describe("baseRateOf", () => {
  const none = new Set<string>();

  it("no workers → zero rate", () => {
    expect(
      baseRateOf(
        WORKERS.map(() => 0),
        none,
        0
      )
    ).toBe(0);
  });

  it("one worker produces its listed output per second", () => {
    const counts = WORKERS.map((_, i) => (i === 0 ? 1 : 0));
    expect(baseRateOf(counts, none, 0)).toBeCloseTo(thingfulltrui.out, 10);
  });

  it("applies work upgrades and prestige multiplier on top", () => {
    const counts = WORKERS.map((_, i) => (i === 0 ? 1 : 0));
    // kaffi = ×1.5 work, tsCur 200 = ×2 prestige → 0.1 * 1.5 * 2 = 0.3
    expect(baseRateOf(counts, new Set(["kaffi"]), 200)).toBeCloseTo(0.3, 10);
  });

  it("tolerates a counts array shorter than the worker roster", () => {
    expect(baseRateOf([1], none, 0)).toBeCloseTo(thingfulltrui.out, 10);
  });
});

// ── goldenMultiplier (Fundarhiti buff) ────────────────────────────────────────
describe("goldenMultiplier", () => {
  it("boosts while the buff is still live", () => {
    expect(goldenMultiplier(1000, 500)).toBe(GOLDEN_MULT);
  });

  it("is 1 once the buff has expired (boundary is exclusive)", () => {
    expect(goldenMultiplier(1000, 1000)).toBe(1);
    expect(goldenMultiplier(1000, 1500)).toBe(1);
  });

  it("is 1 when no buff was ever set", () => {
    expect(goldenMultiplier(0, 12345)).toBe(1);
  });
});

// ── Icelandic long-scale formatting ───────────────────────────────────────────
describe("scoreParts", () => {
  it("small values render as plain fundarstig", () => {
    expect(scoreParts(500)).toMatchObject({ num: "500", suf: "", name: "fundarstig" });
  });

  it("thousands use the þ. suffix with comma decimals", () => {
    expect(scoreParts(1500)).toMatchObject({ num: "1,5", suf: "þ.", name: "þúsund" });
  });

  it("millions and billions pick the right long-scale name", () => {
    expect(scoreParts(2_000_000)).toMatchObject({ suf: "m.", name: "milljón" });
    expect(scoreParts(3_000_000_000)).toMatchObject({ suf: "ma.", name: "milljarður" });
    expect(scoreParts(1e12)).toMatchObject({ suf: "bilj.", name: "billjón" });
  });

  it("falls back to scientific notation past the named scales", () => {
    const parts = scoreParts(5e18);
    expect(parts.suf).toContain("·10");
    expect(parts.name).toBe("");
  });
});

describe("fmt", () => {
  it("formats small numbers plainly", () => {
    expect(fmt(500)).toBe("500");
  });

  it("uses compact long-scale suffixes with a space", () => {
    expect(fmt(1500)).toBe("1,5 þ.");
    expect(fmt(1_500_000)).toBe("1,5 m.");
  });

  it("covers every worker's base cost and output without throwing", () => {
    for (const w of WORKERS) {
      expect(typeof fmt(w.baseCost)).toBe("string");
      expect(typeof fmt(w.out)).toBe("string");
    }
    for (const u of UPGRADES) {
      expect(typeof fmt(u.cost)).toBe("string");
    }
  });
});
