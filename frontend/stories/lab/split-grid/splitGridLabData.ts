/**
 * Fixtures for the SplitGrid lab: the bench fixture from `lib/mock/bench.mock.ts`, with the
 * Verkefni fundar of this week's fundur ("Flokksfundur Arna", 19:30) split across the flokkar.
 *
 * The real fixture splits by copying the band into every lane, which is the moment right after
 * "Skipta á flokka". That case is kept (`copiedSplitData`), but a leader splits to do something
 * different per flokkur, so most fixtures are a stöðvaleikur: the same stations, rotated, so
 * each flokkur is at a different station at the same time.
 */
import {
  afterIntents,
  benchData,
  FUNDUR,
  undatedBenchData,
} from "@/stories/vinnubekkur/benchHarness";
import {
  BAND_OF,
  type Patrol,
  type PatrolLane,
  type PlanBenchData,
  type PlanStatus,
} from "@/services/plan.service";
import { STATION_BLOCKS, type CardLidur } from "./cardModel";

export const LAB_FUNDUR = FUNDUR.overTime;

/** Up to six flokkar, one per patrol colour. The first four are the bench fixture's own. */
export const LAB_PATROLS: Patrol[] = [
  { id: "mock-refir", name: "Refir", accent: "rekkar" },
  { id: "mock-ernir", name: "Ernir", accent: "drekar" },
  { id: "mock-uglur", name: "Uglur", accent: "falkar" },
  { id: "mock-birnir", name: "Birnir", accent: "drott" },
  { id: "mock-selir", name: "Selir", accent: "rover" },
  { id: "mock-hrafnar", name: "Hrafnar", accent: "adrir" },
];

const STATIONS = [
  "Hnútar og bönd",
  "Áttaviti og kort",
  "Skyndihjálp",
  "Eldfæri og prímus",
  "Merkjamál",
  "Tjaldreising",
];

/** Station names long enough to wrap, for the long-title stories. */
const LONG_STATIONS = [
  "Endurlífgunaræfingar með æfingabrúðum og sáraumbúðaþjálfun",
  "Áttavitinn og kortalestur í Elliðaárdalnum",
  "Skyndihjálp",
  "Eldfæri, prímusar og öryggi við eldunarstöðina",
];

/** A spread of statuses, so the cards show every state. */
const STATUS_OF: Record<string, PlanStatus> = {
  Skyndihjálp: "draft",
  "Eldfæri og prímus": "tentative",
  Merkjamál: "unknown",
};

/** Who runs each station for the whole sveit (the sveit's version of the card). */
const LEADER_OF: Record<string, string> = {
  "Hnútar og bönd": "Sigga",
  "Áttaviti og kort": "Jón",
  Skyndihjálp: "Elín",
  "Eldfæri og prímus": "Bjarki",
};

let counter = 0;
/** A station as a liður: the bank block's kind, theme and búnaður, and the station's leader. */
function lidur(name: string, minutes: number, patrolId: string): CardLidur {
  counter += 1;
  const block = STATION_BLOCKS.find((b) => b.name === name);
  return {
    id: `lab-${patrolId}-${counter}`,
    name,
    kind: block?.kind ?? "dagskra",
    minutes,
    status: STATUS_OF[name] ?? "confirmed",
    theme: block?.theme ?? "Ratleikni",
    venue: null,
    endurmat: block?.endurmat ?? null,
    block_id: block?.id,
    leader: LEADER_OF[name] ?? null,
    note: null,
    gear: block?.needs ?? [],
  };
}

/** Lane `k` does the stations in order, starting at station `k`. */
function rotation(patrols: Patrol[], stations: string[], minutes: number): PatrolLane[] {
  return patrols.map((patrol, k) => ({
    patrol_id: patrol.id,
    items: stations.map((_, i) => lidur(stations[(i + k) % stations.length], minutes, patrol.id)),
  }));
}

/** The bench fixture with this week's kjarni replaced by `lanes`. */
function withLanes(
  lanes: PatrolLane[],
  patrols: Patrol[],
  base: PlanBenchData = benchData()
): PlanBenchData {
  return {
    ...base,
    patrols,
    fundir: base.fundir.map((fundur) =>
      fundur.event_id === LAB_FUNDUR
        ? {
            ...fundur,
            items: fundur.items.filter((item) => BAND_OF[item.kind] !== "kjarni"),
            split: { ...fundur.split, kjarni: lanes },
          }
        : fundur
    ),
  };
}

/** Even: four flokkar, four stations of 15 mín, rotated. Everyone finishes together. */
export function evenData(count = 4, minutes = 15): PlanBenchData {
  const patrols = LAB_PATROLS.slice(0, count);
  return withLanes(rotation(patrols, STATIONS.slice(0, count), minutes), patrols);
}

/**
 * Uneven: Ernir's Skyndihjálp went to Uglur, and Refir added a Kakó at the end. Uglur (75 mín,
 * Skyndihjálp twice) now set the length; Refir wait 5 mín, Birnir 15 and Ernir 30. Two stations
 * have two flokkar at once. Refir's Áttaviti has its own note and Birnir's Hnútar its own
 * leader, so two cards differ from the sveit's version.
 */
