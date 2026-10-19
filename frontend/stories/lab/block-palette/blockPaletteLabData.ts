import {
  Award,
  BookMarked,
  BookOpen,
  Building2,
  CloudRain,
  Compass,
  Dices,
  Flag,
  Flame,
  Footprints,
  Heart,
  House,
  Leaf,
  Library,
  Moon,
  MessagesSquare,
  Puzzle,
  Shapes,
  Snowflake,
  Star,
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
 * A bank block plus what the card grid shows and the mock bank does not carry yet: whether an
 * endurmat came with it, and a picture.
 */
export interface LabBlock extends LibraryBlock {
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
  "lb-3": {
    image: urlOf(ratleikurImage),
    endurmat: "Of langt fyrir yngsta flokkinn — styttum leiðina í vor.",
  },
  "lb-4": { image: urlOf(hnutarImage) },
  "lb-6": {
    image: urlOf(eldamennskaImage),
    endurmat: "Vantaði annan prímus; tveir hópar biðu of lengi.",
  },
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

/* ── Collections: built-in sources and the leader's own albums ─────────────── */

/** A built-in source: where a block comes from. Fixed, and not editable. */
export interface LabSource {
  id: "allt" | "felagid" | "merki" | "sveitin";
  label: string;
  icon: LucideIcon;
  /** Which group it sits in when a variation splits "Bankinn" from "Mitt". */
  group: "bankinn" | "mitt";
}

export const SOURCES: LabSource[] = [
  { id: "allt", label: "Allt", icon: Library, group: "bankinn" },
  { id: "felagid", label: "Félagið", icon: Building2, group: "bankinn" },
  { id: "merki", label: "Færnimerki", icon: Award, group: "bankinn" },
  { id: "sveitin", label: "Sveitin mín", icon: House, group: "mitt" },
];

/** The icons an album can wear. Kept apart from the type and theme icons on purpose. */
export const ALBUM_ICONS = { BookMarked, Star, CloudRain, Leaf, Snowflake, Flame } as const;
export type AlbumIcon = keyof typeof ALBUM_ICONS;

/**
 * An album: a named list of references to bank blocks, in the order the leader keeps them. It
 * holds no copies: editing a block in the bank changes it in every album.
 */
export interface LabAlbum {
  id: string;
  name: string;
  icon: AlbumIcon;
  /** Shared with the sveit (owned by the workspace), or the leader's own (owned by the user). */
  shared: boolean;
  blockIds: string[];
}

export const ALBUMS: LabAlbum[] = [
  {
    id: "al-1",
    name: "Uppáhalds leikir",
    icon: "Star",
    shared: false,
    blockIds: ["lb-1", "lb-2", "lb-3"],
  },
  {
    id: "al-2",
    name: "Rigningardagar",
    icon: "CloudRain",
    shared: true,
    blockIds: ["lb-10", "lb-4", "lb-7"],
  },
  {
    id: "al-3",
    name: "Útilega haust",
    icon: "Leaf",
    shared: true,
    blockIds: ["lb-6", "lb-8", "lb-lab-1", "lb-5"],
  },
  {
    id: "al-4",
    name: "Fyrir Drekaskáta",
    icon: "BookMarked",
    shared: false,
    blockIds: ["lb-1", "lb-2", "lb-9", "lb-11"],
  },
  { id: "al-5", name: "Jólafundur", icon: "Snowflake", shared: false, blockIds: [] },
];

const MORE_NAMES = [
  "Fundir þegar helmingur sveitarinnar er á handboltamóti",
  "Vetrarstarf",
  "Foreldrafundur",
  "Þegar rafmagnið fer",
  "Sumardagurinn fyrsti",
  "Nýliðar í september",
  "Stuttir fundir (undir klukkutíma)",
  "Varðeldur",
  "Prófað einu sinni, prófa aftur",
];

/** Fourteen albums, some with long names, for the scrolling and wrapping states. */
export const MANY_ALBUMS: LabAlbum[] = [
  ...ALBUMS,
  ...MORE_NAMES.map((name, i) => ({
    id: `al-more-${i}`,
    name,
    icon: (["BookMarked", "Star", "Leaf", "Flame"] as AlbumIcon[])[i % 4],
    shared: i % 3 === 0,
    blockIds: LAB_BLOCKS.slice(i % 5, (i % 5) + (i % 4)).map((block) => block.id),
  })),
];
