import type { PlanBand, PlanCell, PlanGrid, PlanWeek } from "@/services/plan.service";
import { MOCK_PATROLS } from "@/lib/mock/plan.mock";

/**
 * What the Rist's two side columns would show if they were part of the system rather than
 * copied from a spreadsheet. Lab only: none of these shapes exist in the API yet. Each type
 * says what it would be on the backend; the MDX doc has the full data note.
 */

/* ── Shapes ────────────────────────────────────────────────────────────────── */

/** How last time went for one liður, in the leader's words. `Lidur.endurmat` today is the text only. */
export type EndurmatTone = "positive" | "corrective";

export interface LabEndurmat {
  id: string;
  /** The liður this note travels with. A real API would give the liður id on this week's fundur. */
  lidurId: string;
  lidurName: string;
  /** The fundur on this week's plan that carries the liður. */
  fundurId: string;
  fundurTitle: string;
  text: string;
  tone: EndurmatTone;
  /** ISO date of the run the note was written after. */
  writtenOn: string;
  by: string;
}

/** A leader's note for the week. Missing from the API; `PlanWeek.note` is the nearest thing. */
export interface LabReminder {
  id: string;
  text: string;
  /** ISO date it must be done by, if any. */
  dueOn: string | null;
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

/** Everything the side columns show for one week. */
export interface WeekSide {
  endurmat: LabEndurmat[];
  reminders: LabReminder[];
  gear: GearLine[];
}

/** An item on a week's list: the lines it came from, merged. */
export interface GatheredGear {
  item: GearItem;
  qty: number;
  sources: GearLine[];
}

/* ── Derivation ────────────────────────────────────────────────────────────── */

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
};

/** Liðir of each fundur by title, with what each needs. */
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
  "Hnútar og bönd": [["Hnútar: pelastikk og réttur", [["reipi", 6]]]],
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
  "Kvöldvaka og hróp": [["Kvöldvaka og hróp", []]],
  "Trönur og reipavinna": [["Trönur og reipavinna", [["reipi", 8]]]],
  Flokksráðsfundur: [["Flokksráðsfundur", []]],
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
    ["Tjaldbúðir reistar", [["reipi", 10]]],
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

/** Endurmat from the last time each liður was run, keyed by liður name. */
const LAST_TIME: Record<
  string,
  Omit<LabEndurmat, "id" | "lidurId" | "fundurId" | "fundurTitle" | "lidurName">