export function unevenData(): PlanBenchData {
  const patrols = LAB_PATROLS.slice(0, 4);
  const lanes = rotation(patrols, STATIONS.slice(0, 4), 15);
  const ernir = lanes[1];
  const moved = ernir.items.find((item) => item.name === "Skyndihjálp");
  if (moved) {
    ernir.items = ernir.items.filter((item) => item !== moved);
    lanes[2].items = [...lanes[2].items, moved];
  }
  lanes[0].items = [...lanes[0].items, lidur("Kakó og spjall", 10, patrols[0].id)];
  // Two cards changed for one flokkur: Refir take the compass outside, Birnir have their own
  // leader for the knots.
  lanes[0].items = lanes[0].items.map((item: CardLidur) =>
    item.name === "Áttaviti og kort" ? { ...item, note: "Förum út að Elliðaánum." } : item
  );
  lanes[3].items = lanes[3].items.map((item: CardLidur) =>
    item.name === "Hnútar og bönd" ? { ...item, leader: "Óli" } : item
  );
  return withLanes(lanes, patrols);
}

/** Six flokkar, six stations of 10 mín. The widest a sveit gets. */
export function sixData(): PlanBenchData {
  return evenData(6, 10);
}

/** Two flokkar: the narrowest split there is. */
export function twoData(): PlanBenchData {
  const patrols = LAB_PATROLS.slice(0, 2);
  const lanes = rotation(patrols, STATIONS.slice(0, 2), 20);
  lanes[1].items = [...lanes[1].items, lidur("Frágangur", 10, patrols[1].id)];
  return withLanes(lanes, patrols);
}

/** Uglur's lane is empty: everything they had was moved to other flokkar. */
export function emptyLaneData(): PlanBenchData {
  const patrols = LAB_PATROLS.slice(0, 4);
  const lanes = rotation(patrols, STATIONS.slice(0, 4), 15);
  const others = [lanes[0], lanes[1], lanes[3]];
  lanes[2].items.forEach((item, i) => {
    const to = others[i % others.length];
    to.items = [...to.items, item];
  });
  lanes[2].items = [];
  return withLanes(lanes, patrols);
}

/** Long station names and a long flokkur name, uneven, on the undated scratchpad. */
export function longUndatedData(): PlanBenchData {
  const patrols: Patrol[] = [
    ...LAB_PATROLS.slice(0, 2),
    { id: "mock-hunar", name: "Hvítabjarnarhúnarnir", accent: "falkar" },
  ];
  const lanes = rotation(patrols, LONG_STATIONS.slice(0, 3), 20);
  lanes[2].items = [...lanes[2].items, lidur(LONG_STATIONS[3], 5, patrols[2].id)];
  return withLanes(lanes, patrols, undatedBenchData());
}

/** Right after "Skipta á flokka": every lane is a copy of the band. Merging loses nothing. */
export function copiedSplitData(): PlanBenchData {
  const base = { ...benchData(), patrols: LAB_PATROLS.slice(0, 4) };
  return afterIntents(base, [{ t: "splitBand", fundurId: LAB_FUNDUR, band: "kjarni" }]);
}

/**
 * Flokkar with long, funny names, mixed with short ones, as leaders really name them: a phrase
 * of five words, a 25-letter compound with no space to break at, and a one-word name.
 */
const LONG_NAMED: Patrol[] = [
  { id: "mock-svin", name: "Fjólublá fljúgandi avókadó svínin", accent: "adrir" },
  { id: "mock-refir", name: "Refir", accent: "rekkar" },
  { id: "mock-bru", name: "Hraðbrautarbrúarsmiðirnir", accent: "rover" },
  { id: "mock-hetjur", name: "Ofurhetjur úr Breiðholti", accent: "falkar" },
  { id: "mock-sky", name: "Þrumuskýin", accent: "drekar" },
  { id: "mock-geim", name: "Litlu grænu geimverurnar frá Mars", accent: "drott" },
];

/** Four or six flokkar from LONG_NAMED, uneven. The four keep the longest names. */
export function longNamesData(count: 4 | 6 = 4): PlanBenchData {
  const patrols =
    count === 4 ? [LONG_NAMED[0], LONG_NAMED[1], LONG_NAMED[2], LONG_NAMED[5]] : LONG_NAMED;
  const lanes = rotation(patrols, STATIONS.slice(0, 4), 15);
  lanes[1].items = [...lanes[1].items, lidur("Kakó og spjall", 10, patrols[1].id)];
  return withLanes(lanes, patrols);
}

export const FIXTURES = {
  even: evenData,
  uneven: unevenData,
  six: sixData,
  two: twoData,
  empty: emptyLaneData,
  longUndated: longUndatedData,
  copied: copiedSplitData,
  longNames: () => longNamesData(4),
  longNamesSix: () => longNamesData(6),
} as const;

export type FixtureName = keyof typeof FIXTURES;
