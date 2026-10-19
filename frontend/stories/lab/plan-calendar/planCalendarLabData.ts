/**
 * Fixtures and helpers for the PlanCalendar day-entry lab.
 *
 * The real fixture (`lib/mock/plan.mock.ts`) is anchored to today, so its busiest day moves
 * every week and a "day with five entries" may not exist in the month on screen. The lab needs
 * the hard cases on fixed days, so this grid is pinned to October and December 2026 with "today"
 * on Monday 19 October:
 *
 * - every flokkur meets weekly, and two share Tuesday (a 2-entry day);
 * - Tuesday 20 has four entries, Wednesday 28 has five;
 * - troop-wide events of every type: skipulagsfundur, sveitarfundur, útilega, dagsferð;
 * - a long troop-wide title on today and a long flokkur title on Thursday 29;
 * - the first half of the month is past and confirmed; status decays with distance after
 *   today, the way A8 (progressive detailing) expects;
 * - December is the quiet month.
 *
 * Same `PlanGrid` contract as the real component, so "Current" renders from it too.
 */
import { countIs, formatIcelandicDayMonth } from "@/lib/format";
import { formatClock } from "@/components/plan/planEntries";
import {
  STATUS_LABEL,
  type EventType,
  type Patrol,
  type PlanBand,
  type PlanCell,
  type PlanGrid,
  type PlanStatus,
  type PlanWeek,
} from "@/services/plan.service";

export const LAB_TODAY = new Date(2026, 9, 19);
export const BUSY_MONTH = new Date(2026, 9, 1);
export const QUIET_MONTH = new Date(2026, 11, 1);

export const LAB_PATROLS: Patrol[] = [
  { id: "lab-refir", name: "Refir", accent: "rekkar" },
  { id: "lab-ernir", name: "Ernir", accent: "drekar" },
  { id: "lab-uglur", name: "Uglur", accent: "falkar" },
  { id: "lab-birnir", name: "Birnir", accent: "drott" },
];

/**
 * Genitive plural of each flokkur, for "Flokksfundur Arna". `Patrol` has no such field, so a
 * name missing here falls back to "Flokksfundur (Nafn)" rather than a wrong inflection.
 */
const PATROL_GENITIVE: Record<string, string> = {
  Refir: "Refa",
  Ernir: "Arna",
  Uglur: "Uglna",
  Birnir: "Bjarna",
};

export const TYPE_LABEL: Record<EventType, string> = {
  skipulags: "Skipulagsfundur",
  sveitar: "Sveitarfundur",
  flokks: "Flokksfundur",
  uppskeru: "Uppskeruhátíð",
  utilega: "Útilega",
  dagsferd: "Dagsferð",
  mot: "Mót",
};

const PLANNED: Record<EventType, number> = {
  skipulags: 90,
  sveitar: 105,
  flokks: 90,
  uppskeru: 120,
  utilega: 48 * 60,
  dagsferd: 6 * 60,
  mot: 8 * 60,
};

type Spec = {
  /** Day of the month, in `month` (0-based) of 2026. */
  month: number;
  day: number;
  time: string;
  title: string;
  type: EventType;
  status: PlanStatus;
  venue: string;
  /** Absent for a troop-wide event. */
  patrol?: string;
  /** Minutes over (positive) or under the budget. */
  drift?: number;
};

const OCT = 9;
const DEC = 11;