> = {
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

const FIRST_MONDAY = new Date(2026, 9, 5); // 5. október 2026
const WEEK_COUNT = 8;

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(week: number): Date {
  return new Date(
    FIRST_MONDAY.getFullYear(),
    FIRST_MONDAY.getMonth(),
    FIRST_MONDAY.getDate() + 7 * (week - 1)
  );
}

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

const BANDS: [number, string, PlanBand["type"]][] = [
  [4, "Sveitarfundur: haustvarðeldur", "sveitar"],
  [6, "Haustútilega á Úlfljótsvatni", "utilega"],
];

/** A short season: four flokkar, eight weeks, two troop-wide events and one two-week cell. */
function buildGrid(withNeeds: boolean): PlanGrid {
  const weeks: PlanWeek[] = Array.from({ length: WEEK_COUNT }, (_, i) => ({
    index: i + 1,
    starts_on: isoDate(mondayOf(i + 1)),
    label: `Vika ${i + 1}`,
    note: withNeeds ? (WEEK_NOTES[i + 1] ?? null) : null,
  }));
  const needsOf = (title: string) =>
    withNeeds
      ? [...new Set((FUNDUR_LIDIR[title] ?? []).flatMap(([, g]) => g.map(([id]) => GEAR[id].name)))]
      : [];
  const status = (week: number) => (week <= 3 ? "confirmed" : week <= 6 ? "draft" : "tentative");

  const bands: PlanBand[] = BANDS.map(([week, title, type]) => ({
    event_id: `lab-band-${week}`,
    week_index: week,
    title,
    status: status(week),
    type,
    span_weeks: 1,
    starts_at: `${isoDate(mondayOf(week))}T${type === "utilega" ? "17:00" : "19:30"}:00`,
    planned_minutes: type === "utilega" ? 48 * 60 : 105,
    actual_minutes: type === "utilega" ? 47 * 60 : 110,
    item_count: FUNDUR_LIDIR[title]?.length ?? 0,
    needs: needsOf(title),
  }));

  const bandWeeks = new Set(BANDS.map(([w]) => w));
  const cells: PlanCell[] = [];
  MOCK_PATROLS.forEach((patrol, p) => {
    for (let week = 1; week <= WEEK_COUNT; week++) {
      if (bandWeeks.has(week)) continue;
      // Uglur run a two-week badge in weeks 2–3.
      if (p === 2 && week === 3) continue;
      const spans = p === 2 && week === 2;
      const title = spans
        ? "Hjálp í viðlögum (1/2)"
        : CELL_TITLES[(week + p * 3) % CELL_TITLES.length];
      cells.push({
        event_id: cellId(patrol.id, week),
        week_index: week,
        patrol_id: patrol.id,
        title,
        status: status(week),
        type: "flokks",
        span_weeks: spans ? 2 : 1,
        starts_at: `${isoDate(new Date(mondayOf(week).getTime() + (1 + p) * 864e5))}T19:30:00`,
        planned_minutes: 90,
        actual_minutes: 90 + [0, -10, 15, 5][(week + p) % 4],
        item_count: FUNDUR_LIDIR[title]?.length ?? 0,
        needs: needsOf(title),
      });
    }
  });

  return { season_id: "lab-season", patrols: MOCK_PATROLS, weeks, bands, cells };
}

function cellId(patrolId: string, week: number) {
  return `lab-cell-${patrolId}-${week}`;
}

/** The week notes the current grid already has (`PlanWeek.note`). */
const WEEK_NOTES: Record<number, string> = {
  3: "Vetrarfrí 23.–24. okt., hálf mæting líkleg",
  6: "Rúta fer frá skátaheimilinu kl. 17:00",
};

const REMINDERS: Record<number, LabReminder[]> = {
  1: [
    {
      id: "r-1",
      text: "Muna leyfisbréf fyrir útileguna",
      dueOn: "2026-10-08",
      by: "Halla Björk",
    },
  ],
  3: [
    {
      id: "r-2",
      text: "Vetrarfrí 23.–24. okt., hálf mæting líkleg",
      dueOn: null,
      by: "Halla Björk",
    },
  ],
  5: [
    {
      id: "r-3",
      text: "Skila leyfisbréfum og greiðslu fyrir útileguna",
      dueOn: "2026-10-30",
      by: "Gunnar Þór",
    },
  ],
  6: [{ id: "r-4", text: "Rúta fer frá skátaheimilinu kl. 17:00", dueOn: null, by: "Gunnar Þór" }],
  7: [{ id: "r-5", text: "Panta fleiri þríhyrnuklúta", dueOn: "2026-11-18", by: "Embla Ósk" }],
};

/** Every fundur in the week with its id and title. */
function fundirOf(grid: PlanGrid, week: number) {
  return [...grid.bands, ...grid.cells].filter((e) => e.week_index === week);
}

function buildSides(grid: PlanGrid, busy: boolean): Record<number, WeekSide> {
  const sides: Record<number, WeekSide> = {};
  for (const week of grid.weeks) {
    const side: WeekSide = { endurmat: [], reminders: [], gear: [] };
    if (busy) {
      for (const fundur of fundirOf(grid, week.index)) {
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
              ...last,
            });
          }
        });
      }
      side.reminders = REMINDERS[week.index] ?? [];
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
  3: { kort: "eigum", vasaljos: "eigum" },
  4: { eldspytur: "eigum", sjukrakassi: "eigum" },
  5: { reipi: "eigum" },
  6: {
    primus: "vantar",
    eldsneyti: "vantar",
    vasaljos: "vantar",
    reipi: "eigum",
    sjukrakassi: "eigum",
  },
};

export interface LabSeason {
  grid: PlanGrid;
  sides: Record<number, WeekSide>;
  initialState: Record<number, Record<string, GearState>>;
}

/** A busy season: kit for most fundir, endurmat on reused liðir, a few reminders. */
export function busySeason(): LabSeason {
  const grid = buildGrid(true);
  return { grid, sides: buildSides(grid, true), initialState: BUSY_STATE };
}

/** The same fundir with nothing needed, no notes and no reminders. */
export function emptySeason(): LabSeason {
  const grid = buildGrid(false);
  return { grid, sides: buildSides(grid, false), initialState: {} };
}
