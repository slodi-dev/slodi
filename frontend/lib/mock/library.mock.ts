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
  folder: string;
  /** How many times the sveit has run it — "hefur verið notað" in the rail. */
  timesUsed: number;
  needs?: string[];
};

export const LIBRARY_FOLDERS = [
  { id: "allt", label: "Allt", hint: "Allur bankinn" },
  { id: "sveitin", label: "Sveitin mín", hint: "Það sem við höfum búið til" },
  { id: "felagid", label: "Félagið", hint: "Deilt innan félagsins" },
  { id: "merki", label: "Færnimerki", hint: "Merkjadagskrá" },
];

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
    folder: "sveitin",
    timesUsed: 12,
  },
  {
    id: "lb-2",
    name: "Stórfiskaleikur",
    kind: "leikur",
    minutes: 15,
    theme: "Hreyfing",
    folder: "sveitin",
    timesUsed: 9,
  },
  {
    id: "lb-3",
    name: "Ratleikur um hverfið",
    kind: "leikur",
    minutes: 35,
    theme: "Ratleikni",
    folder: "felagid",
    timesUsed: 4,
    needs: ["Kort af hverfinu"],
  },
  {
    id: "lb-4",
    name: "Hnútar: pelastikk og réttur",
    kind: "dagskra",
    minutes: 35,
    theme: "Útilíf",
    folder: "sveitin",
    timesUsed: 7,
    needs: ["Reipi og bönd"],
  },
  {
    id: "lb-5",
    name: "Áttavitinn: undirstöður",
    kind: "dagskra",
    minutes: 30,
    theme: "Ratleikni",
    folder: "merki",
    timesUsed: 3,
    needs: ["Áttavitar"],
  },
  {
    id: "lb-6",
    name: "Eldamennska á prímus",
    kind: "dagskra",
    minutes: 45,
    theme: "Útilíf",
    folder: "merki",
    timesUsed: 5,
    needs: ["Prímus og eldsneyti"],
  },
  {
    id: "lb-7",
    name: "Hjálp í viðlögum (1/2)",
    kind: "dagskra",
    minutes: 40,
    theme: "Umhyggja",
    folder: "merki",
    timesUsed: 2,
    needs: ["Sjúkrakassi"],
  },
  {
    id: "lb-8",
    name: "Skýlisgerð úr náttúruefni",
    kind: "dagskra",
    minutes: 50,
    theme: "Útilíf",
    folder: "felagid",
    timesUsed: 1,
  },
  {
    id: "lb-9",
    name: "Fánastund og hróp",
    kind: "setning",
    minutes: 10,
    theme: "Hefðir",
    folder: "sveitin",
    timesUsed: 31,
  },
  {
    id: "lb-10",
    name: "Söngvar og hróp",
    kind: "dagskra",
    minutes: 25,
    theme: "Hefðir",
    folder: "sveitin",
    timesUsed: 14,
  },
  {
    id: "lb-11",
    name: "Slit og tilkynningar",
    kind: "slit",
    minutes: 10,
    theme: "Hefðir",
    folder: "sveitin",
    timesUsed: 28,
  },
  {
    id: "lb-12",
    name: "Endurmat foringja",
    kind: "endurmat",
    minutes: 15,
    theme: "Endurmat",
    folder: "sveitin",
    timesUsed: 6,
  },
];
