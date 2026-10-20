/**
 * What the FundurSheet styles share: the list of looks, and the few facts the
 * fixed-up sheet shows that the current one doesn't compute (the fit in the
 * header, the offset clock on an undated fundur, the fundur's flokkur).
 *
 * Every look is the current sheet's form: the same header, the same three
 * bands, the same rows, buttons and keys. Only the style differs.
 */
import { BANDS, BAND_OF, type Fundur, type Patrol } from "@/services/plan.service";
import { bandOffset, fundurMinutes } from "@/components/plan/bench/benchState";

export type FundurSheetLook = "lagad" | "hreint" | "stimplar" | "blad" | "flokkur";

export const LOOKS: { look: FundurSheetLook; name: string; story: string }[] = [
  {
    look: "lagad",
    name: "F0 · Current, fixed up",
    story:
      "The current sheet with its problems fixed and nothing else changed: the baseline every other style is measured against.",
  },
  {
    look: "hreint",
    name: "F1 · Quiet",
    story:
      "No card, no boxes: hairline rules, a big clock and the liður's name. Status and buttons step back until you need them.",
  },
  {
    look: "stimplar",
    name: "F2 · Stamped",
    story:
      "The calendar's stamps on every liður, so the sheet, the Dagatal and the grid read as one family: inked when it's ready, an empty dotted box when it isn't.",
  },
  {
    look: "blad",
    name: "F3 · Run sheet",
    story:
      "The paper a foringi holds at the fundur: ruled lines, typewriter times, a tick box per liður, and it prints on one page.",
  },
  {
    look: "flokkur",
    name: "F4 · Patrol colour",
    story:
      "The fundur wears its flokkur's colour: a coloured header and the clock column tinted, so you know whose evening it is at a glance.",
  },
];

/**
 * Minutes past the fundur's start at which each liður begins.
 *
 * An undated fundur has no clock, and the current sheet then shows "—" on every
 * row. "+0:40" is still true and still worth reading.
 */
export function startOffsets(fundur: Fundur): number[] {
  const offsets = new Map<string, number>();
  for (const band of BANDS) {
    let offset = bandOffset(fundur, band.id);
    for (const item of fundur.items) {
      if (BAND_OF[item.kind] !== band.id) continue;
      offsets.set(item.id, offset);
      offset += item.minutes;
    }
  }
  return fundur.items.map((item) => offsets.get(item.id) ?? 0);
}

/** `+0:40`: time since the start, for an undated fundur. */
export function offsetLabel(minutes: number): string {
  return `+${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "10 mín yfir", "10 mín laus" or "Passar": the fit, said once, in the header. */
export function fitWord(fundur: Fundur): { text: string; tone: "over" | "spare" | "fits" } {
  const delta = fundurMinutes(fundur) - fundur.planned_minutes;
  if (delta > 0) return { text: `${delta} mín yfir`, tone: "over" };
  if (delta < 0) return { text: `${-delta} mín laus`, tone: "spare" };
  return { text: "Passar", tone: "fits" };
}

/**
 * The flokkur whose fundur this is, for F4.
 *
 * Lab only. A fundur has no `patrol_id` today, so this reads it off the title
 * ("Flokksfundur Arna"), which only works for the fixtures. Troop-wide fundir
 * have no flokkur and take the sveit's colour. The real sheet needs the
 * fundur's flokkur from the API (see the MDX).
 */
const GENITIVE: Record<string, string> = {
  Refa: "Refir",
  Arna: "Ernir",
  Ugla: "Uglur",
  Bjarna: "Birnir",
};

export function patrolOf(fundur: Fundur, patrols: Patrol[]): Patrol | null {
  if (fundur.scope === "troop-wide") return null;
  const word = Object.keys(GENITIVE).find((g) => fundur.title.split(/\s+/).includes(g));
  return patrols.find((p) => p.name === (word ? GENITIVE[word] : "")) ?? null;
}

/** Row height: tall enough to see the time a liður takes. */
const MIN_ROW_PX = 48;
const MAX_ROW_PX = 156;
const PX_PER_MINUTE = 2.4;

/**
 * The current sheet uses 1.5px a minute with a 52px floor, so 10, 15, 30 and 35
 * minutes all draw 52–53px tall and the "a row is as tall as its time" idea
 * never shows. 2.4px a minute with a 48px floor makes 10 → 48, 30 → 72,
 * 45 → 108: a long block is visibly long.
 */
export function rowHeight(minutes: number): number {
  return Math.min(MAX_ROW_PX, Math.max(MIN_ROW_PX, Math.round(minutes * PX_PER_MINUTE)));
}
