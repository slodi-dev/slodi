# Plan API contract — A1 (sc-34)

The frontend half of A1 is built and merged ahead of the backend half. This is the contract it calls, so the two halves meet without a second negotiation.

Source of truth for the shapes: `docs/tharfagreining2/terms-and-datamodel.md` §11 (container model) and ADR-002. The frontend types live in `frontend/services/plan.service.ts` — if these disagree, that file is what ships.

## The one new entity

§11 settles that only **one** entity is needed above what the backend already has:

```
Workspace (= heildardagskrá)          ✅ exists
  └─ Season { starfsár | scratchpad } ← new
       └─ Program { dagskrárhringur | útilega | mót }  ✅ exists
            └─ Event ✅ → Task ✅
```

A `Season` is an **optional grouping** of Programs. A Program keeps its mandatory `workspace_id`, so nothing about today's bank changes. The Workspace _is_ the heildardagskrá — it is not a new table.

## Endpoints the frontend calls

### `GET /workspaces/{workspace_id}/seasons` → `Season[]`

Every season in the workspace, dated and undated alike. The frontend sorts; the backend need not.

### `POST /workspaces/{workspace_id}/seasons` → `Season`

Body is `SeasonCreate` below.

## Shapes

```ts
type SeasonKind = "starfsar" | "scratchpad";

type Season = {
  id: string;
  workspace_id: string;
  name: string; // "Starfsárið 2026–27", or a scratchpad's given name
  kind: SeasonKind;
  starts_on: string | null; // ISO date. null on a scratchpad
  ends_on: string | null; // ISO date. null on a scratchpad
  created_at: string; // ISO datetime
};

type SeasonCreate = {
  workspace_id: string;
  name: string;
  kind: SeasonKind;
  starts_on?: string | null;
  ends_on?: string | null;
};
```

## Two things worth knowing

**The scratchpad is not a separate feature.** It is a `Season` with null dates. That is deliberate: A3's "play with putting a dagskrá together" and A8's draft state both fall out of the same model instead of needing their own. A backend that makes the scratchpad its own table or a boolean flag on something else would break that, and A8 would need reworking.

**Return `[]`, never 404, for an empty collection.** The frontend cannot tell an unrouted path from a missing record — FastAPI answers both with `{"detail": "Not Found"}` — so a 404 is always surfaced to the leader as a failure. A workspace with no seasons is not a failure.

## The grid matrix — A2 (sc-37)

### `GET /seasons/{season_id}/grid` → `PlanGrid`

```ts
type EventType =
  | "skipulags"
  | "sveitar"
  | "flokks"
  | "uppskeru"
  | "utilega"
  | "dagsferd"
  | "mot";
type PlanStatus = "unknown" | "tentative" | "draft" | "confirmed";

type Patrol = { id: string; name: string }; // a flokkur — one column
type PlanWeek = { index: number; starts_on: string | null; label: string }; // one row

type PlanCell = {
  // a per-flokkur event: one cell
  event_id: string;
  week_index: number;
  patrol_id: string;
  title: string;
  status: PlanStatus;
  type: EventType;
  span_weeks: number; // 1 unless it runs over several weeks
};

type PlanBand = Omit<PlanCell, "patrol_id">; // a troop-wide event: the whole row

type PlanGrid = {
  season_id: string;
  patrols: Patrol[];
  weeks: PlanWeek[];
  bands: PlanBand[];
  cells: PlanCell[];
};
```

**Bands and cells are split by `Event.scope`**, not by type. `troop-wide` becomes a band spanning every patrol column; `per-flokkur` becomes a cell in one column. That split is what lets parallel flokksfundir coexist in a period while a útilega takes the whole week.

**`status: "unknown"` is the "?" marker** of ADR-002 §3, not a missing value. A leader setting the skeleton early needs to say "something goes here, undecided" and have it render as a deliberate mark rather than an empty cell. Please don't collapse it to null.

**`span_weeks` counts the first week.** `1` means a single week; `2` means this week and the next. The frontend skips the positions a span covers, so an off-by-one here shears the grid sideways.

**A band week holds no per-flokkur cells.** A troop-wide event means every flokkur is on it, so a cell in the same week contradicts the band. The grid clips a cell's span where a band begins, and reports any cell that still lands inside a band's weeks rather than dropping it — but that is damage control, not a supported shape. If the two can genuinely coexist, say so, because the layout would need rethinking.

**One entry per position.** The grid renders at most one band per week and one cell per week-and-patrol; a second for the same position replaces the first on screen rather than stacking. If two troop-wide events can genuinely share a week — a skipulagsfundur alongside a mót — say so and the grid needs an overflow affordance before that ships, because today it would silently drop one.

`patrols` and `weeks` are the axes — send them even when there are no events, so the grid can render an empty term rather than nothing.

## The optional half of an entry — from the v5 hi-fi

The hi-fi on claude.ai/design (`pages/vinnubekkur-hifi-v5.html`, group **Pages**)
draws richer entries than the original grid contract carried. The frontend now
declares those fields, **all optional**, so the views can be built against the
design before the backend exists and degrade cleanly to the plain entry when a
field is absent.

Nothing here is required for a first backend release. Ship `PlanGrid` as it was
and every view still works; ship these and the views fill in.

| Field                         | On                     | What the design does with it                                                                                                                                                                    |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `starts_at`                   | `PlanCell`, `PlanBand` | **Places the entry on a real day in the Dagatal.** Without it the entry is listed under the month as belonging to a week — see below. Local ISO datetime, not UTC: it is a wall-clock schedule. |
| `planned_minutes`             | both                   | The budget, shown as `actual/planned mín`                                                                                                                                                       |
| `actual_minutes`              | both                   | What the liðir currently add up to; over budget is worth seeing                                                                                                                                 |
| `venue`                       | both                   | The Dagatal's second line                                                                                                                                                                       |
| `theme` | both | The fundur's theme. Carried, never scored — a liður is not "on" or "off" it |
| `item_count`                  | both                   | How many liðir the fundur holds — shown on the Rist chip                                                                                                                                        |
| `needs: string[]`             | both                   | Aggregated per week into the Rist's **Innkaup** column. Derived, never stored: a hand-kept shopping list is the complaint behind C4                                                             |
| `segments: {kind, minutes}[]` | both                   | The stacked duration bar, coloured by ADR-002 §1 liður kind                                                                                                                                     |
| `note`                        | `PlanWeek`             | The Rist's **ATH** column — things that shape a week without being events ("Vetrarfrí 23.–24. feb")                                                                                             |
| `accent`                      | `Patrol`               | Which `--sl-color-patrol-*` ramp the flokkur wears. Absent → the frontend assigns by column position, stably                                                                                    |

### Why `starts_at` matters most

Without it the month view can only place an entry against its _week_, because
`week_index` is the finest granularity the grid otherwise carries. A fundur is
usually midweek and a útilega usually a weekend, so dropping either onto its
week's Monday would tell a leader a day the planner does not actually know — and
this is the artifact the team is meant to set dates around (A5).

The calendar therefore does both, and says which: dated entries sit on their day,
undated ones appear in a "Skráð á viku, ekki á dag" list beneath the grid. That
list disappearing is the signal that the backend has started sending dates.

## Not in this contract yet

Writing to the grid — creating, moving and renaming events in a cell — is A3 (sc-38), which is where inline edit and autosave live. The `Task` planning dimensions below the event (venue, timing, endurmat) come with their own tickets. What is here covers reading a season and reading its grid, which is what A1 and A2 need.
