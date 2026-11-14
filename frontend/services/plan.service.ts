import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

/**
 * The plan API — seasons and the scratchpad (A1, sc-34).
 *
 * ## Where these shapes come from
 *
 * `docs/tharfagreining2/terms-and-datamodel.md` §11 settles the container model,
 * and only **one** new entity is needed above what the backend already has:
 *
 *   Workspace (= heildardagskrá, exists)
 *     └─ Season { starfsár | scratchpad }   ← new
 *          └─ Program { dagskrárhringur | útilega | mót }  (exists)
 *               └─ Event (exists) └─ Task (exists)
 *
 * A `Season` is an *optional grouping* of Programs. A Program still belongs to
 * a Workspace directly, so nothing here changes how the bank works today.
 *
 * ## Status: contract-first
 *
 * The backend half of A1 is a separate track. These types are the contract that
 * half implements, so they are written against the confirmed data model rather
 * than against whatever ships first. Until the endpoints exist the calls fail
 * and the UI says it could not load the plan, without claiming to know why.
 *
 * An earlier version tried to tell "not deployed yet" apart from "broken" by
 * inspecting the error message. That cannot work: FastAPI answers an unrouted
 * path with exactly `{"detail": "Not Found"}`, which is indistinguishable from
 * a missing record, so the guess was wrong in one direction or the other
 * whichever way it matched. A confidently wrong reassurance is worse than an
 * honest vague message.
 */

/**
 * A season is either the dated work-year or the undated scratchpad.
 *
 * The scratchpad is not a separate feature: it is a Season with no dates, which
 * is what makes "play with putting a dagskrá together" (A3) and the draft state
 * (A8, §11) fall out of the same model rather than needing their own.
 */
export type SeasonKind = "starfsar" | "scratchpad";

export type Season = {
  id: string;
  workspace_id: string;
  /** "Starfsárið 2026–27", or a name the leader gave their scratchpad. */
  name: string;
  kind: SeasonKind;
  /** ISO dates. Null on a scratchpad — that is what "undated" means here. */
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};

export type SeasonCreate = {
  workspace_id: string;
  name: string;
  kind: SeasonKind;
  starts_on?: string | null;
  ends_on?: string | null;
};

type GetToken = () => Promise<string | null>;

/** Every season in a workspace, dated and undated alike. */
export async function getSeasons(workspaceId: string, getToken: GetToken): Promise<Season[]> {
  return fetchWithAuth<Season[]>(buildApiUrl(`/workspaces/${workspaceId}/seasons`), {}, getToken);
}

