// Arnór-Clicker game data & pure helpers — economy, Icelandic number formatting,
// the orbit "odometer" decomposition, and the Þingstig prestige formula.
// Numbers per docs/design/arnor-clicker/SPEC.md §9. All functions are pure.

import type { CSSProperties } from "react";
import type { IconKey } from "./icons";

/** Inline-style object that also carries CSS custom properties (`--foo`). */
export type Vars = CSSProperties & Record<string, string>;

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

// ── Economy ────────────────────────────────────────────────────────────────
// Declared before UPGRADES on purpose: the worker-upgrade prices are derived
// from costOf while the module initialises. It survives as a hoisted function
// declaration today, but moving it below — or rewriting it as a const arrow —
// would break module init with a temporal-dead-zone error.
/** Closed-form cost of buying `qty` more of a worker currently owned `owned`. */
export function costOf(w: Worker, owned: number, qty: number): number {
  const g = w.growth;
  return Math.ceil((w.baseCost * Math.pow(g, owned) * (Math.pow(g, qty) - 1)) / (g - 1));
}

// ── Fundarstjórar ────────────────────────────────────────────────────────────
// The player picks who chairs the þing. Each chair brings one ability, bought
// once with Þingstig and kept forever (switching between owned chairs is free).
// Paying in Þingstig is a real trade: every point spent is 0.5% permanent boost
// given up. Chair-specific upgrades live in UPGRADES behind `req.chair`.

export type ChairAbility = "golden" | "combo";

export interface Chair {
  key: string;
  name: string;
  /** Line under the name on the Þing tab. */
  title: string;
  /** In-character line: who this fundarstjóri is at the þing. */
  flavour: string;
  /** What the ability actually does, mechanically. */
  desc: string;
  /** Price in Þingstig. Arnór is free — he is who you start with. */
  cost: number;
  /** Portrait. Falls back to Arnór's, tinted with `hue`, if the file is absent. */
  img: string;
  /** The portrait's intrinsic pixel size — next/image needs the real aspect. */
  w: number;
  h: number;
  /** Hue-rotate applied to the fallback portrait, in degrees. */
  hue: number;
  /** Accent colour for the chair card and ability chrome. */
  color: string;
  ability: ChairAbility;
}

export const CHAIRS: Chair[] = [
  {
    key: "arnor",
    name: "Arnór",
    title: "Gullnir Arnórar",
    flavour:
      "Arnór er snöggur með gullmolana upp í pontu, þeir hjálpa við að halda fundinum gangandi.",
    desc: "Gullnir Arnórar skjótast yfir þingsalinn. Smelltu á þá fyrir eina af sjö uppörvunum — sumar sjaldgæfari en aðrar.",
    cost: 0,
    img: "/leikir/arnor-clicker/arnor.png",
    w: 480,
    h: 607,
    hue: 0,
    color: "hsl(44 95% 52%)",
    ability: "golden",
  },
  {
    key: "aron",
    name: "Aron",
    title: "Samfella",
    flavour: "Aron vill afgreiða sem flest í einu, þannig að fundurinn flýgur áfram í settum.",
    desc: "Hraðir smellir hlaða upp samfellu sem margfaldar smellikraftinn. Hættu að smella og hún fellur niður.",
    cost: 50,
    img: "/leikir/arnor-clicker/aron.png",
    w: 274,
    h: 392,
    hue: 165,
    color: "hsl(205 66% 48%)",
    ability: "combo",
  },
];

export const DEFAULT_CHAIR = CHAIRS[0].key;
export const chairByKey = (key: string): Chair => CHAIRS.find((c) => c.key === key) ?? CHAIRS[0];

// ── Gullnir Arnórar ──────────────────────────────────────────────────────────
// Seven variants, drawn by weight. `tier` is the rarity band: "Heppnir Arnórar"
// raises the odds of the higher tiers without ever removing the common ones.

export interface GoldenVariant {
  key: string;
  name: string;
  /** Spawn share within its tier, before the luck multiplier. */
  weight: number;
  /** Rarity band, 0 = common. Effective weight is `weight × luck^tier`. */
  tier: number;
  /** Sprite hue-rotate, degrees off the gold base. */
  hue: number;
  /** Buff duration in ms. 0 means it pays out instantly instead. */
  ms: number;
  /** Multiplies everything — passive and clicks alike. */
  all?: number;
  /** Multiplies click power only. */
  click?: number;
  /** Multiplies worker output only. */
  work?: number;
  /** Clicks additionally earn this fraction of the current fundarstig/sek. */
  share?: number;
  /** Instant payout, in seconds of current production. */
  lump?: number;
}

