import { describe, expect, it } from "vitest";

import {
  WORKERS,
  UPGRADES,
  CHAIRS,
  GOLDENS,
  costOf,
  thingstigFor,
  PRESTIGE_UNLOCK,
  decomposeToRings,
  RING_VALUES,
  workMult,
  clickMult,
  workerMult,
  clickShare,
  clickPower,
  prestigeMult,
  baseRateOf,
  upgradeUnlocked,
  upgradeEffect,
  liveBuff,
  buffFromGolden,
  lumpSeconds,
  pickGolden,
  goldenTuning,
  comboParams,
  comboMult,
  COMBO_BASE,
  NO_BUFF,
  WORKER_TIER_AT,
  DEFAULT_CHAIR,
  loadSave,
  signSave,
  offlineSeconds,
  OFFLINE_CAP_S,
  scoreParts,
  fmt,
  type SaveState,
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

  it("per-worker upgrades are not global work upgrades", () => {
    expect(workMult(new Set(["thingfulltrui-1"]))).toBe(1);
    expect(clickMult(new Set(["thingfulltrui-1"]))).toBe(1);
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

  it("applies a per-worker upgrade to that worker alone", () => {
    // One Þingfulltrúi and one Kosning; only the Þingfulltrúi tier-1 is owned.
    const counts = WORKERS.map((_, i) => (i <= 1 ? 1 : 0));
    const plain = baseRateOf(counts, none, 0);
    const boosted = baseRateOf(counts, new Set(["thingfulltrui-1"]), 0);
    expect(boosted - plain).toBeCloseTo(thingfulltrui.out, 10); // doubled, once
  });

  it("tolerates a counts array shorter than the worker roster", () => {
    expect(baseRateOf([1], none, 0)).toBeCloseTo(thingfulltrui.out, 10);
  });
});

// ── workerMult / clickShare ───────────────────────────────────────────────────
describe("workerMult", () => {
  it("is ×1 for a worker with no upgrades owned", () => {
    expect(workerMult("thingfulltrui", new Set())).toBe(1);
  });

  it("stacks both tiers of the same worker", () => {
    expect(workerMult("thingfulltrui", new Set(["thingfulltrui-1"]))).toBe(2);
    expect(workerMult("thingfulltrui", new Set(["thingfulltrui-1", "thingfulltrui-2"]))).toBe(4);
  });

  it("ignores upgrades belonging to a different worker", () => {
    expect(workerMult("kosning", new Set(["thingfulltrui-1"]))).toBe(1);
  });
});

describe("clickShare", () => {
  it("sums the owned share upgrades", () => {
    expect(clickShare(new Set())).toBe(0);
    expect(clickShare(new Set(["lesasalinn"]))).toBeCloseTo(0.01, 10);
    expect(clickShare(new Set(["lesasalinn", "klappa"]))).toBeCloseTo(0.06, 10);
  });
});

// ── clickPower ────────────────────────────────────────────────────────────────
describe("clickPower", () => {
  const none = new Set<string>();

  it("a bare click is worth exactly 1 fundarstig", () => {
    expect(clickPower(none, 0, 0, NO_BUFF)).toBe(1);
  });

  it("multiplies click upgrades, prestige and the combo together", () => {
    // ristabraud ×2, tsCur 200 → ×2 prestige, combo 10 at step 0.1 → ×2
    expect(clickPower(new Set(["ristabraud"]), 200, 0, NO_BUFF, 10, 0.1)).toBeCloseTo(8, 10);
  });

  it("adds the share of the passive rate on top of the tap", () => {
    // 1 tap + 1% of a 1000/sec rate
    expect(clickPower(new Set(["lesasalinn"]), 0, 1000, NO_BUFF)).toBeCloseTo(11, 10);
  });

  it("applies a buff's all and click multipliers to the tap only", () => {
    const buff = { ...NO_BUFF, until: 1, all: 7, click: 2 };
    expect(clickPower(none, 0, 500, buff)).toBeCloseTo(14, 10);
  });

  it("a buff's share skims the rate the way a share upgrade does", () => {
    const buff = { ...NO_BUFF, until: 1, share: 1 };
    expect(clickPower(none, 0, 500, buff)).toBeCloseTo(501, 10);
  });

  it("ignores the combo when the step is zero-length", () => {
    expect(clickPower(none, 0, 0, NO_BUFF, 50, 0)).toBe(1);
  });
});

// ── buffs ─────────────────────────────────────────────────────────────────────
describe("liveBuff", () => {
  const buff = { ...NO_BUFF, key: "x", until: 1000, all: 7 };

  it("returns the buff while it is still live", () => {
    expect(liveBuff(buff, 500).all).toBe(7);
  });

  it("collapses to neutral once expired (boundary is exclusive)", () => {
    expect(liveBuff(buff, 1000)).toBe(NO_BUFF);
    expect(liveBuff(buff, 1500)).toBe(NO_BUFF);
  });

  it("is neutral when no buff was ever set", () => {
    expect(liveBuff(NO_BUFF, 12345)).toBe(NO_BUFF);
  });
});

describe("buffFromGolden", () => {
  const fundarhiti = GOLDENS.find((g) => g.key === "fundarhiti")!;
  const lump = GOLDENS.find((g) => g.lump)!;

  it("carries the variant's multipliers through at power 1", () => {
    const b = buffFromGolden(fundarhiti, 0);
    expect(b.all).toBe(fundarhiti.all);
    expect(b.click).toBe(1);
    expect(b.until).toBe(fundarhiti.ms);
  });

  it("amplifies the bonus, not the whole multiplier", () => {
    // ×7 at power 1.5 means the +6 bonus becomes +9, i.e. ×10 — never ×10.5.
    expect(buffFromGolden(fundarhiti, 0, 1.5).all).toBeCloseTo(10, 10);
  });

  it("leaves untouched fields neutral even when amplified", () => {
    const b = buffFromGolden(fundarhiti, 0, 3, 2);
    expect(b.work).toBe(1);
    expect(b.share).toBe(0);
    expect(b.until).toBe(fundarhiti.ms * 2);
  });

  it("an instant variant grants no duration but pays a lump", () => {
    expect(buffFromGolden(lump, 500).until).toBe(500);
    expect(lumpSeconds(lump)).toBeGreaterThan(0);
    expect(lumpSeconds(lump, 2)).toBe(lumpSeconds(lump) * 2);
  });
});

// ── pickGolden ────────────────────────────────────────────────────────────────
describe("pickGolden", () => {
  it("returns the first variant at the bottom of the range", () => {
    expect(pickGolden(0).key).toBe(GOLDENS[0].key);
  });

  it("returns the last variant at the top of the range", () => {
    expect(pickGolden(1).key).toBe(GOLDENS[GOLDENS.length - 1].key);
  });

  it("clamps samples outside 0–1 instead of returning undefined", () => {
    expect(pickGolden(-5)).toBeDefined();
    expect(pickGolden(9)).toBeDefined();
  });

  it("covers every variant across the range", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pickGolden(i / 2000).key);
    expect(seen.size).toBe(GOLDENS.length);
  });

  it("luck makes the rarest variant more likely without excluding the common ones", () => {
    const share = (luck: number) => {
      let hits = 0;
      for (let i = 0; i < 5000; i++) if (pickGolden(i / 5000, luck).key === "skataandinn") hits++;
      return hits / 5000;
    };
    expect(share(1.8)).toBeGreaterThan(share(1));
    expect(share(1.8)).toBeLessThan(0.5);
  });
});