export async function createSeason(payload: SeasonCreate, getToken: GetToken): Promise<Season> {
  return fetchWithAuth<Season>(
    buildApiUrl(`/workspaces/${payload.workspace_id}/seasons`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    getToken
  );
}

/** Sort order for the season switcher: scratchpads last, newest first. */
export function compareSeasons(a: Season, b: Season): number {
  if (a.kind !== b.kind) return a.kind === "starfsar" ? -1 : 1;
  const aKey = a.starts_on ?? a.created_at;
  const bKey = b.starts_on ?? b.created_at;
  return bKey.localeCompare(aKey);
}

// ── The grid (A2, sc-37) ─────────────────────────────────────────────────────

/**
 * ADR-002 §1. Drives default slot sets and behaviour; on the grid it drives
 * how a cell reads at a glance.
 */
export type EventType =
  | "skipulags"
  | "sveitar"
  | "flokks"
  | "uppskeru"
  | "utilega"
  | "dagsferd"
  | "mot";

/**
 * ADR-002 §1. This is what lets parallel flokksfundir coexist in one period:
 * troop-wide events span every column, per-flokkur events occupy one.
 */
export type EventScope = "troop-wide" | "per-flokkur";

/**
 * ADR-002 §3. `unknown` is the first-class "?" marker — a leader setting the
 * skeleton early needs to say "something goes here, not decided yet" without
 * the plan looking broken (A8).
 */
export type PlanStatus = "unknown" | "tentative" | "draft" | "confirmed";

/**
 * Which patrol ramp a flokkur wears.
 *
 * The hi-fi gives every flokkur a colour it keeps across all three views, so a
 * leader tracks one patrol by eye rather than re-reading column headers. These
 * are the existing `--sl-color-patrol-*` ramps — the planner adds no new
 * colours to the system.
 */
export type PatrolAccent = "rekkar" | "drekar" | "falkar" | "drott" | "rover" | "adrir";

/** A flokkur — one column of the grid. `Patrol` per terms-and-datamodel §3. */
export type Patrol = {
  id: string;
  name: string;
  /** Optional: the views fall back to a stable rotation when absent. */
  accent?: PatrolAccent;
};

/** The liður kinds of ADR-002 §1, used for the duration bar on an entry. */
export type SlotKind = "setning" | "dagskra" | "leikur" | "slit" | "endurmat" | "custom";

/** One coloured stretch of an entry's duration bar. */
export type PlanSegment = {
  kind: SlotKind;
  minutes: number;
};

/** One row of the grid. Undated on a scratchpad, which is why `starts_on` is nullable. */
export type PlanWeek = {
  index: number;
  starts_on: string | null;
  label: string;
  /**
   * Free note for the week — the hi-fi's "ATH" column. This is where the things
   * that shape a week but are not events live: "Öskudagur 18. feb — flest börn
   * í búningum", "Vetrarfrí 23.–24. feb".
   */
  note?: string | null;
};

/**
 * ## The optional half
 *
 * Everything below `span_weeks` is optional and additive. The hi-fi (v5 on
 * claude.ai/design) shows richer entries than the grid contract originally
 * carried — a start time, a planned-vs-actual budget, theme adherence, a venue,
 * the kit the fundur needs — and the month view places entries on real days.
 *
 * They are optional rather than required for one reason: the backend does not
 * exist yet, and when it lands it will not necessarily land with all of this at
 * once. Every view degrades to the plain entry when a field is absent, so the
 * design can be built now without the first backend release having to match it
 * field for field. `docs/frontend/plan-api-contract.md` records which of these
 * the endpoints are expected to grow.
 */
type PlanEntryBase = {
  event_id: string;
  week_index: number;
  title: string;
  status: PlanStatus;
  type: EventType;
  /** ADR-002 §3 — an element may run over several weeks (badge part 1/2). */
  span_weeks: number;

  /**
   * When it actually happens, as an ISO datetime.
   *
   * The week is the honest granularity for the grid, but a month calendar needs
   * a day: without this the calendar can only list an entry against its week,
   * because placing it on the week's Monday would invent a date the planner
   * does not have.
   */
  starts_at?: string | null;
  /** The budget for the fundur, against which `actual_minutes` is read. */
  planned_minutes?: number | null;
  /** What the liðir currently on it add up to. Over budget is worth seeing. */
  actual_minutes?: number | null;
  venue?: string | null;
  theme?: string | null;
  /** How many liðir are on this fundur. */
  item_count?: number | null;
  /** Kit this fundur needs — what the Innkaup column aggregates (C1/C4). */
  needs?: string[];
  /** Duration split by liður kind, for the stacked bar under an entry. */
  segments?: PlanSegment[];
};

/** A per-flokkur event: one cell, in one patrol's column. */
export type PlanCell = PlanEntryBase & {
  patrol_id: string;
};

/** A troop-wide event: a band across every patrol column. */
export type PlanBand = PlanEntryBase;

export type PlanGrid = {
  season_id: string;
  patrols: Patrol[];
  weeks: PlanWeek[];
  bands: PlanBand[];
  cells: PlanCell[];
};

/** The week×flokkur matrix for one season. */
export async function getSeasonGrid(seasonId: string, getToken: GetToken): Promise<PlanGrid> {
  return fetchWithAuth<PlanGrid>(buildApiUrl(`/seasons/${seasonId}/grid`), {}, getToken);
}

export function cellKey(weekIndex: number, patrolId: string): string {
  return `${weekIndex}:${patrolId}`;
}

// ── The bench — one fundur, assembled (B-cluster, sc-138…163) ────────────────

/**
 * A liður: one block on the bench.
 *
 * The Rist and the Dagatal answer "what is happening, and when". The bench
 * answers "what actually happens *inside* a fundur", which is a different shape
 * — an ordered list of timed blocks rather than a cell in a matrix. Modelling it
 * as its own thing rather than stretching `PlanCell` is deliberate: the grid
 * views never need the liðir, and a fundur sheet never needs the week axis.
 */
export type Lidur = {
  id: string;
  name: string;
  kind: SlotKind;
  /** How long it takes. The row's height on the bench is proportional to this. */
  minutes: number;
  status: PlanStatus;
  /** The theme this block serves — compared against the fundur's own theme. */
  theme?: string | null;
  venue?: string | null;
  /** Endurmat carried over from the last time this block was run (D2/D3). */
  endurmat?: string | null;
};

/**
 * One flokkur's own timeline inside a split band.
 *
 * When a troop-wide fundur is "skipt á flokka", the band stops being one shared
 * list and becomes a column per patrol running against a common clock. That is
 * a real thing leaders do — the whole sveit meets, then each flokkur goes off
 * and does its own verkefni for forty minutes, then they come back together —
 * and it cannot be expressed as an ordered list, because the lanes run *at the
 * same time* rather than one after another.
 */
export type PatrolLane = {
  patrol_id: string;
  items: Lidur[];
};

/** One fundur as the bench shows it: a header, and liðir in order. */
export type Fundur = {
  event_id: string;
  title: string;
  /** Human date for the sheet header — "12. febrúar". */
  date_label: string;
  starts_at: string | null;
  planned_minutes: number;
  venue: string | null;
  theme: string | null;
  scope: EventScope;
  week_index: number;
  /** How many weeks the dagskrárhringur runs, for "vika 3/8". */
  of_weeks?: number | null;
  items: Lidur[];
  /**
   * Bands that have been split across the flokkar.
   *
   * A band is in exactly one of two states: its liðir are in `items` (shared),
   * or they are in `split[band]` as one lane per patrol. Never both — that is
   * what `splitBand` and `mergeBand` move between, and keeping it exclusive is
   * what stops the sheet rendering the same verkefni twice.
   */
  split?: Partial<Record<BandId, PatrolLane[]>>;
};

/** Everything the bench renders for a season. */
export type PlanBenchData = {
  season_id: string;
  /** The sveit's flokkar — the columns a split band is dealt into. */
  patrols: Patrol[];
  fundir: Fundur[];
};

/**
 * The three sections every fundur is built from — ADR-002's beinagrind.
 *
 * A fundur is not a free list of blocks: it opens, it does its work, it closes.
 * Naming the sections in the model rather than leaving them implicit is what
 * lets a template be "a fixed frame with fill-in blanks" (B4) instead of a copy
 * of someone else's meeting.
 */
export type BandId = "opnun" | "kjarni" | "lok";

/** The liður kind a newly split or added block takes in each band. */
export const BAND_KIND: Record<BandId, SlotKind> = {
  opnun: "setning",
  kjarni: "dagskra",
  lok: "slit",
};

export const BANDS: { id: BandId; label: string }[] = [
  { id: "opnun", label: "Setning" },
  { id: "kjarni", label: "Verkefni fundar" },
  { id: "lok", label: "Slit" },
];

/** Which band a liður kind belongs to. */
export const BAND_OF: Record<SlotKind, BandId> = {
  setning: "opnun",
  dagskra: "kjarni",
  leikur: "kjarni",
  slit: "lok",
  endurmat: "lok",
  custom: "kjarni",
};

export const KIND_LABEL: Record<SlotKind, string> = {
  setning: "Setning",
  dagskra: "Dagskrá",
  leikur: "Leikur",
  slit: "Slit",
  endurmat: "Endurmat",
  custom: "Annað",
};

export const STATUS_LABEL: Record<PlanStatus, string> = {
  confirmed: "Staðfest",
  draft: "Drög",
  tentative: "Óvíst",
  unknown: "Óákveðið",
};