export const GOLDENS: GoldenVariant[] = [
  {
    key: "fundarhiti",
    name: "Fundarhiti",
    weight: 30,
    tier: 0,
    hue: 0,
    ms: 9_000,
    all: 7,
  },
  {
    key: "kaffiskot",
    name: "Kaffiskot",
    weight: 22,
    tier: 0,
    hue: -22,
    ms: 20_000,
    click: 15,
  },
  {
    key: "dagskrarlidur",
    name: "Dagskrárliður afgreiddur",
    weight: 16,
    tier: 0,
    hue: 78,
    ms: 0,
    lump: 420,
  },
  {
    key: "samhljoda",
    name: "Samhljóða samþykkt",
    weight: 12,
    tier: 1,
    hue: 118,
    ms: 6_000,
    all: 20,
  },
  {
    key: "kjorbref",
    name: "Kjörbréfin komin",
    weight: 9,
    tier: 1,
    hue: 168,
    ms: 30_000,
    work: 3,
  },
  {
    key: "hradafgreidsla",
    name: "Hraðafgreiðsla",
    weight: 7,
    tier: 1,
    hue: -70,
    ms: 15_000,
    click: 2,
    share: 1,
  },
  {
    key: "skataandinn",
    name: "Skátaandinn",
    weight: 4,
    tier: 2,
    hue: 285,
    ms: 7_000,
    all: 77,
  },
];

/** Base seconds between golden spawn attempts (a window, not a fixed beat). */
export const GOLDEN_EVERY_MIN_S = 180;
export const GOLDEN_EVERY_MAX_S = 300;
/** How long a golden stays on screen before it drifts off. */
export const GOLDEN_ON_SCREEN_MS = 9_000;

/**
 * Draw a variant. `r` is a uniform 0–1 sample; `luck` (≥1) tilts the draw
 * toward the rarer tiers — each tier's weight is scaled by `luck^tier`.
 */
export function pickGolden(r: number, luck = 1): GoldenVariant {
  const weights = GOLDENS.map((g) => g.weight * Math.pow(luck, g.tier));
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  const target = Math.min(Math.max(r, 0), 0.999999) * total;
  for (let i = 0; i < GOLDENS.length; i++) {
    acc += weights[i];
    if (target < acc) return GOLDENS[i];
  }
  return GOLDENS[GOLDENS.length - 1];
}

// ── Active buff ──────────────────────────────────────────────────────────────
/** A live boost. Neutral values are 1 (multipliers) and 0 (share). */
export interface Buff {
  key: string;
  name: string;
  /** Epoch ms at which the buff stops applying. */
  until: number;
  all: number;
  click: number;
  work: number;
  share: number;
}

export const NO_BUFF: Buff = { key: "", name: "", until: 0, all: 1, click: 1, work: 1, share: 0 };

/** The buff as it applies right now — neutral once it has expired. */
export function liveBuff(b: Buff, now: number): Buff {
  return now < b.until ? b : NO_BUFF;
}

/**
 * Resolve a golden variant into a buff, with the Arnór upgrades applied.
 * `power` scales the multipliers, `dur` the duration. A variant with `ms: 0`
 * grants no buff — the caller pays out `lumpSeconds` instead.
 */
export function buffFromGolden(v: GoldenVariant, now: number, power = 1, dur = 1): Buff {
  const amp = (m: number | undefined) => (m === undefined ? 1 : 1 + (m - 1) * power);
  return {
    key: v.key,
    name: v.name,
    until: now + v.ms * dur,
    all: amp(v.all),
    click: amp(v.click),
    work: amp(v.work),
    share: (v.share ?? 0) * power,
  };
}

/** Seconds of production a variant instantly pays out (0 if it is a buff). */
export const lumpSeconds = (v: GoldenVariant, power = 1) => (v.lump ?? 0) * power;

// ── Samfella (Aron's combo) ──────────────────────────────────────────────────
// Tuned against Arnór, who is the yardstick: his goldens are worth roughly
// +50% of passive production at base and around +490% fully upgraded, paid out
// in bursts you have to be present to catch.
//
// Aron has to land in the same band by a different route — sustained clicking
// rather than caught bursts — so the combo tops out near ×2 at base and ×4
// fully upgraded. It used to reach ×41, which was both far past Arnór and
// beside the point, because the multiplier only touched the flat tap and so
// counted for nothing once passive production ran away. It now multiplies the
// whole click, including the share-of-rate the "share" upgrades grant, which
// is what keeps it meaningful at every stage.
//
// Cookie Clicker's mid-game benchmark — a click worth ~10–13% of CpS — is the
// sanity check: at ~6 clicks/sec with the full share stack, Aron lands close to
// Arnór's fully-upgraded uplift rather than dwarfing it.
export const COMBO_BASE = { window: 1_400, cap: 20, step: 0.05 };

export interface ComboParams {
  /** Max ms between clicks before the combo drops. */
  window: number;
  /** Highest combo reachable. */
  cap: number;
  /** Click-power bonus per combo step. */
  step: number;
}

/** Click power multiplier from the current combo. */
export const comboMult = (combo: number, step: number) => 1 + combo * step;

export interface Upgrade {
  key: string;
  name: string;
  desc: string;
  cost: number;
  icon: IconKey;
  /** Multiply click power. */
  click?: number;
  /** Multiply every worker's output. */
  work?: number;
  /** Multiply one worker's output — the worker's `key`. */
  boosts?: string;
  /** Multiplier applied to `boosts`. */
  by?: number;
  /** Each click also earns this fraction of the current fundarstig/sek. */
  share?: number;
  /** Gullnir Arnórar: duration, power, spawn frequency, rarity odds. */
  goldenDur?: number;
  goldenPower?: number;
  /** Multiplies the spawn interval — below 1 means goldens come more often. */
  goldenRate?: number;
  goldenLuck?: number;
  /** Samfella: how forgiving, how high, how steep. */
  comboWindow?: number;
  comboCap?: number;
  comboStep?: number;
  /** What has to be true before the card appears in the shop. */
  req?: UpgradeReq;
}

