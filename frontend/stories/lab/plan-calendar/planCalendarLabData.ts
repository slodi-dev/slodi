/**
 * Fixtures and helpers for the PlanCalendar day-entry lab (the Staða family).
 *
 * ## A month is a rhythm plus exceptions
 *
 * A sveit almost always meets the same way every week: each flokkur on its own weekday at its
 * own time. Around that rhythm sit the exceptions: a fös–sun útilega, a laugardags dagsferð, a
 * mót, a fundur moved because of a sveitarfundur, a week that falls out (vetrarfrí). The fixture
 * is built the same way: a weekly rule per flokkur generates the fundir, then the exceptions are
 * laid over it.
 *
 * Pinned to autumn 2026 with "today" on mánudagur 19. október, so the hard cases stay put:
 *
 * - Refir mán 17:30, Ernir þri 19:30, Uglur mið 19:30, Birnir fim 18:00;
 * - sveitarfundur mið 14. okt., so Uglur's fundur that week is **moved** to fim 15. okt.;
 * - laugardags **dagsferð** 17. okt.;
 * - **vetrarfrí** 22.–26. okt.: Birnir (fim 22.) and Refir (mán 26.) **fall out**;
 * - **Vetrarmót** lau 24.–mán 26. okt.: a span that **crosses a week row**;
 * - **Haustútilega** fös 30. okt.–sun 1. nóv.: the fös–sun span, running into November;
 * - mið 28. okt. has four entries (the fold), mán 19. okt. a long troop-wide title;
 * - status decays with distance from today (A8): past staðfest, this week drög, then óvíst, then "?";
 * - December is quiet: two weeks of fundir, litlu jól, then jólafrí.
 *
 * ## Fields the contract does not have yet
 *
 * `ends_at` (multi-day events) and `cancelled` (a fundur that falls out) are lab-only
 * extensions on top of `PlanCell`/`PlanBand`. The weekly rule is *derived* from the fundir
 * (the most common weekday and time per flokkur), because nothing in the contract declares it.
 * See the Rationale page for what the backend would need.
 */
import { countIs, formatIcelandicDateShort, formatIcelandicDayMonth } from "@/lib/format";
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

/** Mánudagur-first weekday names. */
export const WEEKDAY_SHORT = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];
export const WEEKDAY_FULL = [
  "mánudagur",
  "þriðjudagur",
  "miðvikudagur",
  "fimmtudagur",
  "föstudagur",
  "laugardagur",
  "sunnudagur",
];

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/* ── The lab's contract extensions ── */

/** A cell or band as the lab needs it: the contract, plus an end and a "falls out" mark. */
type LabExtras = {
  /** Multi-day events: when it ends, as a local ISO datetime. Not in the contract. */
  ends_at?: string | null;
  /** The fundur falls out, with the reason shown. Not in the contract. */
  cancelled?: { reason: string } | null;
};
export type LabCell = PlanCell & LabExtras;
export type LabBand = PlanBand & LabExtras;
export type LabGrid = Omit<PlanGrid, "bands" | "cells"> & { bands: LabBand[]; cells: LabCell[] };

/* ── Building the fixture ── */

/** Each flokkur's weekly rule: the fixture's source, *not* data the views may read. */
const RULES: { patrol: string; weekday: number; time: string; venue: string }[] = [
  { patrol: "lab-refir", weekday: 0, time: "17:30", venue: "Skátaheimilið" },
  { patrol: "lab-ernir", weekday: 1, time: "19:30", venue: "Skátaheimilið" },
  { patrol: "lab-uglur", weekday: 2, time: "19:30", venue: "Félagsheimilið" },
  { patrol: "lab-birnir", weekday: 3, time: "18:00", venue: "Skátaheimilið" },
];

const TITLES = [
  "Hnútar og bönd",
  "Áttavitaþraut í Öskjuhlíð",
  "Eldamennska á prímus",
  "Ratleikur um hverfið",
  "Kortalestur og GPS",
  "Trönur og reipavinna",
  "Undirbúningur fyrir útilegu",
  "Þrautabraut úti",
  "Kvöldvaka og hróp",
  "Umhverfisverkefni í hverfinu",
  "Skýlisgerð úr náttúruefni",
  "Bátar og björgunarvesti",
];

