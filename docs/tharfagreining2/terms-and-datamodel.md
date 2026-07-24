# Terms ↔ data model — what we say vs. what we have

Maps the vocabulary from the þarfagreining (workshop 1 June 2026 — `meeting-notes.md`,
`user-stories.md`, ADR-001/002/003) onto **the data model that exists today** in
`backend/app/models`, so the gaps for the Fasi 2 Planner are explicit.

**Legend**
- ✅ **exists** — modelled today, usable mostly as-is
- 🟡 **partial** — something related exists but is missing key dimensions
- ❌ **missing** — no model/field today; must be built
- ⏸ **deferred** — real need, but parked to a later phase (ADR-003 / parked clusters)

> Three columns matter: the **term** (what leaders say), **today** (current model),
> and **target** (the ADR-001/002 decision). "Today" is the source of truth for the
> backend as it stands; "target" is where ADR-001/002 say it must go.

---

## 1. The planning hierarchy (the spine)

> ### ✅ Confirmed mapping (Halldór, 2026-06-27)
> The existing `Program → Event → Task` chain **already is** the planning hierarchy —
> we reuse it, we do not invent parallel entities. **`dagskrá` is the umbrella term
> for *all* content** = the polymorphic **`Content`** base; every level below is a
> *kind of dagskrá*, and **each level is a *collection of the level below*** — a
> consistent, fractal pattern:
>
> *(Two senses of "dagskrá": **broad** = any content, the `Content` base; **narrow
> (meeting)** = the **timed, ordered list of liðir** in one meeting, i.e. the `Event`
> as a list of `Task`s. The narrow sense needs `Task.order_index` + timing — **to
> implement**, §5/§10.)*
>
> | Model | = domain term | Defined as | Status |
> |---|---|---|---|
> | **`Content`** *(base)* | **dagskrá** | **umbrella term for all content** (polymorphic base of everything below) | ✅ exists |
> | **`Task`** | **dagskrárliður** | a *small unit* (eining) — e.g. a *leikur* or *setning* | ✅ exists |
> | **`Event`** | **skátafundur** | a *collection of **Tasks*** that makes up one meeting | ✅ exists |
> | **`Program`** | **dagskrárhringur** / **útilega** / **mót** | a *collection of **Events** (and/or Tasks)* — a term/cycle, a camp, or a rally | ✅ exists |
> | **`Season`** *(new)* | **starfsár** *or* **scratchpad** | a *collection of **Programs*** (dated season, or undated scratchpad) | ❌ to build |
> | **`Workspace`** | **heildardagskrá** | *umbrella for many **Seasons*** — the whole programme (**not a new entity**) | ✅ exists |
>
> Only **one new entity** (`Season`) is needed above `Program`. The pattern still
> holds: `Season` collects Programs; the **`Workspace` is the *heildardagskrá*** — an
> umbrella term for its many Seasons, not a separate table.
>
> **`Program` has a kind.** kind ∈ { **dagskrárhringur**, **útilega**, **mót** } —
> all three are *collections of events/tasks*, just different purposes. **`útilega`
> and `mót` are *always* `Program`s** (never `Event` types) because they must
> *contain* events. A `Program.kind` discriminator mirrors the `Event.type` decision
> (ADR-002).
>
> **Workspace holds the programmes.** A **`Workspace` contains many `Program`s**
> directly (mandatory, `workspace_id`, exists ✅). `Season` is an *optional grouping*
> on top: a `Program` always belongs to one `Workspace`, and may also sit inside a
> `Season`. The Workspace itself *is* the heildardagskrá. (See §11.)
>
> **Consequence for ADR-001:** ADR-001 proposed a *new* `Cycle` entity subsuming
> `Program`. This confirmation supersedes that: **`Program` *is* the dagskrárhringur**
> (reuse, ADR-001 alt. A/B). **One** new level (`Season`) is added above it; the
> `Workspace` is the heildardagskrá. Amended spine:
> `Workspace(=heildardagskrá) → Season{starfsár|scratchpad} → Program{dagskrárhringur|útilega|mót} → Event → Task`.