export interface UpgradeReq {
  /** Requires this many of `worker` owned. */
  worker?: string;
  owned?: number;
  /**
   * Requires this many fundarsköp owned in total, of any kind.
   *
   * Anything that multiplies worker output — the global `work` upgrades and
   * the `share` ones that skim a fraction of the rate — is worthless without
   * workers to multiply. Gating on a real workforce keeps them off the shelf
   * until they can actually do something.
   */
  totalWorkers?: number;
  /** Requires this much lifetime fundarstig in the current run. */
  lifetime?: number;
  /** Requires this many completed þing (prestiges). */
  things?: number;
  /** Requires this fundarstjóri to be the one chairing right now. */
  chair?: string;
}

// Two tiers per worker, unlocked at 10 and 50 owned, each doubling that
// worker's output. Names are grounded in how a Skátaþing actually runs —
// kjörbréf, nefndarálit, fundarsköp, the fastaráð and their year's work.
const WORKER_UPGRADE_TIERS: Record<string, [string, string][]> = {
  thingfulltrui: [
    ["Kjörbréfin yfirfarin", "Kjörnefnd staðfestir umboðin og allir fá að greiða atkvæði."],
    ["Rúta norður á Akureyri", "Sameiginleg ferð á þingið — enginn mætir of seint."],
  ],
  kosning: [
    ["Rafræn atkvæðagreiðsla", "Enginn þarf lengur að telja seðla í höndunum."],
    ["Handauppréttingar æfðar", "Salurinn kann handbragðið orðið utanbókar."],
  ],
  kaffipasa: [
    ["Kleinur með kaffinu", "Þingheimur mætir hressari úr hléinu."],
    ["Endalaus kanna", "Kaffið klárast aldrei, sama hvað líður á daginn."],
  ],
  umraeduhopar: [
    ["Flettitafla og tússpennar", "Hugmyndirnar rata loksins á blað."],
    ["Hópstjóri í hverjum hóp", "Umræðan heldur sér við dagskrárliðinn."],
  ],
  lagabreytingartillaga: [
    ["Tillögur sendar tímanlega", "Skilafresturinn virtur — 20. febrúar kl. 20:30."],
    ["Tveir þriðju á hreinu", "Aukinn meirihluti tryggður fyrir lagabreytingunni."],
  ],
  rifrildi: [
    ["Ræðutími styttur í tvær mínútur", "Fundarstjóri heldur salnum á tánum."],
    ["Bjallan á borði fundarstjóra", "Eitt högg og pontan þagnar."],
  ],
  ritari: [
    ["Fundargerð í rauntíma", "Ekkert glatast á milli dagskrárliða."],
    ["Tveir ritarar á vakt", "Annar skrifar á meðan hinn hvílir fingurna."],
  ],
  kjornefnd: [
    ["Kjörseðlar taldir tvisvar", "Enginn vafi um niðurstöðuna."],
    ["Kjörgögn frá öllum félögunum", "Fimmtán skátafélög, öll með sín umboð í lagi."],
  ],
  fjarmal: [
    ["Ársreikningar samþykktir", "Skoðunarmaður reikninga gaf grænt ljós."],
    ["Gjaldkeri með glærur", "Súluritin gera töluna loksins skiljanlega."],
  ],
  arsskyrsla: [
    ["Myndir í ársskýrslunni", "Enginn sofnar undir myndasýningunni."],
    ["Skátahöfðingi flytur skýrsluna", "Flutningurinn heldur salnum vakandi."],
  ],
  allsherjar: [
    ["Nefndarálit sent út fyrirfram", "Þingheimur mætir lesinn í málið."],
    ["Afgreiðslunefnd að störfum", "Málin ganga hraðar gegnum þingið."],
  ],
  uppstillingarnefnd: [
    ["Fimm manna nefnd fullskipuð", "Uppstillingarnefndin er komin með fulla áhöfn."],
    ["Frambjóðendur kynna sig", "Öll embætti fá loksins mótframboð."],
  ],
  taeknilegir: [
    ["Varaskjávarpi í salnum", "Þegar sá fyrri gefst upp tekur hinn við."],
    ["Tæknimaður á staðnum", "Snúran finnst áður en nokkur tekur eftir."],
  ],
  onnurmal: [
    ["Fundarhlé tekið", "Fimm mínútur og allir koma endurnærðir."],
    ["Dagskrárliður framlengdur", "Það kemst allt að, líka önnur mál."],
  ],
  utilifsrad: [
    ["Útilegan á Úlfljótsvatni", "Ráðið sannar að útilífið byrjar heima."],
    ["Prímusar og bakpokar yfirfarnir", "Búnaðurinn klár fyrir næsta útilegusumar."],
  ],
  ungmennarad: [
    ["Ungmennaþing haldið", "Rödd 25 ára og yngri kemst á dagskrá."],
    ["Fulltrúar á þátttökualdri", "Tuttugu og sjö ungir fulltrúar með atkvæðisrétt."],
  ],
  althjodarad: [
    ["Jamboree-hópur skráður", "Íslenskir skátar á leið út í heim."],
    ["Fulltrúar á heimsþingi WOSM", "Ísland fær sæti við borðið."],
  ],
  starfsrad: [
    ["Dagskrárvefurinn 2.0", "Slóði kemur dagskránni til allra foringja."],
    ["Starfsáætlun 2026–2030", "Fimm ára stefna samþykkt á þinginu."],
  ],
  skataskolinn: [
    ["Gilwell-námskeið haldið", "Foringjar snúa aftur með viðarbútana."],
    ["Foringjaþjálfun um land allt", "Námskeið í hverjum landsfjórðungi."],
  ],
  skataandinn: [
    ["Skátaheitið endurtekið", "Salurinn stendur upp og fer með heitið."],
    ["Ávallt viðbúin", "Kjörorðið á sínum stað — hvað sem dagskráin býður."],
  ],
};