// ── ability tuning ────────────────────────────────────────────────────────────
describe("goldenTuning", () => {
  it("is all-neutral with no upgrades", () => {
    expect(goldenTuning(new Set())).toEqual({ dur: 1, power: 1, rate: 1, luck: 1 });
  });

  it("stacks the two spawn-rate upgrades multiplicatively", () => {
    // Below 1 means a shorter interval, i.e. goldens more often.
    expect(goldenTuning(new Set(["gljafagdur", "arnoralls"])).rate).toBeCloseTo(0.36, 10);
  });
});

describe("comboParams / comboMult", () => {
  it("falls back to the base tuning with no upgrades", () => {
    expect(comboParams(new Set())).toEqual(COMBO_BASE);
  });

  it("scales window, cap and step from the Aron upgrades", () => {
    const p = comboParams(new Set(["taktur", "haerrathak", "snarpari"]));
    expect(p.window).toBeCloseTo(COMBO_BASE.window * 1.8, 10);
    expect(p.cap).toBe(Math.round(COMBO_BASE.cap * 2.5));
    expect(p.step).toBeCloseTo(COMBO_BASE.step * 2, 10);
  });

  it("keeps the cap a whole number", () => {
    expect(Number.isInteger(comboParams(new Set(["haerrathak", "aroniham"])).cap)).toBe(true);
  });

  it("a zero combo is no bonus at all", () => {
    expect(comboMult(0, 0.1)).toBe(1);
    expect(comboMult(20, 0.1)).toBeCloseTo(3, 10);
  });
});