| Term (IS) | Meaning | Today (current model) | Target | Status |
|---|---|---|---|---|
| **dagskrárliður** | A small unit — a *leikur*, *setning* | **`Task`** (`event_id`) | + ordering/timing + context | ✅ *(mapping confirmed; dims missing — §5)* |
| **skátafundur** | A single meeting = a collection of Tasks | **`Event`** (`start_dt`, `end_dt`, `program_id`, rel `tasks`) | + `type` + `scope` | ✅ *(mapping confirmed; type/scope missing — §2)* |
| **dagskrárhringur** | A term/cycle = a collection of Events/Tasks | **`Program`** (rel `events`) | reuse as a `Program.kind` (no new `Cycle` entity) | ✅ **confirmed** |
| **útilega / mót** | A camp / a rally = a collection of Events/Tasks | none (no Event type/kind) | **`Program.kind`** ∈ { dagskrárhringur, útilega, mót } | ❌ |
| **starfsár** | The work-year — a collection of Programs (dated) | only `Workspace.season_start` (a date) | new **`Season`** above `Program` | ❌ |
| **heildardagskrá** | The whole programme — one or more Seasons | **`Workspace`** (umbrella, not a new entity) | reuse `Workspace` as the heildardagskrá | ✅ *(= Workspace)* |
| **heildardagatal** | The assembled master calendar (all events) | none — no aggregate/calendar endpoint | derived view over the `Workspace`'s Seasons | ❌ |
| **dagskrá** *(meeting sense)* | The **timed, ordered list of liðir** within a meeting — the list *is* the `Event`, each liður *is* a `Task` | `Event` → `Task`, but **`Task` has no order/timing** | `order_index` + timing on `Task` — **to implement** (see §5/§10) | 🟡 |
| **fundur 3 fasar** (Undirbúningur → Fundur → Eftir á) | A meeting is prep + meeting + follow-up, not just the hour | none | meeting lifecycle incl. pre/post (ties C + D) | ❌ |

## 2. Event types & scope (ADR-002 §1)

Today `Event` is **untyped and unscoped**. `ContentType` is only `program | event | task`.

| Term (IS) | Meaning | Today | Target | Status |
|---|---|---|---|---|
| **skipulagsfundur** | Planning meeting that opens a cycle | — | `Event.type = skipulags` | ❌ |
| **sveitarfundur** | Troop-wide meeting | — | `type = sveitar`, `scope = troop-wide` | ❌ |
| **flokksfundur** | Per-patrol meeting (parallel) | — | `type = flokks`, `scope = per-flokkur` | ❌ |
| **uppskeruhátíð** | Harvest / closing celebration (single event) | — | `Event.type = uppskeru` | ❌ |
| **dagsferð** | Day trip (single event) | — | `Event.type = dagsferð` | ❌ |
| **útilega** | Weekend camp — **contains events** | — | **not an Event type** — always a **`Program`** (kind=útilega, §1) | ❌ |
| **mót** | Multi-troop rally — **contains events** | — | **not an Event type** — always a **`Program`** (kind=mót, §1) | ❌ |
| **Event.type** | Discriminator driving default slot sets | none | `EventType` enum + column | ❌ |
| **Event.scope** | troop-wide (spans all columns) vs per-flokkur (one column) | none | `EventScope` enum + column | ❌ |

## 3. Organisation & people