/** Owned counts at which each worker's two upgrades unlock. */
export const WORKER_TIER_AT = [10, 50];
/**
 * Each tier costs this fraction of what its required workers cost to buy from
 * scratch. Pricing off the requirement rather than off `baseCost` is what keeps
 * the ladder consistent: worker growth runs from 1.15 down to 1.07, so a flat
 * multiple of `baseCost` made the early tiers nearly free (7% of the workers
 * they needed) while the late ones cost more than the workers themselves.
 */
const WORKER_TIER_PRICE = [0.5, 0.5];
/** Output multiplier granted by each tier. */
const WORKER_TIER_MULT = [2, 2];

const workerUpgrades = (): Upgrade[] =>
  WORKERS.flatMap((w) =>
    (WORKER_UPGRADE_TIERS[w.key] ?? []).map(([name, desc], t) => ({
      key: `${w.key}-${t + 1}`,
      name,
      desc,
      cost: Math.ceil(costOf(w, 0, WORKER_TIER_AT[t]) * WORKER_TIER_PRICE[t]),
      icon: w.icon,
      boosts: w.key,
      by: WORKER_TIER_MULT[t],
      req: { worker: w.key, owned: WORKER_TIER_AT[t] },
    }))
  );

// Global upgrades: click power, whole-þing output, click/production share, and
// the two fundarstjóri ability trees. Ordering here is cosmetic — the shop
// sorts by cost and hides anything whose `req` is not met yet.
const GLOBAL_UPGRADES: Upgrade[] = [
  // — smellikraftur —
  {
    key: "ristabraud",
    name: "Ristabrauð handa Arnóri",
    desc: "Fundarstjóri á fastandi maga afgreiðir ekkert.",
    cost: 500,
    icon: "coffee",
    click: 2,
  },
  {
    key: "fundarhamar",
    name: "Nýr fundarhamar",
    desc: "Sá gamli brotnaði í miðri atkvæðagreiðslu.",
    cost: 25_000,
    icon: "hand",
    click: 3,
  },
  {
    key: "mikrofonn",
    name: "Míkrófónn sem virkar",
    desc: "Aftasta röðin heyrir loksins hvað er verið að samþykkja.",
    cost: 400_000,
    icon: "mega",
    click: 2,
    req: { lifetime: 250_000 },
  },
  {
    key: "vatnsglas",
    name: "Vatnsglas í pontu",
    desc: "Röddin heldur út allan dagskrárliðinn.",
    cost: 9_000_000,
    icon: "hand",
    click: 2,
    req: { lifetime: 5_000_000 },
  },
  {
    key: "fundarstjorastoll",
    name: "Fundarstjórastóllinn",
    desc: "Hár bakstuðningur, gott útsýni yfir salinn.",
    cost: 200_000_000,
    icon: "user",
    click: 2,
    req: { lifetime: 120_000_000 },
  },
  {
    key: "hamarshogg",
    name: "Hamarshögg sem heyrist",
    desc: "Eitt högg og málið er afgreitt.",
    cost: 6_000_000_000,
    icon: "hand",
    click: 3,
    req: { things: 1 },
  },
  // — smellir sækja í framleiðsluna —
  {
    key: "lesasalinn",
    name: "Arnór les salinn",
    desc: "Hver smellur sækir brot af því sem þingið framleiðir.",
    cost: 5_000_000,
    icon: "users",
    share: 0.01,
    req: { totalWorkers: 20, lifetime: 3_000_000 },
  },
  {
    key: "klappa",
    name: "Þingheimur klappar með",
    desc: "Salurinn tekur undir í hvert sinn sem þú smellir.",
    cost: 20_000_000_000,
    icon: "hand",
    share: 0.05,
    req: { totalWorkers: 60, lifetime: 1e10 },
  },
  {
    key: "standandi",
    name: "Salurinn stendur upp",
    desc: "Standandi lófatak við hvern einasta smell.",
    cost: 5e14,
    icon: "users",
    share: 0.15,
    req: { totalWorkers: 120, things: 2 },
  },
  // — öll fundarsköp —
  {
    key: "kaffi",
    name: "Kaffi á könnunni",
    desc: "Grunnforsenda þess að nokkuð gerist á skátaþingi.",
    cost: 60_000,
    icon: "coffee",
    work: 1.5,
    req: { worker: "kaffipasa", owned: 1, totalWorkers: 10 },
  },
  {
    key: "dagskrain",
    name: "Dagskráin send út tímanlega",
    desc: "Stjórnin skilar gögnum fyrir 6. mars kl. 20:30, eins og lögin segja.",
    cost: 300_000,
    icon: "file",
    work: 1.4,
    req: { totalWorkers: 25, lifetime: 200_000 },
  },
  {
    key: "akureyri",
    name: "Skátaþing á Akureyri",
    desc: "Þingið haldið fyrir norðan — ný orka í salinn.",
    cost: 5_000_000,
    icon: "flag",
    work: 1.5,
    req: { totalWorkers: 50, lifetime: 3_000_000 },
  },
  {
    key: "skraning",
    name: "Skráning á skraning.skatarnir.is",
    desc: "Allir skráðir fyrir lokafrestinn, enginn í biðröð við dyrnar.",
    cost: 40_000_000,
    icon: "clipboard",
    work: 1.5,
    req: { totalWorkers: 75, lifetime: 25_000_000 },
  },
  {
    key: "streymi",
    name: "Streymt frá þingsalnum",
    desc: "Þeir sem komust ekki norður fylgjast með heiman frá sér.",
    cost: 900_000_000,
    icon: "globe",
    work: 1.6,
    req: { totalWorkers: 100, lifetime: 500_000_000 },
  },
  {
    key: "frestad",
    name: "Þinginu frestað til 10.–12. apríl",
    desc: "Þremur vikum meira til að undirbúa sig. Allir mæta betur lesnir.",
    cost: 2e10,
    icon: "scroll",
    work: 1.8,
    req: { totalWorkers: 125, lifetime: 1e10 },
  },
  {
    key: "thingforseti",
    name: "Þingforseti með fulla stjórn",
    desc: "Dagskráin heldur, þrátt fyrir allt.",
    cost: 8e11,
    icon: "userCheck",
    work: 2,
    req: { totalWorkers: 150, things: 1 },
  },
  {
    key: "fulltruar53",
    name: "Allir 53 fulltrúarnir mættir",
    desc: "Fimmtán skátafélög, fullskipuð umboð, ekkert autt sæti.",
    cost: 4e13,
    icon: "users",
    work: 2,
    req: { worker: "thingfulltrui", owned: 53, lifetime: 2e13 },
  },
  {
    key: "thingsett",
    name: "Skátaþing 2026 sett",
    desc: "Fánar dregnir að húni og þingið formlega sett.",
    cost: 1e16,
    icon: "flag",
    work: 2.5,
    req: { totalWorkers: 200, things: 2 },
  },
  // — Arnór: gullnir Arnórar —
  {
    key: "gljafagdur",
    name: "Gljáfægður fundarhamar",
    desc: "Glampinn kallar gullna Arnóra fram mun oftar.",
    cost: 2_000_000,
    icon: "sparkles",
    goldenRate: 0.6,
    req: { chair: "arnor", lifetime: 1_000_000 },
  },
  {
    key: "lengrihiti",
    name: "Lengri fundarhiti",
    desc: "Uppörvanir gullnu Arnóranna endast helmingi lengur.",
    cost: 20_000_000,
    icon: "coffee",
    goldenDur: 1.5,
    req: { chair: "arnor", lifetime: 12_000_000 },
  },
  {
    key: "sterkarihiti",
    name: "Sterkari fundarhiti",
    desc: "Hver uppörvun bítur fastar á þingsalnum.",
    cost: 300_000_000,
    icon: "mega",
    goldenPower: 1.4,
    req: { chair: "arnor", lifetime: 180_000_000 },
  },
  {
    key: "heppnir",
    name: "Heppnir Arnórar",
    desc: "Sjaldgæfustu Arnórarnir — og sjálfur Skátaandinn — verða miklu líklegri.",
    cost: 5e9,
    icon: "sparkles",
    goldenLuck: 1.8,
    req: { chair: "arnor", lifetime: 3e9 },
  },
  {
    key: "arnoralls",
    name: "Arnór alls staðar",
    desc: "Það er varla þverfótað fyrir gullnum Arnórum.",
    cost: 1e12,
    icon: "users",
    goldenRate: 0.6,
    req: { chair: "arnor", things: 1 },
  },
  {
    key: "salurlogar",
    name: "Þingsalurinn logar",
    desc: "Fundarhitinn er kominn út fyrir öll velsæmismörk.",
    cost: 8e14,
    icon: "alert",
    goldenPower: 1.6,
    req: { chair: "arnor", things: 2 },
  },
  // — Aron: samfella —
  {
    key: "taktur",
    name: "Taktur í salnum",
    desc: "Samfellan þolir 40% lengra hlé á milli smella.",
    cost: 2_000_000,
    icon: "hand",
    comboWindow: 1.4,
    req: { chair: "aron", lifetime: 1_000_000 },
  },
  {
    key: "haerrathak",
    name: "Hærra þak",
    desc: "Samfellan nær helmingi hærra.",
    cost: 20_000_000,
    icon: "list",
    comboCap: 1.5,
    req: { chair: "aron", lifetime: 12_000_000 },
  },
  {
    key: "snarpari",
    name: "Snarpari samfella",
    desc: "Hvert stig í samfellunni telur fjórðungi meira.",
    cost: 300_000_000,
    icon: "mega",
    comboStep: 1.25,
    req: { chair: "aron", lifetime: 180_000_000 },
  },
  {
    key: "aroniham",
    name: "Aron í ham",
    desc: "Þakinu lyft enn hærra — samfellan nær alla leið upp í 40.",
    cost: 5e9,
    icon: "sparkles",
    comboCap: 1.333,
    req: { chair: "aron", lifetime: 3e9 },
  },
  {
    key: "oslitin",
    name: "Óslitin röð",
    desc: "Samfellan lifir af lengri þögn í salnum.",
    cost: 1e12,
    icon: "clipboard",
    comboWindow: 1.3,
    req: { chair: "aron", things: 1 },
  },
  {
    key: "fullkomin",
    name: "Fullkomin samfella",
    desc: "Síðasta fínstillingin á samfellunni.",
    cost: 8e14,
    icon: "sparkles",
    comboStep: 1.2,
    req: { chair: "aron", things: 2 },
  },
];