const SPECS: Spec[] = [
  // ── Troop-wide ──
  {
    month: OCT,
    day: 5,
    time: "20:00",
    title: "Skipulagsfundur foringja",
    type: "skipulags",
    status: "confirmed",
    venue: "Skátaheimilið",
  },
  {
    month: OCT,
    day: 14,
    time: "19:30",
    title: "Sveitarfundur: haustvarðeldur",
    type: "sveitar",
    status: "confirmed",
    venue: "Elliðaárdalur",
  },
  {
    month: OCT,
    day: 19,
    time: "20:00",
    title: "Undirbúningsfundur flokksforingjaráðs vegna landsmótsþátttöku sumarsins",
    type: "skipulags",
    status: "draft",
    venue: "Skátaheimilið",
    drift: 15,
  },
  {
    month: OCT,
    day: 23,
    time: "17:00",
    title: "Haustútilega á Úlfljótsvatni",
    type: "utilega",
    status: "draft",
    venue: "Úlfljótsvatn",
  },
  {
    month: OCT,
    day: 28,
    time: "18:00",
    title: "Foreldrakynning",
    type: "sveitar",
    status: "tentative",
    venue: "Félagsheimilið",
  },
  {
    month: OCT,
    day: 28,
    time: "20:30",
    title: "Skipulagsfundur foringja",
    type: "skipulags",
    status: "draft",
    venue: "Skátaheimilið",
  },
  {
    month: OCT,
    day: 31,
    time: "10:00",
    title: "Dagsferð á Esju",
    type: "dagsferd",
    status: "tentative",
    venue: "Esja",
  },

  // ── Refir, Tuesdays 17:30 ──
  {
    month: OCT,
    day: 6,
    time: "17:30",
    title: "Hnútar og bönd",
    type: "flokks",
    status: "confirmed",
    venue: "Skátaheimilið",
    patrol: "lab-refir",
  },
  {
    month: OCT,
    day: 13,
    time: "17:30",
    title: "Eldamennska á prímus",
    type: "flokks",
    status: "confirmed",
    venue: "Skátaheimilið",
    patrol: "lab-refir",
    drift: 10,
  },
  {
    month: OCT,
    day: 20,
    time: "17:30",
    title: "Kortalestur og GPS",
    type: "flokks",
    status: "confirmed",
    venue: "Öskjuhlíð",
    patrol: "lab-refir",
  },
  {
    month: OCT,
    day: 27,
    time: "17:30",
    title: "Trönur og reipavinna",
    type: "flokks",
    status: "draft",
    venue: "Skátaheimilið",
    patrol: "lab-refir",
  },
  {
    month: OCT,
    day: 28,
    time: "17:00",
    title: "Aukafundur",
    type: "flokks",
    status: "unknown",
    venue: "Skátaheimilið",
    patrol: "lab-refir",
  },

  // ── Birnir, Tuesdays 19:30 ──
  {
    month: OCT,
    day: 6,
    time: "19:30",
    title: "Ratleikur um hverfið",
    type: "flokks",
    status: "confirmed",
    venue: "Elliðaárdalur",
    patrol: "lab-birnir",
  },
  {
    month: OCT,
    day: 13,
    time: "19:30",
    title: "Þrautabraut úti",
    type: "flokks",
    status: "confirmed",
    venue: "Öskjuhlíð",
    patrol: "lab-birnir",
  },
  {
    month: OCT,
    day: 20,
    time: "19:30",
    title: "Kvöldvaka og hróp",
    type: "flokks",
    status: "draft",
    venue: "Skátaheimilið",
    patrol: "lab-birnir",
    drift: 15,
  },
  {
    month: OCT,
    day: 27,
    time: "19:30",
    title: "Skýlisgerð úr náttúruefni",
    type: "flokks",
    status: "tentative",
    venue: "Elliðaárdalur",
    patrol: "lab-birnir",
  },

  // ── Ernir, Wednesdays 19:30 (none on the sveitarfundur week) ──
  {
    month: OCT,
    day: 7,
    time: "19:30",
    title: "Áttavitaþraut í Öskjuhlíð",
    type: "flokks",
    status: "confirmed",
    venue: "Öskjuhlíð",
    patrol: "lab-ernir",
  },
  {
    month: OCT,
    day: 20,
    time: "18:00",
    title: "Flokksráðsfundur",
    type: "flokks",
    status: "draft",
    venue: "Félagsheimilið",
    patrol: "lab-ernir",
  },
  {
    month: OCT,
    day: 21,
    time: "19:30",
    title: "Hnútar og bönd",
    type: "flokks",
    status: "draft",
    venue: "Skátaheimilið",
    patrol: "lab-ernir",
  },
  {
    month: OCT,
    day: 28,
    time: "19:30",
    title: "Undirbúningur fyrir útilegu",
    type: "flokks",
    status: "draft",
    venue: "Skátaheimilið",
    patrol: "lab-ernir",
    drift: 20,
  },

  // ── Uglur, Thursdays 18:00 ──
  {
    month: OCT,
    day: 1,
    time: "18:00",
    title: "Umhverfisverkefni í hverfinu",
    type: "flokks",
    status: "confirmed",
    venue: "Elliðaárdalur",
    patrol: "lab-uglur",
  },
  {
    month: OCT,
    day: 8,
    time: "18:00",
    title: "Eldamennska á prímus",
    type: "flokks",
    status: "confirmed",
    venue: "Skátaheimilið",
    patrol: "lab-uglur",
  },
  {
    month: OCT,
    day: 15,
    time: "18:00",
    title: "Ratleikur um hverfið",
    type: "flokks",
    status: "confirmed",
    venue: "Öskjuhlíð",
    patrol: "lab-uglur",
  },
  {
    month: OCT,
    day: 20,
    time: "20:00",
    title: "Kortalestur og GPS",
    type: "flokks",
    status: "tentative",
    venue: "Skátaheimilið",
    patrol: "lab-uglur",
  },
  {
    month: OCT,
    day: 28,
    time: "16:30",
    title: "Hjálp í viðlögum (1/2)",
    type: "flokks",
    status: "unknown",
    venue: "Skátaheimilið",
    patrol: "lab-uglur",
  },
  {
    month: OCT,
    day: 29,
    time: "18:00",
    title: "Skyndihjálparþjálfun með endurlífgunarbrúðum og sáraumbúðum",
    type: "flokks",
    status: "tentative",
    venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
    patrol: "lab-uglur",
  },

  // ── December: the quiet month ──
  {
    month: DEC,
    day: 1,
    time: "17:30",
    title: "Jólaföndur",
    type: "flokks",
    status: "tentative",
    venue: "Skátaheimilið",
    patrol: "lab-refir",
  },
  {
    month: DEC,
    day: 9,
    time: "19:30",
    title: "Jólafundur sveitarinnar",
    type: "sveitar",
    status: "unknown",
    venue: "Félagsheimilið",
  },
  {
    month: DEC,
    day: 12,
    time: "16:00",
    title: "Litlu jól skátanna",
    type: "uppskeru",
    status: "unknown",
    venue: "Skátaheimilið",
  },
  {
    month: DEC,
    day: 15,
    time: "19:30",
    title: "Kakó og kvöldvaka",
    type: "flokks",
    status: "unknown",
    venue: "Skátaheimilið",
    patrol: "lab-birnir",
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Monday of the ISO week a date falls in. */
function mondayOf(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekday);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Weeks from the Monday before 1 October to the end of December 2026. */
function buildWeeks(): PlanWeek[] {
  const first = mondayOf(new Date(2026, 8, 28));
  return Array.from({ length: 14 }, (_, i) => ({
    index: i + 1,
    starts_on: isoDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i)),
    label: `Vika ${i + 1}`,
    note: null,
  }));
}