// ── upgradeUnlocked ───────────────────────────────────────────────────────────
describe("upgradeUnlocked", () => {
  const zero = WORKERS.map(() => 0);
  const ctx = (over: Partial<Parameters<typeof upgradeUnlocked>[1]> = {}) => ({
    counts: zero,
    lifetime: 0,
    things: 0,
    chair: "arnor",
    ...over,
  });
  const byKey = (k: string) => UPGRADES.find((u) => u.key === k)!;

  it("an upgrade with no requirement is always on offer", () => {
    expect(upgradeUnlocked(byKey("ristabraud"), ctx())).toBe(true);
  });

  it("a worker upgrade waits for that worker to be owned in quantity", () => {
    const u = byKey("thingfulltrui-1");
    expect(upgradeUnlocked(u, ctx())).toBe(false);
    const nearly = [...zero];
    nearly[0] = WORKER_TIER_AT[0] - 1;
    expect(upgradeUnlocked(u, ctx({ counts: nearly }))).toBe(false);
    const enough = [...zero];
    enough[0] = WORKER_TIER_AT[0];
    expect(upgradeUnlocked(u, ctx({ counts: enough }))).toBe(true);
  });

  it("a lifetime-gated upgrade waits for the run to produce enough", () => {
    const u = byKey("dagskrain");
    expect(upgradeUnlocked(u, ctx({ lifetime: 199_999 }))).toBe(false);
    expect(upgradeUnlocked(u, ctx({ lifetime: 200_000 }))).toBe(true);
  });

  it("a þing-gated upgrade waits for that many prestiges", () => {
    const u = byKey("thingforseti");
    expect(upgradeUnlocked(u, ctx())).toBe(false);
    expect(upgradeUnlocked(u, ctx({ things: 1 }))).toBe(true);
  });

  it("chair upgrades only show for the fundarstjóri currently chairing", () => {
    const arnor = byKey("gljafagdur");
    const aron = byKey("taktur");
    const rich = { lifetime: 1e9, things: 5 };
    expect(upgradeUnlocked(arnor, ctx({ ...rich, chair: "arnor" }))).toBe(true);
    expect(upgradeUnlocked(arnor, ctx({ ...rich, chair: "aron" }))).toBe(false);
    expect(upgradeUnlocked(aron, ctx({ ...rich, chair: "aron" }))).toBe(true);
    expect(upgradeUnlocked(aron, ctx({ ...rich, chair: "arnor" }))).toBe(false);
  });
});

// ── offline earnings (clock hardening) ────────────────────────────────────────
// The reported exploit: leave the game, wind the device clock forward, come
// back to a full offline payout. These pin the arithmetic that closes it.
describe("offlineSeconds", () => {
  const t0 = 1_700_000_000_000;

  it("pays for the time actually elapsed", () => {
    expect(offlineSeconds(t0, t0 + 60_000)).toBe(60);
  });

  it("caps a long absence", () => {
    expect(offlineSeconds(t0, t0 + 30 * 24 * 3600 * 1000)).toBe(OFFLINE_CAP_S);
  });

  it("pays nothing for a save stamped in the future", () => {
    // Device clock wound back, or `at` edited forward — either way, no payout.
    expect(offlineSeconds(t0 + 60_000, t0)).toBe(0);
    expect(offlineSeconds(t0, t0)).toBe(0);
  });

  it("pays nothing on nonsense timestamps", () => {
    expect(offlineSeconds(NaN, t0)).toBe(0);
    expect(offlineSeconds(t0, Infinity)).toBe(0);
  });

  it("is bounded no matter how far the clock is pushed", () => {
    // Winding the calendar forward a year buys the same 8 hours as a day would.
    const year = offlineSeconds(t0, t0 + 365 * 24 * 3600 * 1000);
    const day = offlineSeconds(t0, t0 + 24 * 3600 * 1000);
    expect(year).toBe(day);
    expect(year).toBe(OFFLINE_CAP_S);
  });
});