export const UPGRADES: Upgrade[] = [...GLOBAL_UPGRADES, ...workerUpgrades()];

/** Worker upgrades indexed by the worker they boost, so lookups stay O(1). */
const BOOSTS_BY_WORKER = UPGRADES.reduce<Record<string, Upgrade[]>>((m, u) => {
  if (u.boosts) (m[u.boosts] ??= []).push(u);
  return m;
}, {});

const WORKER_INDEX: Record<string, number> = WORKERS.reduce<Record<string, number>>((m, w, i) => {
  m[w.key] = i;
  return m;
}, {});

/** Everything the shop needs to decide whether an upgrade is on offer yet. */
export interface UnlockCtx {
  counts: number[];
  /** Lifetime fundarstig produced in the current run. */
  lifetime: number;
  /** Completed þing (prestiges). */
  things: number;
  /** The fundarstjóri currently chairing. */
  chair: string;
  /**
   * Sum of `counts`, precomputed. The shop checks every upgrade against one
   * context, so it passes this in rather than have each check re-add the
   * roster. Derived from `counts` when absent.
   */
  totalWorkers?: number;
}

/** Total fundarsköp owned, of any kind. */
export const totalWorkers = (counts: number[]) => counts.reduce((s, n) => s + (n || 0), 0);

/** Is this upgrade visible in the shop yet? Owned-ness is checked separately. */
export function upgradeUnlocked(u: Upgrade, ctx: UnlockCtx): boolean {
  const r = u.req;
  if (!r) return true;
  if (r.chair && r.chair !== ctx.chair) return false;
  if (r.things !== undefined && ctx.things < r.things) return false;
  if (r.lifetime !== undefined && ctx.lifetime < r.lifetime) return false;
  if (r.totalWorkers !== undefined) {
    const owned = ctx.totalWorkers ?? totalWorkers(ctx.counts);
    if (owned < r.totalWorkers) return false;
  }
  if (r.worker !== undefined) {
    const i = WORKER_INDEX[r.worker];
    if (i === undefined || (ctx.counts[i] ?? 0) < (r.owned ?? 1)) return false;
  }
  return true;
}

