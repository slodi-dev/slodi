/**
 * The editable bank card, as the SplitGrid lab models it.
 *
 * A liður in a split band is a block from the bank that each flokkur runs for itself. What a
 * foringi changes per flokkur is on the card: the length, the status, who leads it, how it is
 * adapted for this flokkur, the búnaður, or a different block altogether. None of that except
 * length and status is on `Lidur` today, so the lab carries it as extra fields on the liður
 * (they survive every reducer move, which spreads the item) and the MDX lists the gaps.
 *
 * "Útgáfa sveitarinnar" (the sveit's version) is what the liður was when the band was split,
 * the same for every flokkur. A card that differs from it is "breytt fyrir {flokk}" and can be
 * set back. The API has no link from a lane's liður to the band it came from, so the lab takes
 * the sveit's version to be what most flokkar have (`troopVersions`).
 */
import { LIBRARY, type LibraryBlock } from "@/lib/mock/library.mock";
import type { Lidur, PlanStatus } from "@/services/plan.service";

/** A liður with what the card can edit. All optional: the bench's own liðir have none. */
export type CardLidur = Lidur & {
  /** The bank block this liður is. */
  block_id?: string;
  /** Which shared liður of the band this one is a copy of. Kept through a swap. */
  troop_key?: string;
  /** Who leads it in this flokkur. */
  leader?: string | null;
  /** How it is adapted for this flokkur. */
  note?: string | null;
  gear?: string[];
};

/** The fields a card can differ from the sveit's version in, in the order they're listed. */
export type TroopVersion = {
  block_id: string | null;
  name: string;
  minutes: number;
  status: PlanStatus;
  leader: string | null;
  note: string | null;
  gear: string[];
};

export type CardPatch = Partial<Omit<CardLidur, "id">>;

/** The station blocks of the fixtures' stöðvaleikur, as bank cards. */
export const STATION_BLOCKS: LibraryBlock[] = [
  {
    id: "st-hnutar",
    name: "Hnútar og bönd",
    kind: "dagskra",
    minutes: 15,
    theme: "Útilíf",
    source: "sveitin",
    timesUsed: 7,
    needs: ["Reipi og bönd"],
    image: "/mock/bank/hnutar.svg",
  },
  {
    id: "st-attaviti",
    name: "Áttaviti og kort",
    kind: "dagskra",
    minutes: 15,
    theme: "Ratleikni",
    source: "merki",
    timesUsed: 3,
    needs: ["Áttavitar", "Kort"],
    image: "/mock/bank/ratleikur.svg",
  },
  {
    id: "st-skyndihjalp",
    name: "Skyndihjálp",
    kind: "dagskra",
    minutes: 15,
    theme: "Umhyggja",
    source: "merki",
    timesUsed: 2,
    needs: ["Sjúkrakassi"],
    endurmat: "Æfingabrúðan var of fá: fáum aðra lánaða.",
  },
  {
    id: "st-eldfaeri",
    name: "Eldfæri og prímus",
    kind: "dagskra",
    minutes: 15,
    theme: "Matur",
    source: "merki",
    timesUsed: 5,
    needs: ["Prímus og eldsneyti"],
    image: "/mock/bank/eldamennska.svg",
  },
  {
    id: "st-merkjamal",
    name: "Merkjamál",
    kind: "dagskra",
    minutes: 15,
    theme: "Hefðir",
    source: "felagid",
    timesUsed: 1,
    needs: ["Flögg"],
  },
  {
    id: "st-tjald",
    name: "Tjaldreising",
    kind: "dagskra",
    minutes: 15,
    theme: "Útilíf",
    source: "sveitin",
    timesUsed: 9,
    needs: ["Tjöld"],
  },
  {
    id: "st-kako",
    name: "Kakó og spjall",
    kind: "dagskra",
    minutes: 10,
    theme: "Hefðir",
    source: "sveitin",
    timesUsed: 20,
    needs: ["Kakó", "Bollar"],
  },
];

/** What a card can be swapped for: the stations, then the bank's dagskrá and leikir. */
export const SWAP_BLOCKS: LibraryBlock[] = [
  ...STATION_BLOCKS,
  ...LIBRARY.filter((block) => block.kind === "dagskra" || block.kind === "leikur"),
];

export function blockOf(item: CardLidur): LibraryBlock | undefined {
  return item.block_id ? SWAP_BLOCKS.find((block) => block.id === item.block_id) : undefined;
}

/** The shared liður this card is a copy of: its key, or its name for the bench's own liðir. */
export function troopKeyOf(item: CardLidur): string {
  return item.troop_key ?? item.block_id ?? `name:${item.name}`;
}

export function versionOf(item: CardLidur): TroopVersion {
  return {
    block_id: item.block_id ?? null,
    name: item.name,
    minutes: item.minutes,
    status: item.status,
    leader: item.leader ?? null,
    note: item.note ?? null,
    gear: item.gear ?? [],
  };
}