// ── save integrity ────────────────────────────────────────────────────────────
describe("loadSave", () => {
  const good = (over: Partial<SaveState> = {}): SaveState => ({
    v: 1,
    score: 500,
    run: 900,
    counts: WORKERS.map((_, i) => (i === 0 ? 3 : 0)),
    ups: ["ristabraud"],
    tsCur: 4,
    tsTot: 7,
    things: 1,
    at: 1_700_000_000_000,
    chairs: ["arnor", "aron"],
    chair: "aron",
    ...over,
  });
  const stored = (s: SaveState) => JSON.stringify({ ...s, sig: signSave(s) });

  it("round-trips a signed save and vouches for it", () => {
    const out = loadSave(stored(good()))!;
    expect(out.trusted).toBe(true);
    expect(out.save.score).toBe(500);
    expect(out.save.chair).toBe("aron");
    expect(out.save.ups).toEqual(["ristabraud"]);
  });

  it("returns nothing for absent, corrupt or foreign saves", () => {
    expect(loadSave(null)).toBeNull();
    expect(loadSave("not json")).toBeNull();
    expect(loadSave(JSON.stringify({ v: 99, score: 1 }))).toBeNull();
  });

  it("loads an edited save but refuses to vouch for it", () => {
    const s = good();
    const tampered = JSON.stringify({ ...s, sig: signSave(s), score: 1e12 });
    const out = loadSave(tampered)!;
    expect(out.trusted).toBe(false); // and so it earns no offline payout
    expect(out.save.score).toBe(1e12); // still playable, just not vouched for
  });

  it("treats an unsigned save as untrusted", () => {
    expect(loadSave(JSON.stringify(good()))!.trusted).toBe(false);
  });

  it("drops upgrade keys that no longer exist", () => {
    const out = loadSave(stored(good({ ups: ["ristabraud", "cheat-key", "kaffi"] })))!;
    expect(out.save.ups).toEqual(["ristabraud", "kaffi"]);
  });

  it("drops unknown chairs and always keeps the starting one", () => {
    const out = loadSave(stored(good({ chairs: ["ghost"], chair: "ghost" })))!;
    expect(out.save.chairs).toEqual([DEFAULT_CHAIR]);
    expect(out.save.chair).toBe(DEFAULT_CHAIR);
  });

  it("falls back to the starting chair when the active one isn't owned", () => {
    const out = loadSave(stored(good({ chairs: ["arnor"], chair: "aron" })))!;
    expect(out.save.chair).toBe(DEFAULT_CHAIR);
  });

  it("coerces broken numbers instead of letting NaN into the game", () => {
    const out = loadSave(
      stored(good({ score: NaN, run: -5, things: Infinity, tsTot: -3 } as Partial<SaveState>))
    )!;
    expect(out.save.score).toBe(0);
    expect(out.save.run).toBe(0);
    expect(out.save.things).toBe(0);
    expect(out.save.tsTot).toBe(0);
  });

  it("normalises the worker roster to the real length", () => {
    const out = loadSave(stored(good({ counts: [5, 5] })))!;
    expect(out.save.counts).toHaveLength(WORKERS.length);
    expect(out.save.counts[0]).toBe(5);
  });

  it("clamps impossible worker counts and negative ones", () => {
    const counts = WORKERS.map(() => 0);
    counts[0] = 1e12;
    counts[1] = -40;
    const out = loadSave(stored(good({ counts })))!;
    expect(out.save.counts[0]).toBeLessThanOrEqual(100_000);
    expect(out.save.counts[1]).toBe(0);
  });

  it("never lets unspent Þingstig exceed what was ever earned", () => {
    const out = loadSave(stored(good({ tsCur: 999, tsTot: 10 })))!;
    expect(out.save.tsCur).toBe(10);
  });

  it("never lets lifetime fall behind the bank it produced", () => {
    const out = loadSave(stored(good({ score: 900, run: 10 })))!;
    expect(out.save.run).toBe(900);
  });
});