// ── Prestige (Þingstig) ──────────────────────────────────────────────────────
// Tuned so you grab a satisfying first haul early — first prestige ~tier 7–8
// yields ~10 Þingstig — then it gets harder and harder: on a √ curve each extra
// point needs quadratically more lifetime (the P-th point costs ∝ P). Þingstig
// reaches SCORE_CAP only in the deep endgame, so the top tiers stay a genuine
// climb rather than a plateau of tied maximums.
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

/**
 * Highest Þingstig the leaderboard will store.
 *
 * The `game_scores.score` column is a Postgres INTEGER, so the hard ceiling is
 * 2,147,483,647; this sits an order of magnitude inside it, leaving room for
 * any future arithmetic without risking overflow. Reaching it takes roughly
 * 1e22 lifetime fundarstig — about where Skátaandinn becomes affordable — so it
 * caps the very end of the game rather than compressing the top of the table,
 * which the old 999,999 did from tier ~17 onwards.
 *
 * The backend enforces the same bound in `GameScoreCreate`; the two have to be
 * changed together.
 */
export const SCORE_CAP = 999_999_999;

// ── Save state ───────────────────────────────────────────────────────────────
// The save lives in localStorage, which the player fully controls — none of
// what follows is security, and it can't be. Anyone willing to open devtools
// can set any value they like, and the only real defence is server-side (the
// backend caps a submitted score at 1..999,999, only ever raises it, and rate
// limits per user). What this layer buys is that a *tampered or corrupt* save
// can't put the game into a nonsensical state — NaN scores, negative counts,
// upgrade keys that no longer exist — and that clock-based offline farming
// costs more than changing a system setting.

