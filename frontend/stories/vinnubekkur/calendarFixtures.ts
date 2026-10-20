/**
 * The Dagatal's story fixture: a sveit's autumn as a weekly rhythm plus exceptions.
 *
 * A sveit almost always meets the same way every week: each flokkur on its own weekday at its
 * own time. Around that rhythm sit the exceptions. The fixture is built the same way: a weekly
 * rule per flokkur generates the fundir, then the exceptions are laid over it.
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
 * It uses the contract's proposed `ends_at`, `cancelled` and `Patrol.name_genitive` (sc-646).
 */
import { addDays, mondayOf } from "@/components/plan/calendar/calendarEntries";
import type {
  EventType,
  Patrol,
  PlanBand,
  PlanCell,
  PlanGrid,
  PlanStatus,
  PlanWeek,
} from "@/services/plan.service";

export const CALENDAR_TODAY = new Date(2026, 9, 19);
export const BUSY_MONTH = new Date(2026, 9, 1);
export const QUIET_MONTH = new Date(2026, 11, 1);

export const CALENDAR_PATROLS: Patrol[] = [
  { id: "cal-refir", name: "Refir", name_genitive: "Refa", accent: "rekkar" },
  { id: "cal-ernir", name: "Ernir", name_genitive: "Arna", accent: "drekar" },
  { id: "cal-uglur", name: "Uglur", name_genitive: "Uglna", accent: "falkar" },
  { id: "cal-birnir", name: "Birnir", name_genitive: "Bjarna", accent: "drott" },
];

/* ── Building the fixture ── */

/** Each flokkur's weekly rule: the fixture's source, *not* data the views may read. */
const RULES: { patrol: string; weekday: number; time: string; venue: string }[] = [
  { patrol: "cal-refir", weekday: 0, time: "17:30", venue: "Skátaheimilið" },
  { patrol: "cal-ernir", weekday: 1, time: "19:30", venue: "Skátaheimilið" },
  { patrol: "cal-uglur", weekday: 2, time: "19:30", venue: "Félagsheimilið" },
  { patrol: "cal-birnir", weekday: 3, time: "18:00", venue: "Skátaheimilið" },
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

/** A8: what is behind us is decided, what is far ahead is still a "?". */
function statusFor(date: Date): PlanStatus {
  if (date < CALENDAR_TODAY) return "confirmed";
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
  "cal-uglur 2026-10-14": { move: { date: new Date(2026, 9, 15), time: "19:30" } },
  "cal-birnir 2026-10-22": { cancelled: "vetrarfrí" },
  "cal-refir 2026-10-26": { cancelled: "vetrarfrí" },
  "cal-ernir 2026-10-20": { status: "confirmed", drift: 15 },
  "cal-uglur 2026-10-21": { title: "Hnútar og bönd" },
  "cal-uglur 2026-10-28": {
    title: "Skyndihjálparþjálfun með endurlífgunarbrúðum og sáraumbúðum",
    venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
  },
  "cal-birnir 2026-10-29": { drift: 20 },
  // A sveitarfundur on Uglur's evening in December.
  "cal-uglur 2026-12-09": { cancelled: "jólafundur sveitarinnar" },
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
    patrol: "cal-refir",
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

/** The fixture grid: the weekly rhythm, then the exceptions over it. */
export function calendarGrid(): PlanGrid {
  const cells: PlanCell[] = [];
  const bands: PlanBand[] = [];

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
        event_id: `cal-${rule.patrol}-${isoDate(day)}`,
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
      event_id: `cal-event-${i}`,
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

  return { season_id: "cal-season", patrols: CALENDAR_PATROLS, weeks: buildWeeks(), bands, cells };
}