function weekIndexOf(date: Date): number {
  const first = mondayOf(new Date(2026, 8, 28));
  return Math.floor((mondayOf(date).getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
}

/** The lab grid: both months, every hard case on a fixed day. */
export function labGrid(): PlanGrid {
  const bands: PlanBand[] = [];
  const cells: PlanCell[] = [];

  SPECS.forEach((spec, i) => {
    const day = new Date(2026, spec.month, spec.day);
    const planned = PLANNED[spec.type];
    const hasLidir = spec.type === "flokks" || spec.type === "sveitar";
    const base = {
      event_id: `lab-${i}`,
      week_index: weekIndexOf(day),
      title: spec.title,
      status: spec.status,
      type: spec.type,
      span_weeks: 1,
      starts_at: `${isoDate(day)}T${spec.time}:00`,
      planned_minutes: planned,
      actual_minutes: planned + (spec.drift ?? 0),
      venue: spec.venue,
      item_count: hasLidir ? 5 : 0,
      // The real chip draws these as its liðir bar; "Current" needs them to look like itself.
      segments: hasLidir
        ? [
            { kind: "setning" as const, minutes: 10 },
            { kind: "dagskra" as const, minutes: Math.max(10, planned + (spec.drift ?? 0) - 45) },
            { kind: "leikur" as const, minutes: 20 },
            { kind: "slit" as const, minutes: 10 },
            { kind: "endurmat" as const, minutes: 5 },
          ]
        : [],
    };
    if (spec.patrol) cells.push({ ...base, patrol_id: spec.patrol });
    else bands.push(base);
  });

  return { season_id: "lab-season", patrols: LAB_PATROLS, weeks: buildWeeks(), bands, cells };
}

/* ── What each look is handed: one entry, already placed and judged ── */

export type LabEntry = {
  id: string;
  title: string;
  type: EventType;
  status: PlanStatus;
  /** `HH:MM`, or null when the entry has no time. */
  clock: string | null;
  venue: string | null;
  day: Date;
  /** Absent on a troop-wide event. */
  patrol?: Patrol;
  /** The `--sl-color-patrol-*` base name, e.g. `--sl-color-patrol-rekkar`. Absent when troop-wide. */
  patrolVar?: string;
  troopWide: boolean;
  /** Minutes over budget, 0 when on or under it. */
  overMinutes: number;
  /** The day is before today. */
  past: boolean;
};

function isBeforeDay(a: Date, b: Date): boolean {
  return (
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() <
    new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  );
}

/** Every dated entry in the grid as a `LabEntry`, in time order within a day. */
export function placeEntries(data: PlanGrid, today: Date): LabEntry[] {
  const toLab = (entry: PlanBand | PlanCell, patrol: Patrol | undefined): LabEntry | null => {
    if (!entry.starts_at) return null;
    const [year, month, day] = entry.starts_at.slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const over = (entry.actual_minutes ?? 0) - (entry.planned_minutes ?? Infinity);
    return {
      id: entry.event_id,
      title: entry.title,
      type: entry.type,
      status: entry.status,
      clock: formatClock(entry.starts_at),
      venue: entry.venue ?? null,
      day: date,
      patrol,
      patrolVar: patrol ? `--sl-color-patrol-${patrol.accent ?? "adrir"}` : undefined,
      troopWide: !patrol,
      overMinutes: over > 0 ? over : 0,
      past: isBeforeDay(date, today),
    };
  };

  const all = [
    ...data.bands.map((band) => toLab(band, undefined)),
    ...data.cells.map((cell) =>
      toLab(
        cell,
        data.patrols.find((p) => p.id === cell.patrol_id)
      )
    ),
  ].filter((e): e is LabEntry => e !== null);

  return all.sort((a, b) => (a.clock ?? "").localeCompare(b.clock ?? ""));
}

/** "Flokksfundur Arna", "Sveitarfundur", "Útilega": what kind of thing, and whose. */
export function kindPhrase(entry: LabEntry): string {
  if (!entry.patrol) return TYPE_LABEL[entry.type];
  const genitive = PATROL_GENITIVE[entry.patrol.name];
  return genitive
    ? `${TYPE_LABEL[entry.type]} ${genitive}`
    : `${TYPE_LABEL[entry.type]} (${entry.patrol.name})`;
}

/**
 * The accessible name every look gives its entry button:
 * "Flokksfundur Arna: Hnútar og bönd, 21. október kl. 19:30, Skátaheimilið, drög".
 */
export function entryName(entry: LabEntry): string {
  const parts = [
    `${kindPhrase(entry)}${entry.troopWide ? ", öll sveitin" : ""}: ${entry.title}`,
    `${formatIcelandicDayMonth(entry.day)}${entry.clock ? ` kl. ${entry.clock}` : ""}`,
  ];
  if (entry.venue) parts.push(entry.venue);
  parts.push(STATUS_LABEL[entry.status].toLowerCase());
  if (entry.overMinutes > 0)
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  if (entry.past) parts.push("lokið");
  return parts.join(", ");
}

/** The first letter of a flokkur, for the places a whole name will not fit. */
export function patrolInitial(entry: LabEntry): string {
  return entry.patrol ? entry.patrol.name.charAt(0).toUpperCase() : "S";
}