export interface SaveState {
  v: 1;
  score: number;
  /** Lifetime fundarstig produced in the current run. */
  run: number;
  counts: number[];
  ups: string[];
  tsCur: number;
  tsTot: number;
  things: number;
  /** When the save was written, on the server's clock where one was known. */
  at: number;
  chairs: string[];
  chair: string;
  /** Tamper-evidence over the fields above. See `signSave`. */
  sig?: string;
}

/** Owning more of one worker than this is not reachable by playing. */
const MAX_COUNT = 100_000;
/**
 * Save-file sanity bound on Þingstig. Deliberately above `SCORE_CAP`: the board
 * stops counting there, but a player's own total may legitimately run past it.
 */
const MAX_THINGSTIG = SCORE_CAP * 10;
const MAX_THINGS = 1e6;

const clampInt = (v: unknown, max: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.min(Math.max(n, 0), max);
};
const clampNum = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

const UPGRADE_KEYS = new Set(UPGRADES.map((u) => u.key));
const CHAIR_KEYS = new Set(CHAIRS.map((c) => c.key));

/**
 * Deterministic 32-bit FNV-1a over the save's meaningful fields.
 *
 * This is tamper *evidence*, not protection: the algorithm ships in the client
 * bundle, so anyone who reads it can forge a signature. It exists so that the
 * common case — editing the JSON by hand in devtools — is detectable, and the
 * game can decline to hand out offline earnings on a save it can't vouch for.
 */
export function signSave(s: SaveState): string {
  const canon = [
    s.v,
    Math.floor(s.score),
    Math.floor(s.run),
    s.counts.join(","),
    [...s.ups].sort().join(","),
    s.tsCur,
    s.tsTot,
    s.things,
    s.at,
    [...s.chairs].sort().join(","),
    s.chair,
  ].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export interface LoadedSave {
  save: SaveState;
  /** False when the signature is absent or doesn't match the contents. */
  trusted: boolean;
}

/**
 * Parse and sanitise a raw save. Every field is coerced into its legal range
 * and unknown upgrade/chair keys are dropped, so a hand-edited save yields a
 * playable state rather than a broken one. Returns null when there is nothing
 * usable to load at all.
 */
export function loadSave(raw: string | null): LoadedSave | null {
  if (!raw) return null;
  let parsed: Partial<SaveState> & { v?: number };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON — start fresh
  }
  if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;

  const counts = WORKERS.map((_, i) =>
    clampInt(Array.isArray(parsed.counts) ? parsed.counts[i] : 0, MAX_COUNT)
  );
  const ups = Array.isArray(parsed.ups)
    ? [
        ...new Set(
          parsed.ups.filter((k): k is string => typeof k === "string" && UPGRADE_KEYS.has(k))
        ),
      ]
    : [];
  // The starting fundarstjóri is always owned; anything unrecognised is dropped.
  const chairs = [
    ...new Set([
      DEFAULT_CHAIR,
      ...(Array.isArray(parsed.chairs)
        ? parsed.chairs.filter((k): k is string => typeof k === "string" && CHAIR_KEYS.has(k))
        : []),
    ]),
  ];
  const chair =
    typeof parsed.chair === "string" && chairs.includes(parsed.chair)
      ? parsed.chair
      : DEFAULT_CHAIR;

  const tsTot = clampInt(parsed.tsTot, MAX_THINGSTIG);
  const score = clampNum(parsed.score);
  const save: SaveState = {
    v: 1,
    score,
    // Lifetime can never be behind the bank it produced.
    run: Math.max(clampNum(parsed.run), score),
    counts,
    ups,
    // Unspent Þingstig cannot exceed what was ever earned.
    tsCur: Math.min(clampInt(parsed.tsCur, MAX_THINGSTIG), tsTot),
    tsTot,
    things: clampInt(parsed.things, MAX_THINGS),
    at: typeof parsed.at === "number" && Number.isFinite(parsed.at) ? parsed.at : 0,
    chairs,
    chair,
  };
  return { save, trusted: typeof parsed.sig === "string" && parsed.sig === signSave(save) };
}

// ── Offline earnings ─────────────────────────────────────────────────────────
/** Longest stretch away that still pays out. */
export const OFFLINE_CAP_S = 8 * 3600;
/** Away time earns at this fraction of the live rate. */
export const OFFLINE_RATE = 0.5;

/**
 * Seconds of away-time to pay for, given when the save was written and the
 * most trustworthy "now" available.
 *
 * `now` should come from the server where possible — reading it from the
 * device clock is exactly what lets someone wind their calendar forward and
 * collect a full offline payout on demand. A save timestamped in the future
 * (clock wound back, or edited) earns nothing.
 */
export function offlineSeconds(savedAt: number, now: number): number {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now)) return 0;
  const away = (now - savedAt) / 1000;
  if (away <= 0) return 0;
  return Math.min(away, OFFLINE_CAP_S);
}

