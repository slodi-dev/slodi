import type {
  Patrol,
  PlanBand,
  PlanCell,
  PlanGrid,
  PlanStatus,
  PlanWeek,
} from "@/services/plan.service";
import { MOCK_PATROLS } from "@/lib/mock/plan.mock";
import {
  LAB_TODAY as CALENDAR_TODAY,
  labGrid as calendarGrid,
  mondayOf,
  type LabGrid as CalendarGrid,
} from "../plan-calendar/planCalendarLabData";

/**
 * Fixtures and derivations for the Rist lab: A · Two columns (Endurmat and Búnaður), and the
 * four fundur elements that go with it. Lab only: the extra fields here are not in the API yet;
 * PlanGridLab.mdx has the data note and the proposed shapes (sc-644 búnaður, sc-645 endurmat).
 */

/* ── Side columns ──────────────────────────────────────────────────────────── */

export type EndurmatTone = "positive" | "corrective";

/** How last time went for one liður on this week's plan, in the leader's words. */
export interface LabEndurmat {
  id: string;
  lidurId: string;
  lidurName: string;
  fundurId: string;
  fundurTitle: string;
  /** The flokkur whose fundur carries the liður; null for the whole sveit. */
  patrolId: string | null;
  text: string;
  tone: EndurmatTone;
  /** ISO date of the run the note was written after. */
  writtenOn: string;
  by: string;
}

/** One kind of equipment, from a sveit-wide catalogue. */
export interface GearItem {
  id: string;
  name: string;
  /** Used up (eldsneyti, eldspýtur): quantities add up across liðir instead of being shared. */
  consumable?: boolean;
  /** Unit for a consumable, singular and plural: ["brúsi", "brúsar"]. */
  unit?: [string, string];
}

/** One liður's need for one item. In the API this would be `Lidur.gear[]`. */
export interface GearLine {
  itemId: string;
  qty: number;
  lidurId: string;
  lidurName: string;
  fundurId: string;
  fundurTitle: string;
}

/** Whether the sveit has the item for this week. Per week, per sveit; not in the API. */
export type GearState = "eigum" | "vantar" | "ovist";

export interface WeekSide {
  endurmat: LabEndurmat[];
  gear: GearLine[];
}

/** An item on a week's list: the lines it came from, merged. */
export interface GatheredGear {
  item: GearItem;
  qty: number;
  sources: GearLine[];
}

/**
 * The week's list, one row per item. Reusable kit takes the largest quantity any one liður
 * needs (the same twelve vasaljós do the Tuesday and the Thursday); consumables add up.
 */
export function gatherGear(lines: GearLine[], catalogue: Record<string, GearItem>): GatheredGear[] {
  const byItem = new Map<string, GatheredGear>();
  for (const line of lines) {
    const item = catalogue[line.itemId];
    if (!item) continue;
    const entry = byItem.get(item.id) ?? { item, qty: 0, sources: [] };
    entry.sources.push(line);
    entry.qty = item.consumable ? entry.qty + line.qty : Math.max(entry.qty, line.qty);
    byItem.set(item.id, entry);
  }
  return [...byItem.values()];
}

const STATE_ORDER: Record<GearState, number> = { vantar: 0, ovist: 1, eigum: 2 };

/** Vantar first, then óvíst, then eigum; alphabetical inside each. */
export function sortGear(
  gear: GatheredGear[],
  stateOf: (itemId: string) => GearState
): GatheredGear[] {
  return [...gear].sort(
    (a, b) =>
      STATE_ORDER[stateOf(a.item.id)] - STATE_ORDER[stateOf(b.item.id)] ||
      a.item.name.localeCompare(b.item.name, "is")
  );
}

/* ── The fundur element's extra data ───────────────────────────────────────── */

/**
 * What a cell needs beyond today's `PlanCell` to say something at a glance. Each field is a
 * proposal; see the data note.
 */
export interface LabEntryExtra {
  /** ISO datetime the event ends. A fös–sun útilega needs it; today there is only `starts_at`. */
  ends_at?: string | null;
  /** The fundur is off this week. Not a PlanStatus today. */
  cancelled?: { reason: string } | null;
  /** How many of the fundur's liðir are decided. Today `item_count` is a total only. */
  decided_count?: number | null;
  /** A joint event of adjacent flokkar: how many columns it covers, counting its own. */
  span_patrols?: number;
}