> ### ✅ Confirmed org hierarchy (Halldór, 2026-06-27)
> The **units of people** follow the same *collection-of-the-level-below* pattern as
> content:
>
> **Final ladder:** `Scout → Patrol → Troop → Division → Group`
>
> | Unit (IS) | **EN (Slóði)** | Defined as | Today (current model) | Status |
> |---|---|---|---|---|
> | **skáti** | **`Scout`** | a single scout (person) — **the smallest unit** | not modelled — youth are **view-only, not users** (#97) | ❌ *(later: scout registry, ADR-003)* |
> | **flokkur** | **`Patrol`** | a *group of skátar* | the existing **`Troop`** model — **must be renamed `Patrol`** | 🟡 *(rename)* |
> | **sveit** | **`Troop`** | a *group of flokkar* | **none** | ❌ |
> | **deild** | **`Division`** | a *group of sveitir* | **none** | ❌ |
> | **félag** | **`Group`** | a *group of sveitir **and** deildir* | **`Group`** (owns `Workspace`s) | ✅ |
>
> **A "member" is not a user — a member is a *skáti*.** To avoid that collision we use
> **`Scout`** for the smallest unit (skáti), and reserve *membership* terms for
> Users-with-roles in a `Group`/`Workspace`. A `Scout` is **never a system user**
> (youth are view-only, #97).
>
> ✅ **This aligns with standard scouting English** (Appendix A): flokkur = *Patrol*
> (the small unit), sveit = *Troop* (the section). **Consequence:** the code's current
> `Troop` model is a *flokkur* → **rename it `Patrol`**, then add new **`Troop`**(sveit)
> and **`Division`**(deild) levels. Today the model jumps `Group` → `Workspace` →
> `Troop`(=flokkur), skipping sveit/deild.
>
> **Workspace ownership (GitHub-like).** A `Workspace` is owned by **a `User` *or* a
> `Group`** (like a repo owned by a personal account or an org): a `User` owns 1..\*
> workspaces; a `Group` has members (Users) + roles + workspaces. Today only
> `Workspace.group_id` (nullable) + `WorkspaceMembership(user, role)` exist.
> **TBD:** model the owner as **polymorphic** (`owner_type` + `owner_id`) **or** add an
> explicit **`owner_user_id`** alongside `group_id`. *(decision deferred)*

| Term (IS) | Meaning | Today | Target | Status |
|---|---|---|---|---|
| **vinnurými** | Workspace — the planning container; **contains many Programs** | **`Workspace`** 1→\* `Program` (`workspace_id`); `season_start`, meeting defaults | as-is for ownership; clarify its place vs sveit/deild | ✅ *(contains-programs exists)* / 🟡 *(org placement)* |
| **foringi** | Leader (account holder, editor) | `User` + `WorkspaceRole` (owner/admin/editor/viewer) | as-is | ✅ |
| **aðstoðarforingi** | Co-/assistant leader | only `viewer`/`editor` | new "view + receive-tasks" tier (J2) | 🟡 |
| **sveitar-/flokksforingi** | Troop/patrol leader (often rotated) | no org-role concept | rotatable org roles | ❌ |
| **félagsforingi** | Group leader | `GroupRole` owner/admin | as-is | ✅ |
| **starfsráð** | Staff council (works in a starfsráðsmappa today) | none | council access tier (J6) + archive | ❌ |
| **skátar / foreldrar** | Youth / parents — **view-only, not users** (#97) | none | read-only dagskrá **share link** (G1), age-gated by guidance | ❌ |

## 4. Program blocks, templates & content (ADR-002 §4)

| Term (IS) | Meaning | Today | Target | Status |
|---|---|---|---|---|
| **blokk / legó** | Composable block at every scale (fractal) | `Content` polymorphic base (program/event/task) | extend `Content` chain upward; uniform block model | 🟡 |
| **beinagrind / slot** | Fixed meeting skeleton (setning→dagskrá→leikur→slit→endurmat) | none | editable **slot sets per event type** | ❌ |
| **sniðmát** | Template — copy-and-edit, never frozen | `POST /programs/{id}/copy` (flat clone) | template-as-launchpad; clone whole events/cycles | 🟡 |
| **þema** | Theme that re-skins a generic block (parametrised) | none | theme parameter over generic blocks | ❌ |
| **ÆSKA / þroskasvið** | The developmental-areas **envelope** wrapping the whole dagskrá (not a field) | none | envelope a coverage view (cluster F) can read off | ❌ |
| **markmið** | Goals, set at cycle level (SMART) | none | goal attach on `Program` (the cycle) / `Season` | ❌ |
| **færnimerki** | Skill badges — double as movement-wide program templates | none (no badge entity) | badge catalogue = block library (B8/B9; registry side in ADR-003) | ❌ |
| **leikur / leikjabanki** | Games / searchable games bank | **Program Bank** (`Content` + `Tag`/`ContentTag`, search/filter) | as-is; mobile quick-grab (cluster E) | ✅ |
| **hróp / kvöldvaka / söngur** | Scouting-specific content types | only `program/event/task` | extra content types/tags | ❌ |
| **endurmat** | Written evaluation that travels with reuse & resurfaces | none | endurmat note on block/fundur/event/cycle (cluster D) | ❌ |

## 5. Cell / element dimensions on the grid (ADR-002 §3)

| Term (IS) | Meaning | Today | Target | Status |
|---|---|---|---|---|
| **röðun** | Ordering of liðir within a meeting (the dagskrá *is* the ordered `Task` list) | **none** — `Task` has no `order_index` | `Task.order_index` (position in `Event`) | ❌ **to implement** |
| **tímasetning** | Per-element timing within a meeting | none on `Task` (only `Event.start/end_dt`) | **duration-only** (`Content.duration_min`); start *derived* from `Event.start_dt` — works undated in scratchpad | ❌ **to implement** |
| **staða** | tentative / draft / confirmed | none | `status` enum on Content/Event | ❌ |
| **"?" / möguleg / to-fill** | First-class "undecided / requires planning" marker | none (`Event.start_dt` is NOT NULL; `name` min-len 1 → placeholders not representable) | placeholder/`is_placeholder` state | ❌ |
| **fjölvikna liður** | Element spanning several weeks (badge Part 1/2) | none | multi-week spanning | ❌ |
| **staðsetning** | Venue/place, rotating per fundur | `Content.location` (free string) | venue → bookable `Resource` (ADR-003) | 🟡 |
| **Innkaup** | Procurement list **derived** from the plan | none | derived worklist projection (cluster I) | ❌ |
| **ATH / athugasemdir** | Notes column (interim clash-flagging) | `Content.description` (free text) | notes field on plan | 🟡 |

## 6. Views & outputs

| Term (IS) | Meaning | Today | Status |
|---|---|---|---|
| **grid (vikur × flokkar)** | Dense overview, two row kinds (troop-wide band / per-flokkur cell) | none — no grid/matrix endpoint or UI | ❌ |
| **flokkatímalína** | Per-flokkur timeline (working default) | none | ❌ |
| **mánaðardagatal** | Month/year calendar (scheduling, holidays) | only `Event.start_dt` + `date_from/to` filter | ❌ |
| **starfsáætlun** | Annual plan generated from entered content | none | ❌ |
| **útflutningur / prentun** | Print/export (≠ just print — derived worklists) | none | ❌ (cluster I) |
| **útgáfusaga** | Version history of the plan | none | ❌ (X2) |

## 7. Access, sharing & cross-cutting

| Term (IS) | Meaning | Today | Status |
|---|---|---|---|
| **hlutverk** | owner / admin / editor / viewer | `WorkspaceRole`, `GroupRole` | ✅ |
| **deila dagskrá** | Share the dagskrá (link / partial view) | none | ❌ (J3/J4/G1) |
| **prófílar** | Per-person profiles (enable follow/badges) | `User` exists | 🟡 |
| **merki / stig / leikjavæðing** | Leader gamification (Slóðaverðlaun) | none | ❌ (cluster L → Tier 1) |
| **tög** | Tags | `Tag`, `ContentTag` | ✅ |
| **athugasemdir / like** | Comments / likes / favourites | `Comment`, like counts, `liked_by_me` | ✅ |

## 8. Resources & registries — ⏸ deferred (ADR-003, parked clusters H/N)

| Term (IS) | Meaning | Today | Status |
|---|---|---|---|
| **Resource** | Schedulable thing (venue / gear / capability) | none | ⏸ |
| **búnaðarskráning** | Equipment registry + availability | none | ⏸ |
| **samnýting aðfanga / árekstrar** | Resource clash detection across flokkar | none (interim: ATH notes by hand) | ⏸ |
| **félagalisti** | Member roster | only `User` + memberships (no member entity) | ⏸ |
| **reynsluskráning** | Leader skills/qualifications (Safe from Harm) | none | ⏸ |
| **Abler.io / BÍS / Drive** | External integrations / import | none | ⏸ (cluster N, parked) |

---

## 9. The data models we have today (`backend/app/models`)

Polymorphic single-table-inheritance: **`Content`** base → `Program` · `Event` · `Task`.

| Model | File | Key fields | Notes |
|---|---|---|---|
| **`Content`** (base) | `content.py` | `id`, `content_type`, `name`, `description`, `image`, `media` (JSONB), `equipment` (JSONB), `instructions`, `duration_min/max`, `age` (array of `age_group_enum`), `location`, `count_min/max`, `price`, `prep_time_min/max`, `created_at`, `author_id`, `workspace_id` | discriminator `content_type`; soft-delete; rels: author, workspace, comments, content_tags |
| **`Program`** | `program.py` | `id` (FK content) | `content_type=program`; rel `events` (1→many) |
| **`Event`** | `event.py` | `start_dt` (NOT NULL), `end_dt`, `program_id` (nullable) | **no `type`, `scope`, or `status`**; rels: program, tasks, troop_participations |
| **`Task`** | `task.py` | `event_id` (nullable) | **no `order_index`, no timing** |
| **`Troop`** | `troop.py` | `name`, `workspace_id` | = *flokkur* → **rename to `Patrol`** (§3/App. A); soft-delete |
| **`TroopParticipation`** | `troop.py` | `troop_id` × `event_id` (composite PK) | flokkur↔**event** M2M only; rename → `PatrolParticipation` |
| **`Workspace`** | `workspace.py` | `season_start` (date), `default_meeting_weekday/start_time/end_time/interval`, `group_id` | the only "season" trace today |
| **`Group`** | `group.py` | (félag) owns workspaces | + `GroupMembership` (group×user×role) |
| **`WorkspaceMembership`** | — | workspace × user × `WorkspaceRole` | access control |
| **`Tag`** / **`ContentTag`** | tag models | tag + content↔tag assoc | powers bank search |
| **`Comment`** | comment model | on content | |
| *(Heiðursorðla models)* | — | game feature, unrelated to Planner | |

**Domain enums** (`app/domain/enums.py`): `ContentType` (program/event/task) · `AgeGroup` (7) · `Weekday` · `EventInterval` (weekly/biweekly/monthly/yearly — **defined but unused on Event**) · `WorkspaceRole` · `GroupRole` · `Permissions` · `ProgramSortBy` · `Pronouns` · Heiðursorðla enums. **No** `EventType`, `EventScope`, or content `status` enum.

---

## 10. Gap summary — what must be built for the Planner

**New entities — content side** (one new level *above* `Program`)
- ❌ **`Season`** — a *collection of Programs*; `kind ∈ { starfsár (dated),
  scratchpad (undated) }`. **A scratchpad cannot become a season** (copy content out,
  never convert — §11).
- ✅ **`Workspace` = heildardagskrá** — the umbrella over many Seasons; reuse the
  existing entity, **no new `Heildardagskrá` table**.
- `Program` already *is* the dagskrárhringur (✅ confirmed §1), so **no separate
  `Cycle` entity** — supersedes ADR-001. `mót` is a `Program.kind`, not its own entity.
- ⏸ `Resource` + bookings, badge catalogue (ADR-003, later)

**New entities — people/org side (§3)** — final ladder `Scout → Patrol → Troop → Division → Group`
- ⚠️ **rename the existing `Troop` model → `Patrol`** (it is a *flokkur*; aligns with
  scouting English — Appendix A). Rename + migration + update all refs
  (`TroopParticipation`→`PatrolParticipation`, etc.). **Deferred — rename when we get
  to the org-levels work, not before.**
- ❌ add **`Troop`** (sveit = group of flokkar/patrols) and **`Division`** (deild =
  group of sveitir) — the two missing levels between `Patrol` and `Group`.
- ❌ **`Scout`** (skáti) — the smallest unit; not a user; not modelled; ⏸ later via
  scout registry (ADR-003).
- 🟡 **Workspace owner = `User` or `Group`** (GitHub-like) — **TBD** model as
  polymorphic owner (`owner_type`+`owner_id`) vs explicit `owner_user_id` (§3).

**New columns / enums**
- ❌ **`Program.kind`** (dagskrárhringur / útilega / mót) + **`Season.kind`**
  (starfsár / scratchpad — §11) — discriminators mirroring `Event.type`
- ❌ `Event.type` (`EventType`: skipulags/sveitar/flokks/uppskeru/dagsferð) — útilega/mót are `Program.kind`s, not event types
- ❌ `Event.scope` (`EventScope`: troop-wide / per-flokkur)
- ❌ content/event `status` enum (tentative/draft/confirmed) + first-class **"?" placeholder** state
- ❌ **`Task.order_index` + timing** — the meeting-level *dagskrá* is a timed, ordered
  list of `Task`s, but ordering/timing is **not modelled today**. Proposed:
  `order_index` (position in the `Event`) + **duration-only** (reuse `Content.duration_min`;
  start times *derived* from `Event.start_dt`), so reorder/shift reflows and it works
  undated in the scratchpad. *(absolute per-task times rejected — rigid, breaks reuse.)*
- ❌ multi-week spanning on elements; theme parameter; markmið on `Program`; endurmat note (travels)
- ❌ ÆSKA/þroskasvið envelope (not a field — a wrapper)

**New links**
- ❌ **Season ↔ units** — assign a `Division` / `Troop`s / `Patrol`s as a season's
  participants (þátttakendur) (§11).
- ❌ **Content ↔ units** — assign `Program`/`Event`/`Task` to specific `Troop`s/`Patrol`s
  so different units get different dagskrá; generalises today's `TroopParticipation`
  (flokkur↔event only) to any content↔any unit, scoped to a season (§11).
- ❌ wire the org chain `Scout → Patrol → Troop → Division → Group` (skips Troop/Division today)

**New endpoints / projections**
- ❌ grid (week×flokkur) matrix, per-flokkur timeline, month calendar, heildardagatal — all from one dataset
- ❌ generated starfsáætlun; derived Innkaup/procurement worklists; print/export
- ❌ read-only dagskrá **share link**; "view + receive-tasks" access tier (J2); council tier (J6)

**Reusable as-is (✅)**: Program Bank + tags/search (cluster E), `Group`/`Workspace`/roles
(cluster J foundation), comments/likes, the polymorphic `Content` base to extend upward.

---

## 11. Workspace container model — seasons & scratchpad (proposed)

**Question:** how does a `Workspace` hold its programs? A workspace **contains many
Programs** (§3, exists today). We now want two ways to hold them:

- **season** (starfsár) — a **dated** container; its programs/events bind to the
  calendar (real `start`/`end`).
- **scratchpad** — a **loosely defined, undated** container with *no beginning or
  end*, where a leader **plays with putting a dagskrá together** before committing it
  to a time.

### Key insight

A season and a scratchpad are the **same `Season` entity, distinguished by `kind` +
temporal bounds**. A `starfsár` season *has* a start/end (contents scheduled); a
`scratchpad` *has none* (contents are unscheduled drafts). Model **one `Season` entity
with `kind` + optional dates**. (`mót`/`útilega` are *not* here — they are `Program`
kinds, §1.) **`kind` is fixed at creation: a scratchpad cannot become a season** —
you *copy* programs out of a scratchpad into a starfsár season.

```
Workspace (= heildardagskrá, umbrella over its Seasons)
 ├─ Season{kind: starfsár,   start, end}      ─* Program{kind} ─* Event{start,end} ─* Task
 └─ Season{kind: scratchpad, start=∅, end=∅}  ─* Program(draft) ─* Event{start=∅,end=∅} ─* Task
```

- **`Season`**: `workspace_id`, `kind` (`starfsár | scratchpad`, immutable),
  **`start_dt?` / `end_dt?` (nullable)**, `name`. A scratchpad is a `Season` with no dates.
- **`Workspace` is the heildardagskrá** — the umbrella over its Seasons; **no separate
  entity**.
- **`Program.season_id`** nullable (a program can sit loose in the workspace, or
  inside a season). `Program.workspace_id` stays mandatory.
- **Lifecycle:** build a dagskrá in the **scratchpad** (undated) → **copy** the program
  into a `starfsár` season and assign real `Event.start_dt`. **The scratchpad persists
  and is never converted** — content moves by copy only.

### Assigning units & content within a season (per-þátttakendur dagskrá)

A season is composed of the **org units taking part** and then the **content assigned
to each**. Two assignment links:

1. **Season ↔ units (the þátttakendur):** assign to a season a **`Division`**, some
   **`Troop`s**, and/or some **`Patrol`s** — the participants of that season.
2. **Content ↔ units:** assign each **`Program` / `Event` / `Task`** to specific
   `Troop`s / `Patrol`s. This is what lets **different units get different dagskrá**
   in the same season (parallel flokksfundir, troop-wide bands).

```
Season(starfsár)
 ├─ participants: Division D, Troops {T1,T2}, Patrols {P1,P2,P3}   ← Season↔unit
 └─ Program/Event/Task ──assigned to──▶ {Patrol P1}  (P2 gets a different one)  ← Content↔unit
```

This **generalises today's `TroopParticipation`** (flokkur↔event only) to: any content
level ↔ any unit level, scoped to a season. It is also the backbone of the **A2 grid**
(rows/cols = units, cells = content assigned to them) and uses `Event.scope`
(troop-wide vs per-flokkur, ADR-002).

### ⚠️ Blocker this exposes

The scratchpad **requires undated content**, but today **`Event.start_dt` is
`NOT NULL`** (§9). To hold an unscheduled draft, either:
- make `Event.start_dt` **nullable** (an event with no date = "in the scratchpad /
  not yet scheduled"), or
- add a `scheduled: bool` / reuse the `status` enum (draft/"?") from §5/A8.

This is the same nullable-placeholder gap A8 already calls out — the scratchpad is a
strong, concrete reason to do it.

### Resolved

- ✅ **One entity:** `Season{kind: starfsár|scratchpad}` with nullable dates.
- ✅ **Copy, not convert:** a scratchpad **cannot become a season**; programs are
  *copied* out into a starfsár season (the scratchpad persists).
- ✅ **Scope: one scratchpad per workspace** (auto-created; shared, not per-user).
- ✅ **Granularity: the scratchpad holds *loose `Content`*** — a half-built `Event`, a
  few `Task`s, or whole `Program`s. Unlike a starfsár season (which holds Programs),
  the scratchpad can carry content at any level, unscheduled.

---

## Appendix A — How troops & patrols work in (UK) Scouting

To choose the right **English** names for the org levels (§3), here is the structure
used by The Scout Association (UK), the dominant English-language scouting vocabulary.

### The hierarchy (bottom → top)

| Level | UK term | What it is |
|---|---|---|
| Member | **(young person / Scout)** | one youth member |
| Small unit | **Patrol** | a team of **6–8** young people within a section; the basic working sub-unit |
| Section | **Troop** (for the Scout age-section) | the whole age-group unit, **divided into Patrols** |
| Local org | **Scout Group** | contains the sections (one Group ≈ Squirrels + Beavers + Cubs + Scouts) |
| Area | **District** | several Groups |
| Region | **County** (Area in Wales, Region in Scotland) | several Districts |

### Per-section names (the small unit differs by age)

| Section | Age (approx) | Section unit | Small unit | Youth leaders of the small unit |
|---|---|---|---|---|
| Squirrels | 4–6 | Drey | — | — |
| Beavers | 6–8 | Colony | **Lodge** | Lodge Leader (+ Assistant) |
| Cubs | 8–10½ | Pack | **Six** | **Sixer** + **Seconder** |
| Scouts | 10½–14 | **Troop** | **Patrol** | **Patrol Leader (PL)** + **Assistant Patrol Leader (APL)** |
| Explorers | 14–18 | Unit | — | — |
| Network | 18–25 | Network | — | — |

> The defining point: **a *Patrol* is the small 6–8 unit; a *Troop* is the whole
> section that contains patrols.** "Troop" is *not* the small unit.

### IS ↔ EN mapping

| Icelandic (BÍS) | = collection of | Standard scouting EN | **Slóði EN (chosen)** | In Slóði today |
|---|---|---|---|---|
| **skáti** | — (a person) | Scout / member | **`Scout`** | not modelled |
| **flokkur** | skátar | Patrol | **`Patrol`** | `Troop` model → **rename to `Patrol`** |
| **sveit** | flokkar | Troop | **`Troop`** | — (missing) |
| **deild** | sveitir | *(no exact UK equivalent)* | **`Division`** | — (missing) |
| **félag** | sveitir + deildir | Scout Group | **`Group`** | `Group` model ✅ |

### Decision: align with standard scouting English

✅ **Decided (Halldór, 2026-06-27):** the org data model is
**`Scout → Patrol → Troop → Division → Group`** — matching the UK scouting meaning
of *Patrol* (small unit) and *Troop* (section), plus `Division` (deild) and `Group`
(félag). `Division` for *deild* is Slóði's own choice (no standard UK equivalent).
The smallest unit is **`Scout`** (skáti) — *not* "Member" (a member is a scout, not a
system user).

**Action:** the code's current **`Troop` model is a *flokkur* → rename it `Patrol`**,
then add **`Troop`** (sveit) and **`Division`** (deild) entities above it. (This is the
"align with scouting English" option; the keep-`Troop`=flokkur alternative was *not*
chosen.)

> Sources: [Scouts — Scouting structure](https://www.scouts.org.uk/volunteers/running-things-locally/scouting-structure-and-trustee-boards/scouting-structure/) ·
> [Scouts — Section organisation](https://www.scouts.org.uk/volunteers/running-your-section/programme-guidance/administration-and-management/adapting-scout-groups-for-rural-areas/integrated-sections/section-organisation/) ·
> [Cub Scouts (The Scout Association) — Wikipedia](https://en.wikipedia.org/wiki/Cub_Scouts_(The_Scout_Association)) ·
> [Scout leader — Wikipedia](https://en.wikipedia.org/wiki/Scout_leader).

---

*Sources: `meeting-notes.md`, `user-stories.md`, `roadmap.md`, ADR-001/002/003,
`decisions-log.md`, `tharfagreining2.md` glossary; backend inventory of
`backend/app/models` + `app/domain/enums.py` (verified 2026-06-27); Appendix A web
sources inline above.*