// ── Live multipliers (pure) ──────────────────────────────────────────────────
/** Product of the owned upgrades' values for one numeric field (×1 if none). */
const productOf = (ups: Set<string>, field: keyof Upgrade) =>
  UPGRADES.reduce((m, u) => {
    const v = u[field];
    return typeof v === "number" && ups.has(u.key) ? m * v : m;
  }, 1);

/** Product of all owned work-multiplier upgrades (×1 if none). */
export const workMult = (ups: Set<string>) => productOf(ups, "work");
/** Product of all owned click-multiplier upgrades (×1 if none). */
export const clickMult = (ups: Set<string>) => productOf(ups, "click");
/** Product of the owned upgrades boosting one specific worker (×1 if none). */
export const workerMult = (workerKey: string, ups: Set<string>) =>
  (BOOSTS_BY_WORKER[workerKey] ?? []).reduce((m, u) => (ups.has(u.key) ? m * (u.by ?? 1) : m), 1);
/** Fraction of the current rate each click also earns, from owned upgrades. */
export const clickShare = (ups: Set<string>) =>
  UPGRADES.reduce((s, u) => (u.share && ups.has(u.key) ? s + u.share : s), 0);
/** Permanent prestige multiplier from current Þingstig. */
export const prestigeMult = (tsCur: number) => 1 + PRESTIGE_MULT_PER_POINT * tsCur;
/** Passive fundarstig/sec from owned workers, with upgrade + prestige multipliers. */
export const baseRateOf = (counts: number[], ups: Set<string>, tsCur: number) =>
  WORKERS.reduce((s, w, i) => s + w.out * (counts[i] ?? 0) * workerMult(w.key, ups), 0) *
  workMult(ups) *
  prestigeMult(tsCur);

/**
 * Fundarstig from one click. `rate` is the live passive rate, which the
 * "share" upgrades (and the Hraðafgreiðsla golden) skim a fraction of.
 */
export function clickPower(
  ups: Set<string>,
  tsCur: number,
  rate: number,
  buff: Buff,
  combo = 0,
  step = COMBO_BASE.step
): number {
  const tap = clickMult(ups) * prestigeMult(tsCur);
  const earned = tap * buff.all * buff.click + rate * (clickShare(ups) + buff.share);
  // Samfella multiplies everything the click earns, not just the flat tap —
  // otherwise it stops mattering the moment passive production outgrows taps.
  return earned * comboMult(combo, step);
}

// ── Fundarstjóri ability tuning (pure) ───────────────────────────────────────
/** Gullnir Arnórar: duration ×, power ×, spawn-interval ×, rarity luck. */
export const goldenTuning = (ups: Set<string>) => ({
  dur: productOf(ups, "goldenDur"),
  power: productOf(ups, "goldenPower"),
  rate: productOf(ups, "goldenRate"),
  luck: productOf(ups, "goldenLuck"),
});

/** Samfella tuning after the owned Aron upgrades. */
export const comboParams = (ups: Set<string>): ComboParams => ({
  window: COMBO_BASE.window * productOf(ups, "comboWindow"),
  cap: Math.round(COMBO_BASE.cap * productOf(ups, "comboCap")),
  step: COMBO_BASE.step * productOf(ups, "comboStep"),
});

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

// ── Upgrade effect labels ────────────────────────────────────────────────────
/** "×3" for whole multipliers, "+40%" for the fractional ones. */
function multLabel(m: number): string {
  return Number.isInteger(m) ? `×${m}` : `+${isNum(Math.round((m - 1) * 100), 0)}%`;
}

/**
 * One-line summary of what an upgrade actually does, rendered under its name.
 * Derived from the data so a new upgrade never needs a hand-written label.
 */
export function upgradeEffect(u: Upgrade): string {
  const bits: string[] = [];
  if (u.boosts) {
    const w = WORKERS.find((x) => x.key === u.boosts);
    bits.push(`${multLabel(u.by ?? 1)} ${w ? w.name : u.boosts}`);
  }
  if (u.work) bits.push(`${multLabel(u.work)} öll fundarsköp`);
  if (u.click) bits.push(`${multLabel(u.click)} smellikraftur`);
  if (u.share) bits.push(`+${isNum(u.share * 100)}% af framleiðslu á smell`);
  if (u.goldenDur) bits.push(`Uppörvanir ${multLabel(u.goldenDur)} lengri`);
  if (u.goldenPower) bits.push(`Uppörvanir ${multLabel(u.goldenPower)} sterkari`);
  if (u.goldenRate)
    bits.push(`Gullnir Arnórar +${isNum(Math.round(100 / u.goldenRate - 100), 0)}% oftar`);
  if (u.goldenLuck) bits.push(`Sjaldgæfir Arnórar ${multLabel(u.goldenLuck)} líklegri`);
  if (u.comboWindow) bits.push(`Samfellugluggi ${multLabel(u.comboWindow)}`);
  if (u.comboCap) bits.push(`Samfelluþak ${multLabel(u.comboCap)}`);
  if (u.comboStep) bits.push(`Samfelluþrep ${multLabel(u.comboStep)}`);
  return bits.join(" · ");
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