export type LabCell = PlanCell & LabEntryExtra;
export type LabBand = PlanBand & LabEntryExtra;

/** The grid the lab renders: the real contract, with the extras on each entry. */
export interface LabGridData extends PlanGrid {
  bands: LabBand[];
  cells: LabCell[];
}

/** A flokkur's usual evening: the weekday (0 = mánudagur) and clock it meets on most weeks. */
export interface UsualSlot {
  weekday: number;
  clock: string;
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

const clockOf = (iso: string) => iso.slice(11, 16);

/**
 * Each flokkur's usual slot, read off its own fundir: the most common weekday and time among
 * its ordinary flokksfundir. Derived, so nothing new needs storing; a `Patrol.usual_slot` would
 * do the same for a flokkur with too few fundir to tell.
 */
export function usualSlots(grid: LabGridData): Map<string, UsualSlot> {
  const slots = new Map<string, UsualSlot>();
  for (const patrol of grid.patrols) {
    const counts = new Map<string, number>();
    for (const cell of grid.cells) {
      if (
        cell.patrol_id !== patrol.id ||
        cell.type !== "flokks" ||
        cell.cancelled ||
        !cell.starts_at
      )
        continue;
      const key = `${weekdayOf(cell.starts_at)} ${clockOf(cell.starts_at)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const [weekday, clock] = top[0].split(" ");
      slots.set(patrol.id, { weekday: Number(weekday), clock });
    }
  }
  return slots;
}

/** What sets an entry apart from the flokkur's ordinary week, if anything. */
export type Exception =
  | { kind: "cancelled"; reason: string }
  | { kind: "moved"; weekday: number; clock: string }
  | { kind: "multiday"; fromDay: number; toDay: number }
  | { kind: "oneday"; weekday: number; clock: string }
  | null;

export function exceptionOf(entry: LabCell | LabBand, usual: UsualSlot | undefined): Exception {
  if (entry.cancelled) return { kind: "cancelled", reason: entry.cancelled.reason };
  if (!entry.starts_at) return null;
  const weekday = weekdayOf(entry.starts_at);
  const clock = clockOf(entry.starts_at);
  if (entry.ends_at && entry.ends_at.slice(0, 10) !== entry.starts_at.slice(0, 10)) {
    return { kind: "multiday", fromDay: weekday, toDay: weekdayOf(entry.ends_at) };
  }
  if (entry.type === "dagsferd" || entry.type === "mot") return { kind: "oneday", weekday, clock };
  if (entry.type !== "flokks" || !usual) return null;
  if (usual.weekday !== weekday || usual.clock !== clock) return { kind: "moved", weekday, clock };
  return null;
}

/* ── Fixtures ──────────────────────────────────────────────────────────────── */

export const GEAR: Record<string, GearItem> = {
  primus: { id: "primus", name: "Prímus" },
  eldsneyti: { id: "eldsneyti", name: "Eldsneyti", consumable: true, unit: ["brúsi", "brúsar"] },
  pottar: { id: "pottar", name: "Pottasett" },
  eldspytur: { id: "eldspytur", name: "Eldspýtur", consumable: true, unit: ["stokkur", "stokkar"] },
  kort: { id: "kort", name: "Kort af hverfinu" },
  vasaljos: { id: "vasaljos", name: "Vasaljós" },
  reipi: { id: "reipi", name: "Reipi" },
  sjukrakassi: { id: "sjukrakassi", name: "Sjúkrakassi" },
  attaviti: { id: "attaviti", name: "Áttaviti" },
  klutar: { id: "klutar", name: "Þríhyrnuklútar" },
  tjold: { id: "tjold", name: "Tjöld" },
};

/** Liðir of each fundur by title, with what each needs. Setning and slit carry nothing. */
const FUNDUR_LIDIR: Record<string, [string, [string, number][]][]> = {
  "Eldamennska á prímus": [
    [
      "Eldamennska á prímus",
      [
        ["primus", 3],
        ["eldsneyti", 2],
        ["pottar", 3],
        ["eldspytur", 1],
      ],
    ],
    ["Frágangur", []],
  ],
  "Áttavitaþraut í Öskjuhlíð": [
    ["Áttavitinn: undirstöður", [["attaviti", 6]]],
    [
      "Ratleikur í Öskjuhlíð",
      [
        ["kort", 6],
        ["vasaljos", 6],
      ],
    ],
  ],
  "Hnútar og bönd": [
    ["Hnútar: pelastikk og réttur", [["reipi", 6]]],
    ["Kötturinn og músin", []],
  ],
  "Hjálp í viðlögum (1/2)": [
    [
      "Sárabindi og stöðug hliðarlega",
      [
        ["sjukrakassi", 1],
        ["klutar", 6],
      ],
    ],
  ],
  "Ratleikur um hverfið": [
    [
      "Ratleikur um hverfið",
      [
        ["kort", 6],
        ["vasaljos", 6],
      ],
    ],
  ],
  "Kvöldvaka og hróp": [
    ["Kvöldvaka og hróp", []],
    ["Söngvar", []],
  ],
  "Trönur og reipavinna": [["Trönur og reipavinna", [["reipi", 8]]]],
  Flokksráðsfundur: [["Flokksráðsfundur", []]],
  "Útilega í Heiðmörk": [
    [
      "Tjaldbúðir reistar",
      [
        ["tjold", 4],
        ["reipi", 4],
      ],
    ],
    [
      "Eldamennska á prímus",
      [
        ["primus", 2],
        ["eldsneyti", 2],
        ["pottar", 2],
      ],
    ],
    ["Næturleikur", [["vasaljos", 12]]],
  ],
  "Dagsferð á Esju": [
    [
      "Gangan upp að Steini",
      [
        ["sjukrakassi", 1],
        ["attaviti", 3],
      ],
    ],
  ],
  "Sveitarfundur: haustvarðeldur": [
    [
      "Varðeldur kveiktur",
      [
        ["eldspytur", 2],
        ["sjukrakassi", 1],
      ],
    ],
    ["Ratleikur í myrkri", [["vasaljos", 12]]],
  ],
  "Haustútilega á Úlfljótsvatni": [
    ["Brottför og talning", [["sjukrakassi", 2]]],
    [
      "Tjaldbúðir reistar",
      [
        ["tjold", 8],
        ["reipi", 10],
      ],
    ],
    [
      "Eldamennska á prímus",
      [
        ["primus", 6],
        ["eldsneyti", 4],
        ["pottar", 6],
        ["eldspytur", 2],
      ],
    ],
    [
      "Næturleikur",
      [
        ["vasaljos", 24],
        ["attaviti", 6],
      ],
    ],
  ],
};

type LastTime = Pick<LabEndurmat, "text" | "tone" | "writtenOn" | "by">;

/** Endurmat from the last time each liður was run, keyed by liður name. */
const LAST_TIME: Record<string, LastTime> = {
  "Eldamennska á prímus": {
    text: "Tók 20 mín lengur en áætlað var. Kveikið á prímusunum strax í setningu, ekki eftir hana.",
    tone: "corrective",
    writtenOn: "2026-03-11",
    by: "Halla Björk",
  },
  "Ratleikur í Öskjuhlíð": {
    text: "Tveir póstar týndust í myrkrinu. Hengja endurskinsmerki á póstana næst.",
    tone: "corrective",
    writtenOn: "2025-11-04",
    by: "Gunnar Þór",
  },
  "Hnútar: pelastikk og réttur": {
    text: "Virkaði vel að láta eldri skátana kenna þeim yngri. Halda því.",
    tone: "positive",
    writtenOn: "2026-02-17",
    by: "Embla Ósk",
  },
  "Sárabindi og stöðug hliðarlega": {
    text: "Aðeins þrír þríhyrnuklútar til í kassanum. Þurfum sex.",
    tone: "corrective",
    writtenOn: "2026-04-08",
    by: "Halla Björk",
  },
  "Varðeldur kveiktur": {
    text: "Eldiviðurinn var blautur. Geyma hann inni í skátaheimilinu vikuna á undan.",
    tone: "corrective",
    writtenOn: "2025-10-30",
    by: "Gunnar Þór",
  },
  "Ratleikur í myrkri": {
    text: "Besti liður haustsins að mati krakkanna. Gefa honum tíu mínútur í viðbót.",
    tone: "positive",
    writtenOn: "2025-10-30",
    by: "Embla Ósk",
  },
  Næturleikur: {
    text: "Of margir í einum hópi. Skipta eftir flokkum næst og hafa foringja með hverjum.",
    tone: "corrective",
    writtenOn: "2025-10-25",
    by: "Halla Björk",
  },
  "Tjaldbúðir reistar": {
    text: "Flokkarnir kláruðu á 40 mínútum. Má treysta þeim fyrir meiru.",
    tone: "positive",
    writtenOn: "2025-10-24",
    by: "Gunnar Þór",
  },
};

/** The lab's "today": mánudagur 19. október 2026, the start of week 3. */
export const LAB_TODAY = new Date(2026, 9, 19);
const FIRST_MONDAY = new Date(2026, 9, 5);
const WEEK_COUNT = 8;

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayOf(week: number, weekday: number): Date {
  return new Date(
    FIRST_MONDAY.getFullYear(),
    FIRST_MONDAY.getMonth(),
    FIRST_MONDAY.getDate() + 7 * (week - 1) + weekday
  );
}

const at = (week: number, weekday: number, clock: string) =>
  `${isoDate(dayOf(week, weekday))}T${clock}:00`;

/** Each flokkur's ordinary evening: Refir on þriðjudag, Ernir miðvikudag, and so on. */
const USUAL: Record<string, [number, string]> = {
  "mock-refir": [1, "19:30"],
  "mock-ernir": [2, "19:30"],
  "mock-uglur": [3, "19:30"],
  "mock-birnir": [0, "18:00"],
};

const CELL_TITLES = [
  "Hnútar og bönd",
  "Eldamennska á prímus",
  "Áttavitaþraut í Öskjuhlíð",
  "Ratleikur um hverfið",
  "Kvöldvaka og hróp",
  "Trönur og reipavinna",
  "Flokksráðsfundur",
  "Hjálp í viðlögum (1/2)",
];

function statusOf(week: number): PlanStatus {
  if (week <= 3) return "confirmed";
  if (week <= 5) return "draft";
  if (week <= 7) return "tentative";
  return "unknown";
}

/** Liðir decided, by status: all once staðfest, fewer the further out it is. */
function decided(status: PlanStatus, items: number, seed: number): number {
  if (status === "confirmed") return items;
  if (status === "draft") return Math.max(0, items - 1 - (seed % 2));
  if (status === "tentative") return Math.min(1, items);
  return 0;
}

/** Liðir per fundur: its own, plus setning and slit. */
const itemCount = (title: string) => (FUNDUR_LIDIR[title]?.length ?? 1) + 2;

/**
 * Eight weeks with the exceptions a real autumn has: one fundur moved, a joint útilega of two
 * flokkar (fös–sun), a troop-wide útilega, a dagsferð on a Saturday, a cancelled fundur, a
 * two-week badge, and the far end still undecided.
 */
function buildGrid(): LabGridData {
  const weeks: PlanWeek[] = Array.from({ length: WEEK_COUNT }, (_, i) => ({
    index: i + 1,
    starts_on: isoDate(dayOf(i + 1, 0)),
    label: `Vika ${i + 1}`,
    note: null,
  }));

  const band = (
    week: number,
    title: string,
    type: PlanBand["type"],
    extra: LabEntryExtra & Partial<PlanBand>
  ): LabBand => {
    const status = statusOf(week);
    const items = itemCount(title);
    return {
      event_id: `lab-band-${week}`,
      week_index: week,
      title,
      status,
      type,
      span_weeks: 1,
      item_count: items,
      decided_count: decided(status, items, week),
      ...extra,
    };
  };

  const bands: LabBand[] = [
    band(4, "Sveitarfundur: haustvarðeldur", "sveitar", {
      starts_at: at(4, 3, "19:30"),
      planned_minutes: 105,
      actual_minutes: 120,
    }),
    band(6, "Haustútilega á Úlfljótsvatni", "utilega", {
      starts_at: at(6, 4, "17:00"),
      ends_at: at(6, 6, "14:00"),
      planned_minutes: 45 * 60,
      actual_minutes: 44 * 60,
    }),
  ];

  const bandWeeks = new Set(bands.map((b) => b.week_index));
  const cells: LabCell[] = [];
  MOCK_PATROLS.forEach((patrol, p) => {
    const [weekday, clock] = USUAL[patrol.id];
    for (let week = 1; week <= WEEK_COUNT; week++) {
      if (bandWeeks.has(week)) continue;
      // Uglur run a two-week badge in weeks 2–3; the joint útilega covers Ernir in week 3.
      if (p === 2 && week === 3) continue;
      if (p === 1 && week === 3) continue;

      let title = CELL_TITLES[(week + p * 3) % CELL_TITLES.length];
      const status = statusOf(week);
      const cell: LabCell = {
        event_id: `lab-cell-${patrol.id}-${week}`,
        week_index: week,
        patrol_id: patrol.id,
        title,
        status,
        type: "flokks",
        span_weeks: 1,
        starts_at: at(week, weekday, clock),
        planned_minutes: 90,
        actual_minutes: 90 + [0, -10, 15, 5][(week + p) % 4],
      };

      if (p === 2 && week === 2)
        Object.assign(cell, { title: (title = "Hjálp í viðlögum (1/2)"), span_weeks: 2 });
      // Ernir moved to fimmtudag: the skátaheimili is taken on miðvikudag.
      if (p === 1 && week === 2) cell.starts_at = at(2, 3, "19:30");
      // Refir and Ernir camp together, fös–sun.
      if (p === 0 && week === 3) {
        Object.assign(cell, {
          title: (title = "Útilega í Heiðmörk"),
          type: "utilega",
          span_patrols: 2,
          starts_at: at(3, 4, "17:00"),
          ends_at: at(3, 6, "14:00"),
          planned_minutes: 45 * 60,
          actual_minutes: 45 * 60,
        });
      }
      // Uglur are off in week 5.
      if (p === 2 && week === 5) cell.cancelled = { reason: "Skólaferðalag" };
      // Birnir take a Saturday on Esja instead of their mánudagur.
      if (p === 3 && week === 7) {
        Object.assign(cell, {
          title: (title = "Dagsferð á Esju"),
          type: "dagsferd",
          starts_at: at(7, 5, "10:00"),
          planned_minutes: 6 * 60,
          actual_minutes: 6 * 60,
        });
      }
      // Week 8 for Birnir: a slot with nothing in it yet.
      if (p === 3 && week === 8) Object.assign(cell, { title: (title = "Flokksfundur") });

      const items = itemCount(title);
      cell.item_count = cell.cancelled ? 0 : items;
      cell.decided_count = cell.cancelled ? 0 : decided(status, items, week + p);
      cells.push(cell);
    }
  });

  return { season_id: "lab-season", patrols: MOCK_PATROLS, weeks, bands, cells };
}

/** The bit of a fundur the side columns read: who, which week, what, and whether it's off. */
type SideSource = {
  event_id: string;
  week_index: number;
  title: string;
  patrol_id?: string;
  cancelled?: { reason: string } | null;
};

/** Endurmat and búnaður per week, from the liðir of that week's fundir (cancelled ones drop out). */
function buildSides(
  weeks: PlanWeek[],
  fundir: SideSource[],
  busy: boolean
): Record<number, WeekSide> {
  const sides: Record<number, WeekSide> = {};
  for (const week of weeks) {
    const side: WeekSide = { endurmat: [], gear: [] };
    if (busy) {
      for (const fundur of fundir) {
        if (fundur.week_index !== week.index || fundur.cancelled) continue;
        (FUNDUR_LIDIR[fundur.title] ?? []).forEach(([lidurName, gear], i) => {
          const lidurId = `${fundur.event_id}-l${i}`;
          for (const [itemId, qty] of gear) {
            side.gear.push({
              itemId,
              qty,
              lidurId,
              lidurName,
              fundurId: fundur.event_id,
              fundurTitle: fundur.title,
            });
          }
          const last = LAST_TIME[lidurName];
          if (last) {
            side.endurmat.push({
              id: `e-${lidurId}`,
              lidurId,
              lidurName,
              fundurId: fundur.event_id,
              fundurTitle: fundur.title,
              patrolId: fundur.patrol_id ?? null,
              ...last,
            });
          }
        });
      }
    }
    sides[week.index] = side;
  }
  return sides;
}

/** Owned/needed, as the sveit has ticked it so far. Anything unlisted is óvíst. */
const BUSY_STATE: Record<number, Record<string, GearState>> = {
  1: {
    primus: "eigum",
    eldsneyti: "vantar",
    pottar: "eigum",
    sjukrakassi: "eigum",
    klutar: "vantar",
    attaviti: "eigum",
    kort: "eigum",
    vasaljos: "vantar",
  },
  2: {
    attaviti: "eigum",
    kort: "eigum",
    vasaljos: "eigum",
    reipi: "vantar",
    sjukrakassi: "eigum",
    klutar: "eigum",
  },
  3: {
    tjold: "eigum",
    reipi: "eigum",
    primus: "eigum",
    eldsneyti: "vantar",
    pottar: "eigum",
    vasaljos: "eigum",
    kort: "eigum",
  },
  4: { eldspytur: "eigum", sjukrakassi: "eigum" },
  5: { reipi: "eigum" },
  6: {
    primus: "vantar",
    eldsneyti: "vantar",
    vasaljos: "vantar",
    reipi: "eigum",
    sjukrakassi: "eigum",
    tjold: "eigum",
  },
};

export interface LabSeason {
  grid: LabGridData;
  sides: Record<number, WeekSide>;
  initialState: Record<number, Record<string, GearState>>;
  /** Busy or empty: A5 builds its own season from the calendar lab's fixture to match. */
  busy: boolean;
}

/** A busy autumn: kit for most fundir, endurmat on reused liðir, the usual exceptions. */
export function busySeason(): LabSeason {
  const grid = buildGrid();
  return {
    grid,
    sides: buildSides(grid.weeks, [...grid.bands, ...grid.cells], true),
    initialState: BUSY_STATE,
    busy: true,
  };
}

/** The same fundir with nothing needed and no endurmat. */
export function emptySeason(): LabSeason {
  const grid = buildGrid();
  return {
    grid,
    sides: buildSides(grid.weeks, [...grid.bands, ...grid.cells], false),
    initialState: {},
    busy: false,
  };
}

/** The flokkur's initial, for the small chip: "R" for Refir, "S" for the whole sveit. */
export function patrolInitial(patrol: Patrol | undefined): string {
  return patrol ? patrol.name.charAt(0).toUpperCase() : "S";
}

/* ── A5: the calendar lab's own fixture ────────────────────────────────────── */

export interface CalendarSeason {
  grid: CalendarGrid;
  sides: Record<number, WeekSide>;
  initialState: Record<number, Record<string, GearState>>;
  today: Date;
  /** The weeks shown: the ones that touch October, as the calendar's busy month. */
  weekRange: [number, number];
}

/** What the sveit has ticked for the calendar's weeks: past weeks are all eigum. */
const CALENDAR_STATE: Record<string, Record<string, GearState>> = {
  "2026-10-19": { vasaljos: "vantar", kort: "eigum" },
  "2026-10-26": {
    primus: "vantar",
    eldsneyti: "vantar",
    reipi: "eigum",
    tjold: "eigum",
    sjukrakassi: "eigum",
  },
};

/**
 * The same autumn the calendar lab shows (its `labGrid()`), so A5 and D4 draw the same fundir.
 * The side columns come from this file's liðir, matched by title.
 */
export function calendarSeason(busy: boolean): CalendarSeason {
  const grid = calendarGrid();
  const sides = buildSides(grid.weeks, [...grid.bands, ...grid.cells], busy);
  const thisMonday = mondayOf(CALENDAR_TODAY).getTime();
  const initialState: Record<number, Record<string, GearState>> = {};
  if (busy) {
    for (const week of grid.weeks) {
      if (!week.starts_on) continue;
      const [y, m, d] = week.starts_on.split("-").map(Number);
      if (new Date(y, m - 1, d).getTime() < thisMonday) {
        initialState[week.index] = Object.fromEntries(
          sides[week.index].gear.map((g) => [g.itemId, "eigum" as GearState])
        );
      } else {
        initialState[week.index] = CALENDAR_STATE[week.starts_on] ?? {};
      }
    }
  }
  return { grid, sides, initialState, today: CALENDAR_TODAY, weekRange: [1, 6] };
}
