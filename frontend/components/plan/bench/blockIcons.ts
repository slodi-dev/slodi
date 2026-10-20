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
import type { FolderIconName } from "@/lib/mock/folders.mock";
import { LIBRARY_SOURCES, type LibrarySourceId } from "@/lib/mock/library.mock";
import type { SlotKind } from "@/services/plan.service";

/**
 * The pictures the bank rail draws: one per liður kind, one per theme, one per built-in source
 * and one per mappa icon. Each set is kept apart, so a collection is never mistaken for a type
 * or a theme. The BlockPalette docs page has the reasoning; the "Icon mapping" story shows them.
 */

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

/* ── Collections ───────────────────────────────────────────────────────────── */

const SOURCE_ICON: Record<LibrarySourceId, LucideIcon> = {
  allt: Library,
  felagid: Building2,
  merki: Award,
  sveitin: House,
};

/** The built-in sources with their icons, in the rail's order. */
export const SOURCES = LIBRARY_SOURCES.map((source) => ({
  ...source,
  icon: SOURCE_ICON[source.id],
}));

export const FOLDER_ICONS: Record<FolderIconName, LucideIcon> = {
  BookMarked,
  Star,
  CloudRain,
  Leaf,
  Snowflake,
  Flame,
};
