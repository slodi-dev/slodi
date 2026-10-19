import type {
  EventType,
  PlanBand,
  PlanCell,
  PlanGrid,
  PlanSegment,
  PlanWeek,
  Patrol,
  PlanStatus,
  Season,
} from "@/services/plan.service";

/**
 * Fixture data for the planner views, used only in mock mode.
 *
 * See lib/mock/mock-mode.ts for how this is switched on and why it cannot ship
 * live. What matters here is that the shape is the *contract*, not a
 * convenience: these are the same `Season` and `PlanGrid` types the service
 * returns, so a view that renders correctly against this fixture renders
 * correctly against the API when it lands. If the backend ships a shape this
 * file cannot satisfy, that is the contract drifting and worth knowing early.
 *
 * ## Why it is anchored to today
 *
 * The rolling window (A7) and the timeline (A4) both split on "is this week
 * over?", so a fixture with hard-coded dates demonstrates one half of them and
 * eventually neither. Weeks are generated around the current Monday instead:
 * seven behind, twelve ahead. `CURRENT_WEEK` is where the fixture puts "now".
 *
 * ## Why the statuses ramp
 *
 * A8 (sc-43) is progressive detailing — the skeleton goes in early and the
 * detail lands just in time. The fixture ramps `confirmed → draft → tentative →
 * unknown` with distance from today so that behaviour is visible standing
 * still, rather than needing someone to hand-edit a status to see the "?".
 */

const WEEK_COUNT = 20;
const CURRENT_WEEK = 8;

/** Named so a screenshot of the season switcher is self-labelling. */
export const MOCK_SEASON_ID = "mock-season-starfsar";
export const MOCK_SCRATCHPAD_ID = "mock-season-scratchpad";

const MOCK_WORKSPACE_ID = "mock-workspace";

/**
 * A season id that only fixtures can serve.
 *
 * In auto mode the seasons list may be fake while the grid endpoint is real (or
 * the other way round). Asking the API for the grid of a season it has never
 * heard of is a guaranteed 404 and a confusing line in the network tab, so the
 * grid hook checks this instead of trying.
 */
export function isMockSeasonId(seasonId: string): boolean {
  return seasonId === MOCK_SEASON_ID || seasonId === MOCK_SCRATCHPAD_ID;
}

export const MOCK_PATROLS: Patrol[] = [
  { id: "mock-refir", name: "Refir", accent: "rekkar" },
  { id: "mock-ernir", name: "Ernir", accent: "drekar" },
  { id: "mock-uglur", name: "Uglur", accent: "falkar" },
  { id: "mock-birnir", name: "Birnir", accent: "drott" },
];

/** Notes that shape a week without being events — the hi-fi's ATH column. */
const WEEK_NOTES: Record<number, string> = {
  3: "Öskudagur — flest börn í búningum",
  6: "Vetrarfrí, hálf mæting líkleg",
  11: "Foreldrakynning í félagsheimilinu",
  16: "Páskafrí í skólum",
};

const THEMES = ["Útilíf", "Ratleikni", "Hreyfing", "Sjómennska", "Hefðir", "Umhyggja"];

const VENUES = ["Skátaheimilið", "Öskjuhlíð", "Félagsheimilið", "Elliðaárdalur"];

const NEEDS = [
  "Reipi og bönd",
  "Áttavitar",
  "Prímus og eldsneyti",
  "Sjúkrakassi",
  "Kort af hverfinu",
  "Vasaljós",
  "Merkjaefni",
];

/**
 * Which weekday each kind of event lands on, as an offset from the week's
 * Monday. A dagsferð on a Tuesday evening would read as obviously wrong to any
 * foringi looking at the calendar, and the point of the fixture is that it does
 * not read as wrong.
 */
const WEEKDAY: Record<EventType, number> = {
  skipulags: 0,
  flokks: 2,
  sveitar: 2,
  uppskeru: 2,
  utilega: 4,
  dagsferd: 5,
  mot: 5,
};