const sameVersion = (a: TroopVersion, b: TroopVersion) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The sveit's version of every shared liður in a band: for each key, the version most flokkar
 * have (the first lane's on a tie). A key only one flokkur has has no sveit version: that liður
 * is theirs alone.
 */
export function troopVersions(lanes: CardLidur[][]): Map<string, TroopVersion> {
  const byKey = new Map<string, { version: TroopVersion; lanes: Set<number> }[]>();
  lanes.forEach((items, laneIndex) => {
    for (const item of items) {
      const key = troopKeyOf(item);
      const version = versionOf(item);
      const seen = byKey.get(key) ?? [];
      const match = seen.find((entry) => sameVersion(entry.version, version));
      if (match) match.lanes.add(laneIndex);
      else seen.push({ version, lanes: new Set([laneIndex]) });
      byKey.set(key, seen);
    }
  });
  const troop = new Map<string, TroopVersion>();
  for (const [key, seen] of byKey) {
    const holders = new Set(seen.flatMap((entry) => [...entry.lanes]));
    if (holders.size < 2) continue;
    const top = seen.reduce((best, entry) => (entry.lanes.size > best.lanes.size ? entry : best));
    troop.set(key, top.version);
  }
  return troop;
}

export type Difference = { field: keyof TroopVersion; label: string; troop: string; mine: string };

const STATUS_WORD: Record<PlanStatus, string> = {
  confirmed: "staðfest",
  draft: "drög",
  tentative: "óvíst",
  unknown: "óákveðið",
};

/** How a card differs from the sveit's version, in words a foringi would use. */
export function differences(item: CardLidur, troop: TroopVersion | undefined): Difference[] {
  if (!troop) return [];
  const mine = versionOf(item);
  const out: Difference[] = [];
  if (mine.block_id !== troop.block_id || mine.name !== troop.name) {
    out.push({ field: "name", label: "Önnur blokk", troop: troop.name, mine: mine.name });
  }
  if (mine.minutes !== troop.minutes) {
    out.push({
      field: "minutes",
      label: "Lengd",
      troop: `${troop.minutes} mín`,
      mine: `${mine.minutes} mín`,
    });
  }
  if (mine.status !== troop.status) {
    out.push({
      field: "status",
      label: "Staða",
      troop: STATUS_WORD[troop.status],
      mine: STATUS_WORD[mine.status],
    });
  }
  if (mine.leader !== troop.leader) {
    out.push({
      field: "leader",
      label: "Stýrir",
      troop: troop.leader ?? "enginn",
      mine: mine.leader ?? "enginn",
    });
  }
  if (mine.note !== troop.note) {
    out.push({
      field: "note",
      label: "Aðlögun",
      troop: troop.note ?? "engin",
      mine: mine.note ?? "engin",
    });
  }
  if (mine.gear.join("|") !== troop.gear.join("|")) {
    out.push({
      field: "gear",
      label: "Búnaður",
      troop: troop.gear.join(", ") || "enginn",
      mine: mine.gear.join(", ") || "enginn",
    });
  }
  return out;
}

/** The patch that sets a card back to the sveit's version. */
export function resetPatch(troop: TroopVersion): CardPatch {
  const block = troop.block_id ? SWAP_BLOCKS.find((b) => b.id === troop.block_id) : undefined;
  return {
    block_id: troop.block_id ?? undefined,
    name: troop.name,
    minutes: troop.minutes,
    status: troop.status,
    leader: troop.leader,
    note: troop.note,
    gear: troop.gear,
    ...(block ? { kind: block.kind, theme: block.theme, endurmat: block.endurmat ?? null } : {}),
  };
}

/** The patch that turns a card into another bank block. The adaptation note doesn't carry over. */
export function swapPatch(item: CardLidur, block: LibraryBlock): CardPatch {
  return {
    troop_key: troopKeyOf(item),
    block_id: block.id,
    name: block.name,
    kind: block.kind,
    minutes: block.minutes,
    theme: block.theme,
    endurmat: block.endurmat ?? null,
    gear: block.needs ?? [],
    note: null,
  };
}

/** Which fields of a patch belong to the sveit's version, for "Breyta hjá öllum". */
export function versionPatch(version: TroopVersion, patch: CardPatch): TroopVersion {
  return {
    block_id: patch.block_id !== undefined ? (patch.block_id ?? null) : version.block_id,
    name: patch.name ?? version.name,
    minutes: patch.minutes ?? version.minutes,
    status: patch.status ?? version.status,
    leader: patch.leader !== undefined ? (patch.leader ?? null) : version.leader,
    note: patch.note !== undefined ? (patch.note ?? null) : version.note,
    gear: patch.gear ?? version.gear,
  };
}