/** The theme each title belongs to, which the stamp look draws as its icon. */
const THEME_OF: Record<string, string> = {
  "Hnútar og bönd": "Útilíf",
  "Áttavitaþraut í Öskjuhlíð": "Ratleikni",
  "Eldamennska á prímus": "Útilíf",
  "Ratleikur um hverfið": "Ratleikni",
  "Kortalestur og GPS": "Ratleikni",
  "Trönur og reipavinna": "Útilíf",
  "Undirbúningur fyrir útilegu": "Útilíf",
  "Þrautabraut úti": "Hreyfing",
  "Kvöldvaka og hróp": "Hefðir",
  "Umhverfisverkefni í hverfinu": "Umhyggja",
  "Skýlisgerð úr náttúruefni": "Útilíf",
  "Bátar og björgunarvesti": "Sjómennska",
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

/** Fundir run from the Monday before 1 October to the start of jólafrí. */
const RHYTHM_FROM = new Date(2026, 8, 28);
const RHYTHM_TO = new Date(2026, 11, 13);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week a date falls in. */
export function mondayOf(date: Date): Date {
  return addDays(date, -weekdayOf(date));
}

/** A8: what is behind us is decided, what is far ahead is still a "?". */
function statusFor(date: Date): PlanStatus {
  if (date < LAB_TODAY) return "confirmed";
  if (date <= new Date(2026, 9, 25)) return "draft";
  if (date <= new Date(2026, 10, 8)) return "tentative";
  return "unknown";
}

/** Rhythm overrides: one fundur moved, two falling out, a few with their own details. */
type Override = Partial<{
  move: { date: Date; time: string };
  cancelled: string;
  title: string;
  status: PlanStatus;
  drift: number;
  venue: string;
}>;
const OVERRIDES: Record<string, Override> = {
  // Moved off its Wednesday by the sveitarfundur.
  "lab-uglur 2026-10-14": { move: { date: new Date(2026, 9, 15), time: "19:30" } },
  "lab-birnir 2026-10-22": { cancelled: "vetrarfrí" },
  "lab-refir 2026-10-26": { cancelled: "vetrarfrí" },
  "lab-ernir 2026-10-20": { status: "confirmed", drift: 15 },
  "lab-uglur 2026-10-21": { title: "Hnútar og bönd" },
  "lab-uglur 2026-10-28": {
    title: "Skyndihjálparþjálfun með endurlífgunarbrúðum og sáraumbúðum",
    venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
  },
  "lab-birnir 2026-10-29": { drift: 20 },
  // A sveitarfundur on Uglur's evening in December.
  "lab-uglur 2026-12-09": { cancelled: "jólafundur sveitarinnar" },
};

type Event = {
  title: string;
  type: EventType;
  start: Date;
  time: string;
  end?: { date: Date; time: string };
  venue: string;
  status?: PlanStatus;
  /** Present for an extra (non-rhythm) flokksfundur. */
  patrol?: string;
  drift?: number;
};

const EVENTS: Event[] = [
  {
    title: "Skipulagsfundur foringja",
    type: "skipulags",
    start: new Date(2026, 9, 5),
    time: "20:00",
    venue: "Skátaheimilið",
  },
  {
    title: "Sveitarfundur: haustvarðeldur",
    type: "sveitar",
    start: new Date(2026, 9, 14),
    time: "19:30",
    venue: "Elliðaárdalur",
  },
  {
    title: "Dagsferð á Esju",
    type: "dagsferd",
    start: new Date(2026, 9, 17),
    time: "10:00",
    end: { date: new Date(2026, 9, 17), time: "16:00" },
    venue: "Esja",
  },
  {
    title: "Undirbúningsfundur flokksforingjaráðs vegna landsmótsþátttöku sumarsins",
    type: "skipulags",
    start: new Date(2026, 9, 19),
    time: "20:00",
    venue: "Skátaheimilið",
    drift: 15,
  },
  {
    title: "Vetrarmót skátafélaganna",
    type: "mot",
    start: new Date(2026, 9, 24),
    time: "10:00",
    end: { date: new Date(2026, 9, 26), time: "15:00" },
    venue: "Hafravatn",
  },
  {
    title: "Foreldrakynning",
    type: "sveitar",
    start: new Date(2026, 9, 28),
    time: "18:00",
    venue: "Félagsheimilið",
  },
  {
    title: "Skipulagsfundur foringja",
    type: "skipulags",
    start: new Date(2026, 9, 28),
    time: "21:00",
    venue: "Skátaheimilið",
    status: "draft",
  },
  {
    title: "Aukafundur fyrir útilegu",
    type: "flokks",
    patrol: "lab-refir",
    start: new Date(2026, 9, 28),
    time: "17:00",
    venue: "Skátaheimilið",
    status: "unknown",
  },
  {
    title: "Haustútilega á Úlfljótsvatni",
    type: "utilega",
    start: new Date(2026, 9, 30),
    time: "17:00",
    end: { date: new Date(2026, 10, 1), time: "14:00" },
    venue: "Úlfljótsvatn",
    status: "draft",
  },
  {
    title: "Dagsferð í Heiðmörk",
    type: "dagsferd",
    start: new Date(2026, 10, 21),
    time: "10:00",
    end: { date: new Date(2026, 10, 21), time: "15:00" },
    venue: "Heiðmörk",
  },
  {
    title: "Jólafundur sveitarinnar",
    type: "sveitar",
    start: new Date(2026, 11, 9),
    time: "19:30",
    venue: "Félagsheimilið",
  },
  {
    title: "Litlu jól skátanna",
    type: "uppskeru",
    start: new Date(2026, 11, 12),
    time: "16:00",
    venue: "Skátaheimilið",
  },
];

/** Weeks from 28 September to the end of December; notes carry the breaks. */
function buildWeeks(): PlanWeek[] {
  const notes: Record<string, string> = {
    "2026-10-19": "Vetrarfrí í skólum 22.–26. okt.",
    "2026-10-26": "Vetrarfrí í skólum 22.–26. okt.",
    "2026-12-14": "Jólafrí: engir fundir fram yfir áramót",
    "2026-12-21": "Jólafrí",
    "2026-12-28": "Jólafrí",
  };
  return Array.from({ length: 14 }, (_, i) => {
    const monday = addDays(RHYTHM_FROM, 7 * i);
    return {
      index: i + 1,
      starts_on: isoDate(monday),
      label: `Vika ${i + 1}`,
      note: notes[isoDate(monday)] ?? null,
    };
  });
}

function weekIndexOf(date: Date): number {
  return Math.floor((mondayOf(date).getTime() - RHYTHM_FROM.getTime()) / (7 * 86_400_000)) + 1;
}

function detailFor(type: EventType, drift = 0) {
  const planned = PLANNED[type];
  const hasLidir = type === "flokks" || type === "sveitar";
  const actual = planned + drift;
  return {
    planned_minutes: planned,
    actual_minutes: actual,
    item_count: hasLidir ? 5 : 0,
    // The real chip draws these as its liðir bar; "Current" needs them to look like itself.
    segments: hasLidir
      ? [
          { kind: "setning" as const, minutes: 10 },
          { kind: "dagskra" as const, minutes: Math.max(10, actual - 45) },
          { kind: "leikur" as const, minutes: 20 },
          { kind: "slit" as const, minutes: 10 },
          { kind: "endurmat" as const, minutes: 5 },
        ]
      : [],
  };
}

/** The lab grid: the weekly rhythm, then the exceptions over it. */
export function labGrid(): LabGrid {
  const cells: LabCell[] = [];
  const bands: LabBand[] = [];

  RULES.forEach((rule, ruleIndex) => {
    let n = 0;
    for (let monday = RHYTHM_FROM; monday <= RHYTHM_TO; monday = addDays(monday, 7)) {
      const day = addDays(monday, rule.weekday);
      if (day > RHYTHM_TO) break;
      const o = OVERRIDES[`${rule.patrol} ${isoDate(day)}`] ?? {};
      const date = o.move?.date ?? day;
      const title = o.title ?? TITLES[(n + ruleIndex * 3) % TITLES.length];
      n++;
      cells.push({
        event_id: `lab-${rule.patrol}-${isoDate(day)}`,
        week_index: weekIndexOf(date),
        patrol_id: rule.patrol,
        title,
        status: o.status ?? statusFor(date),
        type: "flokks",
        span_weeks: 1,
        starts_at: `${isoDate(date)}T${o.move?.time ?? rule.time}:00`,
        venue: o.venue ?? rule.venue,
        theme: THEME_OF[title] ?? "Útilíf",
        cancelled: o.cancelled ? { reason: o.cancelled } : null,
        ...detailFor("flokks", o.drift),
      });
    }
  });

  EVENTS.forEach((event, i) => {
    const base = {
      event_id: `lab-event-${i}`,
      week_index: weekIndexOf(event.start),
      title: event.title,
      status: event.status ?? statusFor(event.start),
      type: event.type,
      span_weeks: 1,
      starts_at: `${isoDate(event.start)}T${event.time}:00`,
      ends_at: event.end ? `${isoDate(event.end.date)}T${event.end.time}:00` : null,
      venue: event.venue,
      ...detailFor(event.type, event.drift),
    };
    if (event.patrol) cells.push({ ...base, patrol_id: event.patrol });
    else bands.push(base);
  });

  return { season_id: "lab-season", patrols: LAB_PATROLS, weeks: buildWeeks(), bands, cells };
}

/**
 * The grid as the real component can take it today: the contract has no "falls out", so a
 * cancelled fundur is simply deleted, and a multi-day event is only its first day.
 */
export function currentGrid(): PlanGrid {
  const data = labGrid();
  return { ...data, cells: data.cells.filter((c) => !c.cancelled) };
}

/* ── The weekly rhythm, derived ── */

export type Rhythm = { patrol: Patrol; weekday: number; clock: string };

/**
 * Each flokkur's usual weekday and time: the most common pair among its fundir. Derived because
 * the contract has no recurrence rule. A flokkur with no clear habit gets none.
 */
export function deriveRhythms(data: LabGrid): Rhythm[] {
  return data.patrols.flatMap((patrol) => {
    const counts = new Map<string, number>();
    for (const cell of data.cells) {
      if (cell.patrol_id !== patrol.id || !cell.starts_at || cell.cancelled) continue;
      const key = `${weekdayOf(parseDay(cell.starts_at))} ${formatClock(cell.starts_at)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 3) return [];
    const [weekday, clock] = best[0].split(" ");
    return [{ patrol, weekday: Number(weekday), clock }];
  });
}

/* ── What each look is handed: one entry, already placed and judged ── */

export type EntryKind =
  /** The flokkur's usual fundur on its usual evening. */
  | "routine"
  /** Anything else on one day: a troop event, an extra or moved fundur. */
  | "exception"
  /** A flokksfundur that falls out. */
  | "cancelled"
  /** Runs over more than one day. */
  | "span";

export type LabEntry = {
  id: string;
  title: string;
  type: EventType;
  status: PlanStatus;
  kind: EntryKind;
  clock: string | null;
  venue: string | null;
  theme: string | null;
  day: Date;
  /** Last day, for a span. Equal to `day` otherwise. */
  endDay: Date;
  /** Days covered, 1 unless a span. */
  spanDays: number;
  patrol?: Patrol;
  /** The `--sl-color-patrol-*` base name. Absent when troop-wide. */
  patrolVar?: string;
  troopWide: boolean;
  /** The flokkur's usual day, when this fundur was moved off it (inferred). */
  movedFrom?: Date;
  /** Why it falls out, when cancelled. */
  cancelledReason?: string;
  overMinutes: number;
  /** The last day is before today. */
  past: boolean;
};

function parseDay(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayKey(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Every dated entry as a `LabEntry`, in time order. */
export function placeEntries(data: LabGrid, today: Date): LabEntry[] {
  const rhythms = new Map(deriveRhythms(data).map((r) => [r.patrol.id, r]));

  /** Did this flokkur have anything (even a cancelled fundur) on its usual day that week? */
  const onUsualDay = (patrolId: string, date: Date): boolean => {
    const rhythm = rhythms.get(patrolId);
    if (!rhythm) return true;
    const usual = dayKey(addDays(mondayOf(date), rhythm.weekday));
    return data.cells.some(
      (c) => c.patrol_id === patrolId && c.starts_at && dayKey(parseDay(c.starts_at)) === usual
    );
  };

  const toLab = (entry: LabCell | LabBand, patrol: Patrol | undefined): LabEntry | null => {
    if (!entry.starts_at) return null;
    const day = parseDay(entry.starts_at);
    const endDay = entry.ends_at ? parseDay(entry.ends_at) : day;
    const spanDays = Math.round((dayKey(endDay) - dayKey(day)) / 86_400_000) + 1;
    const clock = formatClock(entry.starts_at);
    const rhythm = patrol ? rhythms.get(patrol.id) : undefined;
    const isUsual = Boolean(rhythm && rhythm.weekday === weekdayOf(day) && rhythm.clock === clock);

    let kind: EntryKind = "exception";
    if (entry.cancelled) kind = "cancelled";
    else if (spanDays > 1) kind = "span";
    else if (isUsual) kind = "routine";

    const movedFrom =
      patrol && rhythm && kind === "exception" && !onUsualDay(patrol.id, day)
        ? addDays(mondayOf(day), rhythm.weekday)
        : undefined;

    const over = (entry.actual_minutes ?? 0) - (entry.planned_minutes ?? Infinity);
    return {
      id: entry.event_id,
      title: entry.title,
      type: entry.type,
      status: entry.status,
      kind,
      clock,
      venue: entry.venue ?? null,
      theme: entry.theme ?? null,
      day,
      endDay,
      spanDays,
      patrol,
      patrolVar: patrol ? `--sl-color-patrol-${patrol.accent ?? "adrir"}` : undefined,
      troopWide: !patrol,
      movedFrom,
      cancelledReason: entry.cancelled?.reason,
      overMinutes: over > 0 ? over : 0,
      past: dayKey(endDay) < dayKey(today),
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

  return all.sort(
    (a, b) => dayKey(a.day) - dayKey(b.day) || (a.clock ?? "").localeCompare(b.clock ?? "")
  );
}

/** Does the entry cover this day? */
export function coversDay(entry: LabEntry, date: Date): boolean {
  const k = dayKey(date);
  return k >= dayKey(entry.day) && k <= dayKey(entry.endDay);
}

/** 1-based position of a day inside a span: "dagur 2 af 3". */
export function dayOfSpan(entry: LabEntry, date: Date): number {
  return Math.round((dayKey(date) - dayKey(entry.day)) / 86_400_000) + 1;
}

/** "fös 30. okt.–sun 1. nóv." */
export function spanRange(entry: LabEntry): string {
  const at = (d: Date) => `${WEEKDAY_SHORT[weekdayOf(d)]} ${formatIcelandicDateShort(d)}`;
  return `${at(entry.day)}–${at(entry.endDay)}`;
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
 * The accessible name every look gives its entry button.
 *
 * - "Flokksfundur Arna: Hnútar og bönd, 20. október kl. 19:30, Skátaheimilið, staðfest"
 * - "Haustútilega á Úlfljótsvatni, fös 30. okt.–sun 1. nóv., öll sveitin, Úlfljótsvatn, drög"
 * - "Flokksfundur Bjarna fellur niður, 22. október: vetrarfrí"
 */
export function entryName(entry: LabEntry): string {
  if (entry.kind === "cancelled") {
    return `${kindPhrase(entry)} fellur niður, ${formatIcelandicDayMonth(entry.day)}${
      entry.cancelledReason ? `: ${entry.cancelledReason}` : ""
    }`;
  }
  const parts =
    entry.kind === "span"
      ? [entry.title, spanRange(entry), entry.patrol ? entry.patrol.name : "öll sveitin"]
      : [
          `${kindPhrase(entry)}${entry.troopWide ? ", öll sveitin" : ""}: ${entry.title}`,
          `${formatIcelandicDayMonth(entry.day)}${entry.clock ? ` kl. ${entry.clock}` : ""}`,
        ];
  if (entry.venue) parts.push(entry.venue);
  parts.push(STATUS_LABEL[entry.status].toLowerCase());
  if (entry.movedFrom) parts.push(`fært frá ${formatIcelandicDayMonth(entry.movedFrom)}`);
  if (entry.overMinutes > 0)
    parts.push(`${countIs(entry.overMinutes, "mínúta", "mínútur")} umfram`);
  if (entry.past) parts.push("lokið");
  return parts.join(", ");
}

/** The first letter of a flokkur; "S" for the whole sveit. */
export function patrolInitial(entry: LabEntry): string {
  return entry.patrol ? entry.patrol.name.charAt(0).toUpperCase() : "S";
}