/** Start time in minutes past midnight, by kind. Evenings for fundir, mornings for ferðir. */
const START_MINUTES: Record<EventType, number> = {
  skipulags: 20 * 60,
  flokks: 19 * 60 + 30,
  sveitar: 19 * 60 + 30,
  uppskeru: 18 * 60,
  utilega: 17 * 60,
  dagsferd: 10 * 60,
  mot: 9 * 60,
};

const PLANNED_MINUTES: Record<EventType, number> = {
  skipulags: 90,
  flokks: 90,
  sveitar: 105,
  uppskeru: 120,
  utilega: 48 * 60,
  dagsferd: 6 * 60,
  mot: 8 * 60,
};

/** Weeks that belong to the whole sveit — no flokksfundur is scheduled in them. */
const BAND_WEEKS = new Set([1, 5, 9, 13, 17, 20]);

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
  "Flokksráðsfundur",
  "Skýlisgerð úr náttúruefni",
];

/** The Monday of the week `date` falls in, as a local date. */
function mondayOf(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift the date west of UTC. */
function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Detail decays with distance: what is behind us happened, what is far ahead is
 * still a "?". This is A8 made visible without anyone having to edit anything.
 */
function statusForWeek(index: number): PlanStatus {
  if (index <= CURRENT_WEEK) return "confirmed";
  if (index <= CURRENT_WEEK + 4) return "draft";
  if (index <= CURRENT_WEEK + 8) return "tentative";
  return "unknown";
}

function buildWeeks(dated: boolean): PlanWeek[] {
  const thisMonday = mondayOf(new Date());
  const firstMonday = addDays(thisMonday, -7 * (CURRENT_WEEK - 1));

  return Array.from({ length: WEEK_COUNT }, (_, i) => ({
    index: i + 1,
    starts_on: dated ? isoDate(addDays(firstMonday, 7 * i)) : null,
    label: `Vika ${i + 1}`,
    note: WEEK_NOTES[i + 1] ?? null,
  }));
}

/** The Monday of a given week index, or null on an undated season. */
function mondayOfWeek(index: number, dated: boolean): Date | null {
  if (!dated) return null;
  const thisMonday = mondayOf(new Date());
  const firstMonday = addDays(thisMonday, -7 * (CURRENT_WEEK - 1));
  return addDays(firstMonday, 7 * (index - 1));
}

/** Local ISO datetime — see isoDate on why not `toISOString`. */
function isoDateTime(day: Date, minutesPastMidnight: number): string {
  const hour = String(Math.floor(minutesPastMidnight / 60)).padStart(2, "0");
  const minute = String(minutesPastMidnight % 60).padStart(2, "0");
  return `${isoDate(day)}T${hour}:${minute}:00`;
}

/**
 * The optional half of an entry — time, budget, theme, kit.
 *
 * Deliberately not uniform: a fixture where every fundur is exactly on budget
 * shows none of the states the design draws for the ones that are not. `seed` spreads them without needing randomness, which would make the
 * fixture different on every render.
 */
function detail(type: EventType, weekIndex: number, seed: number, dated: boolean) {
  const monday = mondayOfWeek(weekIndex, dated);
  const planned = PLANNED_MINUTES[type];

  // Some short, some over budget, most near it.
  const drift = [0, -10, 15, -25, 5, 30][seed % 6];
  const actual = Math.max(15, planned + drift);

  const itemCount = type === "flokks" || type === "sveitar" ? 4 + (seed % 3) : 0;

  const needCount = seed % 3;
  const needs = Array.from({ length: needCount }, (_, i) => NEEDS[(seed + i * 2) % NEEDS.length]);

  const segments: PlanSegment[] =
    itemCount === 0
      ? []
      : [
          { kind: "setning", minutes: 10 },
          { kind: "dagskra", minutes: Math.max(10, actual - 45) },
          { kind: "leikur", minutes: 20 },
          { kind: "slit", minutes: 10 },
          { kind: "endurmat", minutes: 5 },
        ];

  return {
    starts_at: monday ? isoDateTime(addDays(monday, WEEKDAY[type]), START_MINUTES[type]) : null,
    planned_minutes: planned,
    actual_minutes: actual,
    venue: VENUES[seed % VENUES.length],
    theme: THEMES[seed % THEMES.length],
    item_count: itemCount,
    needs,
    segments,
  };
}

function buildBands(dated: boolean): PlanBand[] {
  const spec: Array<[number, string, PlanBand["type"]]> = [
    [1, "Skipulagsfundur foringja", "skipulags"],
    [5, "Sveitarfundur: haustvarðeldur", "sveitar"],
    [9, "Haustútilega á Úlfljótsvatni", "utilega"],
    [13, "Dagsferð á Esju", "dagsferd"],
    [17, "Vormót skátafélaganna", "mot"],
    [20, "Uppskeruhátíð sveitarinnar", "uppskeru"],
  ];

  return spec.map(([week, title, type], i) => ({
    event_id: `mock-band-${week}`,
    week_index: week,
    title,
    status: statusForWeek(week),
    type,
    span_weeks: 1,
    ...detail(type, week, i + 1, dated),
  }));
}

function buildCells(dated: boolean): PlanCell[] {
  const cells: PlanCell[] = [];

  MOCK_PATROLS.forEach((patrol, patrolIndex) => {
    // One flokkur runs a two-week badge so the spanning case (ADR-002 §3) is in
    // the fixture rather than only in the tests.
    const spanStart = CURRENT_WEEK + 2 + patrolIndex;

    for (let week = 1; week <= WEEK_COUNT; week++) {
      if (BAND_WEEKS.has(week)) continue;
      // The second half of a span is covered by the entry that starts it.
      if (week === spanStart + 1) continue;

      const spans = week === spanStart;
      if (spans && BAND_WEEKS.has(week + 1)) continue;

      cells.push({
        event_id: `mock-cell-${patrol.id}-${week}`,
        week_index: week,
        patrol_id: patrol.id,
        title: spans ? "Hjálp í viðlögum (1/2)" : TITLES[(week + patrolIndex * 3) % TITLES.length],
        status: statusForWeek(week),
        type: "flokks",
        span_weeks: spans ? 2 : 1,
        // Each flokkur meets on its own evening, which is what stops the
        // calendar showing four identical entries stacked on one Wednesday.
        ...detail("flokks", week, week + patrolIndex, dated),
        starts_at: mondayOfWeek(week, dated)
          ? isoDateTime(
              addDays(mondayOfWeek(week, dated) as Date, 1 + (patrolIndex % 4)),
              19 * 60 + 30
            )
          : null,
      });
    }
  });

  return cells;
}

/**
 * Two seasons, because the switcher and the scratchpad are both part of A1: a
 * dated starfsár and an undated scratchpad, which is the whole difference the
 * model draws between them.
 */
export function mockSeasons(): Season[] {
  const weeks = buildWeeks(true);
  const createdAt = new Date().toISOString();

  return [
    {
      id: MOCK_SEASON_ID,
      workspace_id: MOCK_WORKSPACE_ID,
      name: "Starfsárið (GERVIGÖGN)",
      kind: "starfsar",
      starts_on: weeks[0].starts_on,
      ends_on: weeks[weeks.length - 1].starts_on,
      created_at: createdAt,
    },
    {
      id: MOCK_SCRATCHPAD_ID,
      workspace_id: MOCK_WORKSPACE_ID,
      name: "Krot og krass (GERVIGÖGN)",
      kind: "scratchpad",
      starts_on: null,
      ends_on: null,
      created_at: createdAt,
    },
  ];
}

/**
 * The grid for a mock season. The scratchpad is the same plan undated, which is
 * exactly what the model says a scratchpad is — and it is the only way to see
 * how the views behave when there are no dates to sort or grey out by.
 */
export function mockGrid(seasonId: string): PlanGrid {
  const dated = seasonId !== MOCK_SCRATCHPAD_ID;

  return {
    season_id: seasonId,
    patrols: MOCK_PATROLS,
    weeks: buildWeeks(dated),
    bands: buildBands(dated),
    cells: buildCells(dated),
  };
}
