import type { SlotKind } from "@/services/plan.service";

/**
 * The dagskrárbankinn as the left rail shows it — sc-145…149.
 *
 * A block in the bank is not a bare activity: it carries the theme it serves and
 * what it needs, because B3's whole point is that a reused block should bring its
 * context with it rather than arriving as a name a leader has to reconstruct.
 */

export type LibraryBlock = {
  id: string;
  name: string;
  kind: SlotKind;
  minutes: number;
  theme: string;
  /** Where it comes from: one of LIBRARY_SOURCES (not a mappa; see folders.mock.ts). */
  source: Exclude<LibrarySourceId, "allt">;
  /** How many times the sveit has run it — "hefur verið notað" in the rail. */
  timesUsed: number;
  needs?: string[];
  /** The last endurmat the sveit wrote about it, if there is one (B3). */
  endurmat?: string;
  /** A picture, when the item has one. Most will not. */
  image?: string;
};

/**
 * The built-in sources: where a block comes from. Fixed and not editable, unlike the leader's
 * own möppur (folders.mock.ts). "allt" is the whole bank.
 */
export const LIBRARY_SOURCES = [
  { id: "allt", label: "Allt" },
  { id: "felagid", label: "Félagið" },
  { id: "merki", label: "Færnimerki" },
  { id: "sveitin", label: "Sveitin mín" },
] as const;

export type LibrarySourceId = (typeof LIBRARY_SOURCES)[number]["id"];

export const LIBRARY_KINDS: { id: SlotKind | "allt"; label: string }[] = [
  { id: "allt", label: "Allt" },
  { id: "dagskra", label: "Dagskrá" },
  { id: "leikur", label: "Leikur" },
  { id: "setning", label: "Setning" },
  { id: "slit", label: "Slit" },
];

export const LIBRARY: LibraryBlock[] = [
  {
    id: "lb-1",
    name: "Kötturinn og músin",
    kind: "leikur",
    minutes: 20,
    theme: "Hreyfing",
    source: "sveitin",
    timesUsed: 12,
  },
  {
    id: "lb-2",
    name: "Stórfiskaleikur",
    kind: "leikur",
    minutes: 15,
    theme: "Hreyfing",
    source: "sveitin",
    timesUsed: 9,
  },
  {
    id: "lb-3",
    name: "Ratleikur um hverfið",
    kind: "leikur",
    minutes: 35,
    theme: "Ratleikni",
    source: "felagid",
    timesUsed: 4,
    needs: ["Kort af hverfinu"],
    image: "/mock/bank/ratleikur.svg",
    endurmat: "Of langt fyrir yngsta flokkinn — styttum leiðina í vor.",
  },
  {
    id: "lb-4",
    name: "Hnútar: pelastikk og réttur",
    kind: "dagskra",
    minutes: 35,
    theme: "Útilíf",
    source: "sveitin",
    timesUsed: 7,
    needs: ["Reipi og bönd"],
    image: "/mock/bank/hnutar.svg",
  },
  {
    id: "lb-5",
    name: "Áttavitinn: undirstöður",
    kind: "dagskra",
    minutes: 30,
    theme: "Ratleikni",
    source: "merki",
    timesUsed: 3,
    needs: ["Áttavitar"],
  },
  {
    id: "lb-6",
    name: "Eldamennska á prímus",
    kind: "dagskra",
    minutes: 45,
    theme: "Útilíf",
    source: "merki",
    timesUsed: 5,
    needs: ["Prímus og eldsneyti"],
    image: "/mock/bank/eldamennska.svg",
    endurmat: "Vantaði annan prímus; tveir hópar biðu of lengi.",
  },
  {
    id: "lb-7",
    name: "Hjálp í viðlögum (1/2)",
    kind: "dagskra",
    minutes: 40,
    theme: "Umhyggja",
    source: "merki",
    timesUsed: 2,
    needs: ["Sjúkrakassi"],
  },
  {
    id: "lb-8",
    name: "Skýlisgerð úr náttúruefni",
    kind: "dagskra",
    minutes: 50,
    theme: "Útilíf",
    source: "felagid",
    timesUsed: 1,
  },
  {
    id: "lb-9",
    name: "Fánastund og hróp",
    kind: "setning",
    minutes: 10,
    theme: "Hefðir",
    source: "sveitin",
    timesUsed: 31,
  },
  {
    id: "lb-10",
    name: "Söngvar og hróp",
    kind: "dagskra",
    minutes: 25,
    theme: "Hefðir",
    source: "sveitin",
    timesUsed: 14,
  },
  {
    id: "lb-11",
    name: "Slit og tilkynningar",
    kind: "slit",
    minutes: 10,
    theme: "Hefðir",
    source: "sveitin",
    timesUsed: 28,
  },
  {
    id: "lb-12",
    name: "Endurmat foringja",
    kind: "endurmat",
    minutes: 15,
    theme: "Endurmat",
    source: "sveitin",
    timesUsed: 6,
  },
  {
    id: "lb-13",
    name: "Pönnukökur yfir opnum eldi",
    kind: "dagskra",
    minutes: 40,
    theme: "Matur",
    source: "felagid",
    timesUsed: 1,
    needs: ["Panna", "Deig"],
  },
];