describe("signSave", () => {
  const base: SaveState = {
    v: 1,
    score: 1,
    run: 1,
    counts: WORKERS.map(() => 0),
    ups: [],
    tsCur: 0,
    tsTot: 0,
    things: 0,
    at: 0,
    chairs: ["arnor"],
    chair: "arnor",
  };

  it("is stable for the same contents", () => {
    expect(signSave(base)).toBe(signSave({ ...base }));
  });

  it("does not depend on the order upgrades or chairs were stored in", () => {
    const a = { ...base, ups: ["kaffi", "ristabraud"], chairs: ["aron", "arnor"] };
    const b = { ...base, ups: ["ristabraud", "kaffi"], chairs: ["arnor", "aron"] };
    expect(signSave(a)).toBe(signSave(b));
  });

  it("changes when any meaningful field changes", () => {
    const sig = signSave(base);
    expect(signSave({ ...base, score: 2 })).not.toBe(sig);
    expect(signSave({ ...base, tsTot: 1 })).not.toBe(sig);
    expect(signSave({ ...base, at: 1 })).not.toBe(sig);
    expect(signSave({ ...base, chair: "aron" })).not.toBe(sig);
  });
});

// ── content invariants ────────────────────────────────────────────────────────
// The shop is content-heavy; these catch a copy-paste slip in the data tables
// (duplicate key silently shadowing an upgrade, a boost pointing at nothing).
describe("upgrade + chair data", () => {
  it("every upgrade key is unique", () => {
    expect(new Set(UPGRADES.map((u) => u.key)).size).toBe(UPGRADES.length);
  });

  it("every worker gets both of its tiers", () => {
    for (const w of WORKERS) {
      const mine = UPGRADES.filter((u) => u.boosts === w.key);
      expect(mine, w.key).toHaveLength(WORKER_TIER_AT.length);
    }
  });

  it("every boost points at a real worker and carries a multiplier", () => {
    for (const u of UPGRADES.filter((x) => x.boosts)) {
      expect(
        WORKERS.some((w) => w.key === u.boosts),
        u.key
      ).toBe(true);
      expect(u.by, u.key).toBeGreaterThan(1);
    }
  });

  it("every upgrade describes an effect", () => {
    for (const u of UPGRADES) expect(upgradeEffect(u), u.key).not.toBe("");
  });

  it("every chair-gated upgrade names a chair that exists", () => {
    for (const u of UPGRADES.filter((x) => x.req?.chair)) {
      expect(
        CHAIRS.some((c) => c.key === u.req!.chair),
        u.key
      ).toBe(true);
    }
  });

  it("both fundarstjórar have an ability, and the starting one is free", () => {
    expect(CHAIRS[0].cost).toBe(0);
    for (const c of CHAIRS) expect(c.ability, c.key).toBeTruthy();
  });

  it("every fundarstjóri carries copy and a real portrait size", () => {
    for (const c of CHAIRS) {
      expect(c.flavour, c.key).not.toBe("");
      expect(c.desc, c.key).not.toBe("");
      expect(c.w, c.key).toBeGreaterThan(0);
      expect(c.h, c.key).toBeGreaterThan(0);
    }
  });

  it("golden variants are unique and each does something", () => {
    expect(new Set(GOLDENS.map((g) => g.key)).size).toBe(GOLDENS.length);
    expect(GOLDENS).toHaveLength(7);
    for (const g of GOLDENS) {
      const acts = g.all || g.click || g.work || g.share || g.lump;
      expect(acts, g.key).toBeTruthy();
      expect(g.weight, g.key).toBeGreaterThan(0);
      // A buff needs a duration; an instant payout must not have one.
      expect(g.ms > 0, g.key).toBe(!g.lump);
    }
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
