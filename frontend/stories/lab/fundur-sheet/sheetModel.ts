/**
 * What every FundurSheet direction reads off a fundur, computed once.
 *
 * The four looks disagree about layout and agree about facts: how long the
 * evening runs, whether it fits, what is still undecided. Deriving those here,
 * from the bench's own `benchState` helpers, keeps the header of one look from
 * saying "4 liðir" while another says "2" (the split-lane bug FundurSheet's
 * comment describes).
 */
import {
  BANDS,
  BAND_OF,
  type BandId,
  type Fundur,
  type Lidur,
  type PlanStatus,
} from "@/services/plan.service";
import {
  bandMinutes,
  bandOffset,
  clockAt,
  fundurMinutes,
} from "@/components/plan/bench/benchState";
import { countIs, formatIcelandicDayMonth, pluralIs } from "@/lib/format";

export type FundurSheetLook = "dagskra" | "timalina" | "gatlisti" | "thett";

export const LOOKS: { look: FundurSheetLook; name: string; story: string }[] = [
  {
    look: "dagskra",
    name: "A · Dagskrá",
    story:
      "A printed running order: a big clock column and big titles, everything else quiet. For reading at the meeting.",
  },
  {
    look: "timalina",
    name: "B · Tímalína",
    story:
      "Each liður is a bar as long as its minutes, against a line at the planned length, so you see the shape of the evening and where it overruns.",
  },
  {
    look: "gatlisti",
    name: "C · Gátlisti",
    story:
      "Each row leads with its status, and the header lists what's left to do: “2 óákveðnir · 10 mín yfir”.",
  },
  {
    look: "thett",
    name: "D · Þétt tafla",
    story:
      "A dense table with the duration and status editable in the row, for fast changes on a laptop.",
  },
];

/** Status order, from "needs you" to "done", for legends and meters. */
export const STATUS_ORDER: PlanStatus[] = ["unknown", "tentative", "draft", "confirmed"];

export interface SheetFacts {
  /** Every liður, split lanes included. */
  allItems: Lidur[];
  total: number;
  planned: number;
  /** Positive when over the plan, negative when there is time to spare. */
  delta: number;
  over: boolean;
  /** `HH:MM` the fundur starts, or null when undated. */
  startsAt: string | null;
  endsAt: string | null;
  /** The planned end, which is where the over-time line sits. */
  plannedEndsAt: string | null;
  undecided: number;
  byStatus: Record<PlanStatus, number>;
  /** Bands with nothing in them yet: the beinagrind's blanks. */
  emptyBands: BandId[];
  /** Minutes the timeline scales to: the longer of the plan and the liðir. */
  scale: number;
}

export function sheetFacts(fundur: Fundur): SheetFacts {
  const allItems = [
    ...fundur.items,
    ...Object.values(fundur.split ?? {}).flatMap((lanes) =>
      (lanes ?? []).flatMap((lane) => lane.items)
    ),
  ];
  const total = fundurMinutes(fundur);
  const byStatus: Record<PlanStatus, number> = {
    unknown: 0,
    tentative: 0,
    draft: 0,
    confirmed: 0,
  };
  for (const item of allItems) byStatus[item.status] += 1;

  const emptyBands = BANDS.filter(
    (band) =>
      !fundur.split?.[band.id] && !fundur.items.some((item) => BAND_OF[item.kind] === band.id)
  ).map((band) => band.id);

  return {
    allItems,
    total,
    planned: fundur.planned_minutes,
    delta: total - fundur.planned_minutes,
    over: total > fundur.planned_minutes,
    startsAt: clockAt(fundur, 0),
    endsAt: clockAt(fundur, total),
    plannedEndsAt: clockAt(fundur, fundur.planned_minutes),
    undecided: byStatus.unknown,
    byStatus,
    emptyBands,
    scale: Math.max(total, fundur.planned_minutes, 1),
  };
}

/**
 * Minutes past the fundur's start at which each of its liðir begins.
 *
 * The numeric twin of `startTimes`, and it works on an undated fundur too:
 * a scratchpad has no clock, but "40 minutes in" is still true and still worth
 * showing.
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

/** "100 / 90 mín · 10 yfir", or "80 / 90 mín · 10 laus". The bench's own wording. */
export function fitLabel(facts: SheetFacts): string {
  const base = `${facts.total} / ${facts.planned} mín`;
  if (facts.delta > 0) return `${base} · ${facts.delta} yfir`;
  if (facts.delta < 0) return `${base} · ${-facts.delta} laus`;
  return base;
}

/** "1 liður enn óákveðinn" / "Allir liðir ákveðnir": the adjective agrees too. */
export function undecidedSentence(n: number): string {
  return n > 0
    ? `${countIs(n, "liður", "liðir")} enn ${pluralIs(n, "óákveðinn", "óákveðnir")}`
    : "Allir liðir ákveðnir";
}

/** "2 óákveðnir": the short form for the checklist's headline. */
export function undecidedShort(n: number): string {
  return countIs(n, "óákveðinn", "óákveðnir");
}

/** The fundur's date through lib/format; the label is the fallback for an undated week. */
export function dateLabel(fundur: Fundur): string {
  return formatIcelandicDayMonth(fundur.starts_at) || fundur.date_label;
}

/** "Útilíf · vika 6/20": the cycle line, when there is one. */
export function cycleLabel(fundur: Fundur): string | null {
  if (!fundur.theme) return null;
  return fundur.of_weeks
    ? `${fundur.theme} · vika ${fundur.week_index}/${fundur.of_weeks}`
    : fundur.theme;
}

export { bandMinutes };
