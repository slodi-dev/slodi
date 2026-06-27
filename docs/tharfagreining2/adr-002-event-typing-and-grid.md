---
artifact: adr
version: "1.1"
created: 2026-06-01
updated: 2026-06-27
status: accepted
---

# ADR-002: Event typing, the week×flokkur grid, and the planner block model

## Status

**Accepted** — 2026-06-01. **Amended 2026-06-27** (see Amendment below).

**Date:** 2026-06-01 (from the phase-2 needs workshop) → 2026-06-27 (confirmed model)
**Deciders:** Halldór Valberg, Signý

> Eventual home: `docs/decisions/`. Kept in `docs/tharfagreining2/` for now.
> Built with the `develop-adr` skill (Nygard format).
>
> **Builds on** [ADR-001](./adr-001-dagskra-vs-program.md) (amended spine
> `Heildardagskrá → Season → Program → Event → Task`). **Defers resources to**
> [ADR-003](./adr-003-resources-and-registries.md).

## Amendment (2026-06-27) — `mót` is a Program, `útilega` is fractal, columns are Patrols

Reconciling with the confirmed model ([`terms-and-datamodel.md`](./terms-and-datamodel.md)).
**Where this disagrees with the Decision below, this wins.**

- **`útilega` and `mót` are NOT `Event.type`s — they are always `Program`s**
  (`Program.kind ∈ {dagskrárhringur, útilega, mót}`), because a camp/rally must
  *contain* events. Drop both from the `Event.type` enum.
- **Amended `Event.type` enum:** `skipulags · sveitar · flokks · uppskeru · dagsferð`
  (single events; útilega/mót removed).
- **New `Program.kind` enum:** `dagskrárhringur · útilega · mót` (the grouping
  discriminator; mirrors `Event.type`).
- **Grid columns are `Patrol`s.** The "week × flokkur" grid's flokkur axis = the
  **`Patrol`** entity (the code's `Troop` model renamed — see
  `terms-and-datamodel.md` §3 / Appendix A). Org ladder:
  `Member → Patrol → Troop → Division → Group`.
- **`Task` ordering is a real gap.** `Task` has **no `order_index` and no timing**
  today, yet the ordered-elements model (§3 below) assumes it. Add `order_index`
  (+ per-element timing) — it is a build item, not an existing capability.

## Context

ADR-001 establishes the hierarchy and notes that today's linear `Event → Task`
chain breaks. This ADR pins down *how* the `Event`/`Task` levels must change and
how planner content (blocks/templates) is modelled.

What the workshop showed:

- **Events are not homogeneous — they are typed.** Foringi A's model named
  distinct event kinds: **skipulagsfundur, sveitarfundur, flokksfundur,
  uppskeruhátíð, útilega, dagsferð** (#15), and the mót pattern (#57/#58). A
  generic `Event` cannot capture this — a flokksfundur and a sveitarfundur behave
  differently (parallel vs troop-wide).
- **A dagskrárhringur is natively a 2-D GRID, not a line.** Foringi A stated it
  explicitly — **time on the Y-axis, flokkar on the X-axis** — and the real term
  sheet shows it (#19). Signý drew the *same* grid independently (#25). The grid
  has **two row kinds: whole-troop bands** spanning all columns (sveitarfundur,
  útilega, holidays) vs **per-flokkur cells** each patrol fills. **This is normal
  term planning** — the line breaks here, not only at camps.
- **One dataset, multiple views.** Three projections of the *same* plan appeared:
  the **grid** (weeks × flokkar — overview, #19/#25), a **per-flokkur timeline**
  (time → meetings, legible per patrol — #21), and a **month calendar** (days ×
  weeks — scheduling, venues, holidays — #23). Signý named the trade-off: the grid
  is dense overview, the timeline is easier to read a single meeting (#21).
- **Tasks/elements need new dimensions.** The grid cells carry **multi-week
  spanning** projects (badge Part 1/Part 2 — #19), **status** (tentative/möguleg,
  draft, "Requires more planning", the "?" undecided marker — #19/#23/#24),
  **venue/location** (rotating per fundur — #23), and feed **derived worklists**
  (Innkaup/procurement column, "hvað þarf að framkvæma" — #19/#15/#1/#10).
- **Blocks are legó, but not bare activities.** Halldór's synthesis: everything is
  composable blocks at every scale (#26). But a block holding *only* the activity
  is "hard to grab" — it must carry its **theme + underlying learning** to be
  reusable (#52). Reuse is **copy-and-edit, not frozen** (#54/#62/#63), and is
  **parametrised by theme** (generic næturleikur + N themes — #62). Blocks are
  fractal — slot → fundur → camp → mót → year all reuse the same idea
  (#55/#57/#61).
- **ÆSKA is the envelope, not a field.** The whole dagskrá is "hjúpuð með ÆSKU";
  badges and youth-led meetings are expressions of it (#27). ÆSKA wraps the
  blocks; it is not one optional column.
- **Endurmat is written and travels with reuse.** Verbal-only endurmat means "we
  repeat the same mistakes" (#45). Written endurmat must resurface when planning
  the same thing again (#48), and event-level endurmat goes into the council
  archive (#46).

## Decision

**We will type and scope Events, model the cycle as a 2-D grid rendered as three
views of one dataset, extend Task with planning dimensions, and model planner
content as purpose-bearing, copy-and-edit, theme-parametrised blocks.**

### 1. Event gains `type` and `scope`

- **`Event.type`** — discriminator over: `skipulags` · `sveitar` · `flokks` ·
  `uppskeru` · `útilega` · `dagsferð` · `mót` (#15/#57). Type drives default slot
  sets and behaviour.
- **`Event.scope`** — `troop-wide` vs `per-flokkur` (#19/#25). Troop-wide events
  span all grid columns; per-flokkur events occupy a single patrol's column. This
  is what lets parallel flokksfundir coexist in the same period (#11/#15).

### 2. The cycle is a week×flokkur grid, rendered as three views of one dataset

- The canonical structure of a `Cycle` is a **2-D grid: weeks (Y) ×
  flokkar (X)** (#19/#25), plus utility columns (ATH/notes, Innkaup/procurement).
- **One dataset, three views** — the model stores the grid once; the UI renders:
  1. **Grid** — weeks × flokkar overview (#19/#25);
  2. **Per-flokkur timeline** — one patrol's meetings over time (#21);
  3. **Month calendar** — days × weeks for scheduling, venues, holidays (#23).
  These are projections/filters, **not separate tools or duplicated data.** The
  per-flokkur timeline is the natural default for working on meetings; the grid is
  the zoom-out overview (#21).

### 3. Task/element additions

`Task` (the dagskrárliður / grid cell content) gains:

- **Multi-week spanning** — an element may span several weeks (badge Part 1/2,
  multi-meeting projects) (#19).
- **Status** — `tentative` / `draft` / `confirmed`, plus the first-class **"?"
  undecided / to-fill marker** ("möguleg", "Requires more planning") (#19/#23/#24).
- **Venue / location** — a fundur has a place, rotating per meeting (#23).
- **Derived worklists** — procurement/shopping and "hvað þarf að framkvæma" are
  **derived from the plan** (the Innkaup column), not free-typed; export ≠ just
  print (#19/#1/#10).

### 4. Planner block model

- **Blocks = legó, parametrised by theme and carrying context.** A reusable block
  bundles the activity **with its envelope: theme + ÆSKA/þroskasvið + underlying
  learning** (#52/#27) — a bare activity is "hard to grab." A generic block (e.g.
  generic næturleikur) is **re-skinned by a theme parameter** to produce variants
  (#62).
- **Copy-and-edit, not frozen.** Reuse clones a starting point you then adapt
  (#54/#62/#63); templates are launchpads, not cages.
- **Fractal reuse** — the same block abstraction applies at slot → fundur → camp →
  mót → year scale (#55/#57/#61), consistent with ADR-001's hierarchy and the legó
  synthesis (#26).
- **ÆSKA = the envelope, not a field** (#27) — blocks live *inside* ÆSKA;
  ÆSKA/þroskasvið is the wrapper that a coverage/balance view can later read off
  (latent, lower priority).
- **Endurmat is written and travels with reuse** (#45/#48) — an endurmat note
  attaches to a block/fundur/event/cycle, is retained, and **resurfaces when the
  same thing is planned again** (clone-last-year carries its lessons). Event-level
  endurmat is promoted to the council archive (#46); routine endurmat stays
  lightweight and optional (#47).

## Consequences

### Positive

- **The model finally fits how leaders plan** — the grid is what two people drew
  independently (#19/#25); typed/scoped events capture the real parallel structure.
- **Beats Excel on its own terms** — one dataset behind grid + timeline + calendar
  removes the manual re-keying that is today's top pain (#11/#19).
- **Blocks-with-context make reuse meaningful** (#52) and serve the new/rotating
  leader: low-prep handoff, theme-parametrised variants, and lessons that travel
  (#45/#48/#57).
- **Status / venue / multi-week / worklists** unblock progressive detailing,
  scheduling, and derived outputs that have no home today.

### Negative

- **Significant UI surface for a small dev team** — three coordinated views over
  one model, drag/edit semantics, status states, and multi-week spanning are a
  lot of frontend. Sequence the views (timeline + grid first; calendar next).
- **Type/scope add branching logic** — default slot sets per event type, troop-wide
  vs per-flokkur rendering, and span handling raise complexity in services and UI.
- **Theme-parametrised blocks need a data design** (generic block + theme overlay)
  that is more than a flat copy; risk of over-engineering if pushed too early.

### Neutral

- ÆSKA coverage/balance is *latent* — modelled as the envelope now, but a coverage
  view is a later, lower-priority feature (cluster F, few dots #92/#27).
- Slot sets per event type are **editable defaults** (meetings: setning/dagskrá/
  leikur/slit/endurmat #6; camps: kvöldvaka/næturleikur/matur/smiðjur/dagskrá #61),
  not hardcoded — an implementation detail of the block library.
- Derived worklists are a *projection* of the plan; their export/print format is a
  spec detail (cluster I, small #96).

## Alternatives Considered

### A. Keep `Event` untyped + a single linear list — *not chosen*
A flat ordered `Event → Task` per cycle. **Rejected:** cannot represent parallel
per-flokkur meetings or troop-wide bands; the line provably breaks in normal term
planning (#19/#25), and a homogeneous Event can't drive type-specific slot sets
(#15/#61).

### B. A separate "camp" / "mót" structure for 2-D needs — *not chosen*
Handle parallelism only for camps with a bespoke grid. **Rejected:** the grid is
needed for *normal* terms too (#11/#19/#25), so a camp-only 2-D model would still
leave the common case linear. One grid generalises (consistent with ADR-001 alt D).

### C. Three independent views with separate data — *not chosen*
Build grid, timeline, calendar as separate tools/datasets. **Rejected:** they are
the *same* plan seen three ways (#19/#21/#23); duplicating data guarantees drift
and triples maintenance for two people. One model, multiple projections.

### D. Blocks as atomic, context-free activities — *not chosen*
Model reusable blocks as bare activities. **Rejected:** explicitly reported as
"hard to grab" (#52); reuse only works when theme + learning + ÆSKA ride along
(#27/#52), and themes must be a parameter over generic blocks (#62).

## References

- `meeting-notes.md` — "Model decisions", "Findings against the open questions
  (§9)"; ábendingar #6, #11, #15, #19, #21, #23, #24, #25, #26, #27, #45, #46,
  #47, #48, #52, #54, #55, #57, #58, #61, #62, #63, #92.
- `assets/foringi-a-dagskrarhringur-grid.avif` (#19), `assets/foringi-a-heildarmynd.avif`
  (#23), `assets/foringi-c-fundur.avif` (#24), `assets/signy-samnyting-adfanga.avif` (#25).
- Related ADRs: [ADR-001](./adr-001-dagskra-vs-program.md),
  [ADR-003](./adr-003-resources-and-registries.md).
