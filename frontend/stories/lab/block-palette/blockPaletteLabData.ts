import {
  BookOpen,
  Compass,
  Dices,
  Flag,
  Flame,
  Footprints,
  Heart,
  Moon,
  MessagesSquare,
  Puzzle,
  Shapes,
  Sunrise,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { LIBRARY, type LibraryBlock } from "@/lib/mock/library.mock";
import type { SlotKind } from "@/services/plan.service";
import eldamennskaImage from "./thumbs/eldamennska.svg";
import hnutarImage from "./thumbs/hnutar.svg";
import ratleikurImage from "./thumbs/ratleikur.svg";

/* ── What a block could carry ──────────────────────────────────────────────── */

/**
 * A bank block plus what the real bank cards already know about an item and the rail does not
 * show yet: age fit, prep time, whether an endurmat came with it, and a picture.
 */
export interface LabBlock extends LibraryBlock {
  /** Age bands it was written for (the same values as ProgramCard's badges). */
  ages?: string[];
  /** Minutes a foringi needs before the fundur. */
  prepMinutes?: number;
  /** The last endurmat the sveit wrote about it, if there is one (B3). */
  endurmat?: string;
  /** A picture, when the item has one. Most will not. */
  image?: string;
}

/** Storybook's Next image plugin returns image imports as `{ src }`; plain Vite returns a string. */
function urlOf(image: unknown): string {
  if (typeof image === "string") return image;
  return (image as { src: string }).src;
}

const EXTRA: Record<string, Partial<LabBlock>> = {
  "lb-1": { ages: ["Drekaskátar", "Fálkaskátar"] },
  "lb-2": { ages: ["Drekaskátar", "Fálkaskátar", "Dróttskátar"] },
  "lb-3": {
    ages: ["Fálkaskátar", "Dróttskátar"],
    prepMinutes: 30,
    image: urlOf(ratleikurImage),
    endurmat: "Of langt fyrir yngsta flokkinn — styttum leiðina í vor.",
  },
  "lb-4": { ages: ["Fálkaskátar", "Dróttskátar"], prepMinutes: 10, image: urlOf(hnutarImage) },
  "lb-5": { ages: ["Fálkaskátar", "Dróttskátar"], prepMinutes: 15 },
  "lb-6": {
    ages: ["Dróttskátar", "Rekkaskátar"],
    prepMinutes: 20,
    image: urlOf(eldamennskaImage),
    endurmat: "Vantaði annan prímus; tveir hópar biðu of lengi.",
  },
  "lb-7": { ages: ["Dróttskátar", "Rekkaskátar"], prepMinutes: 15 },
  "lb-8": { ages: ["Dróttskátar", "Rekkaskátar"] },
  "lb-9": {},
  "lb-10": {},
  "lb-11": {},
  "lb-12": {},
};

/** The mock bank, plus one "Matur" block so every theme in the mapping appears. */
export const LAB_BLOCKS: LabBlock[] = [
  ...LIBRARY.map((block) => ({ ...block, ...EXTRA[block.id] })),
  {
    id: "lb-lab-1",
    name: "Pönnukökur yfir opnum eldi",
    kind: "dagskra",
    minutes: 40,
    theme: "Matur",
    folder: "felagid",
    timesUsed: 1,
    needs: ["Panna", "Deig"],
    ages: ["Fálkaskátar", "Dróttskátar"],
    prepMinutes: 20,
  },
];

/** Long Icelandic names, to test wrapping in a 296px rail. */
export const LONG_BLOCKS: LabBlock[] = [
  {
    id: "lb-long-1",
    name: "Endurlífgunaræfingar með æfingabrúðum og sáraumbúðaþjálfun í litlum hópum",
    kind: "dagskra",
    minutes: 90,
    theme: "Umhyggja",
    folder: "merki",
    timesUsed: 21,
    ages: ["Dróttskátar", "Rekkaskátar", "Róverskátar"],
    prepMinutes: 45,
    endurmat: "Krakkarnir vildu meiri tíma með brúðunum — skiptum hópnum í tvennt næst.",
  },
  {
    id: "lb-long-2",
    name: "Næturratleikur með vasaljósum og áttavitum um Heiðmerkurskógarstíga",
    kind: "leikur",
    minutes: 120,
    theme: "Ratleikni",
    folder: "felagid",
    timesUsed: 11,
    image: urlOf(ratleikurImage),
  },
  {
    id: "lb-long-3",
    name: "Hátíðleg fánahylling, skátaheitið og skátalögin lesin upp saman",
    kind: "setning",
    minutes: 15,
    theme: "Hefðir",
    folder: "sveitin",
    timesUsed: 1,
  },
  ...LAB_BLOCKS.slice(0, 3),
];

/* ── Icons ─────────────────────────────────────────────────────────────────── */

export interface IconEntry {
  icon: LucideIcon;
  label: string;
  /** Why this picture, for the mapping sheet. */
  why: string;
}

/**
 * One icon per liður kind: *when* in the fundur a block runs. Sunrise and moon bracket the
 * fundur the way setning and slit do (Lucide's sunrise and sunset are mirror images and could
 * not be told apart at 16px); the rest are the most literal object for the kind.
 */
export const KIND_ICON: Record<SlotKind, IconEntry> = {
  setning: { icon: Sunrise, label: "Setning", why: "The fundur starts: the sun comes up." },
  dagskra: { icon: BookOpen, label: "Dagskrá", why: "A verkefni with something to learn." },
  leikur: { icon: Dices, label: "Leikur", why: "A game; dice read as play everywhere." },
  slit: {
    icon: Moon,
    label: "Slit",
    why: "The fundur ends and everyone goes home. Not sunset: it is sunrise mirrored.",
  },
  endurmat: {
    icon: MessagesSquare,
    label: "Endurmat",
    why: "Talking it over afterwards: speech bubbles.",
  },
  custom: { icon: Puzzle, label: "Annað", why: "Anything the leader made up: a loose piece." },
};

/**
 * One icon per theme: *what* a block is about. The theme is what a leader scans for ("we need
 * something outdoors"), so it gets the big picture on the item; the kind rides beside the text.
 */
export const THEME_ICON: Record<string, IconEntry> = {
  Útilíf: { icon: Tent, label: "Útilíf", why: "Camping is the core of útilíf; a tent says it." },
  Ratleikni: { icon: Compass, label: "Ratleikni", why: "The compass is the tool of the theme." },
  Hreyfing: {
    icon: Footprints,
    label: "Hreyfing",
    why: "Lucide has no running figure; footprints read as moving on foot.",
  },
  Hefðir: { icon: Flag, label: "Hefðir", why: "Fánahylling is the sveit's oldest tradition." },
  Umhyggja: { icon: Heart, label: "Umhyggja", why: "Care for others; also first aid." },
  Matur: { icon: Flame, label: "Matur", why: "Scouts cook over a flame, not in a kitchen." },
  Endurmat: {
    icon: MessagesSquare,
    label: "Endurmat",
    why: "The same as the kind: an endurmat block's theme is the endurmat.",
  },
};

/** For a theme the mapping does not know yet: neutral shapes, never a wrong guess. */
export const FALLBACK_THEME_ICON: IconEntry = {
  icon: Shapes,
  label: "Annað þema",
  why: "No icon is better than a misleading one; the theme name still shows as text.",
};

export function themeIcon(theme: string): IconEntry {
  return THEME_ICON[theme] ?? FALLBACK_THEME_ICON;
}
