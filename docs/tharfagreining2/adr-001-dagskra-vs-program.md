---
artifact: adr
version: "1.1"
created: 2026-05-31
updated: 2026-06-01
status: accepted
---

# ADR-001: A multi-level temporal hierarchy above `Program`

## Status

**Accepted** — 2026-06-01.

**Date:** 2026-05-31 (drafted) → 2026-06-01 (accepted from phase-2 needs workshop)
**Deciders:** Halldór Valberg, Signý

> Eventual home: `docs/decisions/` in the slodi repo. Kept in
> `docs/tharfagreining2/` for now alongside the workshop record. Built with the
> `develop-adr` skill (Nygard format).
>
> **Related:** [ADR-002](./adr-002-event-typing-and-grid.md) (Event typing + the
> grid, the planner block model) · [ADR-003](./adr-003-resources-and-registries.md)
> (resources + registries — later phase).

## Context

Phase 2 introduces the Planner (dagskrárgerð). The central question was how the
user-facing concept of a **dagskrá** maps onto the existing data model.

Current model:

```
Program → Event → Task   (Task ordered by order_index, with timing)
```

The workshop (1 June 2026) probed three planning scales — **skátafundur** (one
meeting), **dagskrárhringur** (a term/cycle of meetings), **útilega / mót**
(multi-day, possibly parallel) — to find where the model strains.

What the evidence showed:

- **There is a real entity *above* `Program`, and it is multi-level.** Foringi A
  laid out the explicit stack — `starfsár (work year / heildarmynd) →
  dagskrárhringur (cycle) → typed meetings + special events → activities` (#15).
  A félag-year **starfsáætlun** (#1) and **markmið set at the cycle level** (#5)
  corroborate. Today's `Program → Event → Task` is **missing ≥1 level on top** —
  there is no home for the work-year overview or for a cycle as a first-class
  object.
- **A dagskrárhringur is reused as an annual scaffold** — Foringi A ran the same
  grid structure in 2022 and 2024, only re-peopling the columns (#22). The cycle
  layout is a durable, copyable frame, which only makes sense if the cycle is a
  modelled entity.
- **Excel is the painful incumbent** at the cycle scale (#11, #15, #19) — the
  highest concrete pain of the day (~4/5). The hierarchy is what leaders are
  hand-maintaining in spreadsheets today.
- **Camps did not require a separate model.** The útilega/mót shape (parallel
  tracks, logistics) turned out to be the **same 2-D grid** that normal term
  planning already needs (#19/#25/#61) — see ADR-002. So the line breaks in
  *normal* planning, not uniquely at camps, and one generalised structure covers
  both.

Forces at play:

- **Volunteer capacity** — built by a small dev team (≈5 developers, 2 lead) within
  a ~15-person volunteer project; favours a well-scoped model change, as a
  multi-level hierarchy is a real migration cost.
- **Conceptual fit** — leaders genuinely think top-down (heildarmynd → cycles →
  meetings → liðir); a model that mirrors this is learnable and matches the
  legó/composable mental model (#26).
- **Existing polymorphic base** — `Program/Event/Task` already share a `Content`
  base, so extending the chain *upward* fits the grain of the codebase rather
  than fighting it (#26).

## Decision

**We will introduce a multi-level temporal hierarchy above `Program` and make the
cycle a first-class entity. The planning spine becomes:**

```
WorkYear → Cycle → Event{type, scope} → Task(+context)
```

- **`WorkYear`** (work year / heildarmynd) — the top-level container; the year
  overview leaders build and hang on the wall (#15, #1). Holds year-level goals
  and the assembled master view.
- **`Cycle`** (cycle/term) — a first-class entity grouping the meetings
  and events of one term. Carries cycle-level **markmið** (#5), is opened by a
  skipulagsfundur (#19), and is itself **copyable as an annual scaffold** (#22).
- **`Event{type, scope}`** — the meeting/event level, now **typed and scoped**
  (full treatment in ADR-002). This is roughly where today's `Event` sits, but it
  gains a type discriminator (skipulags/sveitar/flokks/uppskeru/útilega/dagsferð/
  mót) and a scope (troop-wide vs per-flokkur).
- **`Task(+context)`** — the dagskrárliður, now able to carry its purpose/context
  envelope (markmið, theme, ÆSKA, learning) rather than being a bare activity
  (#5/#27/#52; see ADR-002).

Today's `Program` is **subsumed by `Cycle`** at the cycle level: the
thing leaders call a "dagskrá" at term scale *is* the cycle, not a generic
`Program`. We extend the existing polymorphic `Content` chain upward rather than
inventing a parallel concept.

## Consequences

### Positive

- **Mirrors the leaders' actual mental model** (#15/#1/#5) — the product is
  learnable because it matches how they already think top-down (heildarmynd →
  cycles → meetings → liðir).
- **Gives the year overview / cycle a real home** — unblocks the most-corroborated
  need of the day, the shared master plan / heildardagatal (#11/#15/#16/#18),
  which had no entity to attach to before.
- **Annual reuse becomes first-class** — copying last year's cycle scaffold (#22)
  and generating a new starfsáætlun (#1) are natural operations on real entities.
- **Cycle-level markmið get a home** (#5), and the "why" can attach above `Task`
  rather than being a per-task afterthought.
- **Extends, not replaces, the polymorphic `Content` base** (#26) — fits the
  existing grain; the block/legó abstraction stays uniform across scales.

### Negative

- **Migration cost** — new tables/levels, new relationships,
  data migration of existing `Program` rows into the cycle level, and updated
  repositories/services/schemas. This is the real price and the main reason the
  smaller alternatives were tempting.
- **More model surface to maintain** — more entities means more permission checks,
  more API endpoints, more UI states for a volunteer team.
- **Risk of over-modelling for casual leaders** — the full stack is what
  *structured* planners (Foringi A) need; a low-frequency/casual leader may only
  ever touch the meeting level. The upper levels must stay optional, not forced.

### Neutral

- The meeting still decomposes into ordered, timed elements as before — the
  skátafundur → ordered Tasks fit holds (#6/#24); only the levels *above* the
  meeting are new.
- `mót` is absorbed as an Event *type* + grid scope rather than a separate model
  (see ADR-002), so this hierarchy is the single planning spine for all scales.
- Naming of the entities (Icelandic `WorkYear`/`Cycle` vs. English
  internal names) is an implementation detail to settle in the spec, not a
  modelling decision.

## Alternatives Considered

### A. Reuse `Program` as the dagskrá (minimal change) — *not chosen*
`Program` = the dagskrárhringur (term), `Event` = a skátafundur, `Task` = a
dagskrárliður. No new tables. **Rejected because** it has no home for the
**starfsár / heildarmynd** level that leaders explicitly described (#15/#1), no
cycle-level goal attachment (#5), and no clean place for the annual scaffold reuse
(#22). The room's mental model is ≥3 levels, not the two `Program` offers.

### B. Introduce a single entity **above** `Program` — *closest, but extended*
New `Cycle` containing `Program`s. **This is the closest alternative and
the basis for what we chose**, but a *single* extra level is not enough: Foringi A's
model has both a **cycle** *and* a **work-year (starfsár)** above the meeting
(#15). We therefore extend B to a **multi-level** hierarchy
(`WorkYear → Cycle → Event → Task`).

### C. New dedicated `Dagskra` entity separate from `Program` — *not chosen*
Keep `Program` as a bank/catalog item and add a distinct planning entity.
**Rejected because** it creates two overlapping concepts to keep in sync, with
duplication and ambiguity about which is "the dagskrá." Extending the existing
`Content` chain (#26) avoids the parallel-concept tax.

### D. Separate model for camps (útilega/mót) — *not chosen*
A linear model for meetings plus a distinct 2-D model for camps. **Rejected
because camps did not need a separate model:** the same 2-D week×flokkur grid that
normal term planning requires already generalises to camps and móts
(#19/#25/#61) — see [ADR-002](./adr-002-event-typing-and-grid.md). Building and
maintaining two planners is unjustified for a small volunteer dev team when one
generalised structure covers both.

> Kill criterion (workshop §1): the Planner need was **not** low-pain — Excel is a
> real, painful incumbent (#11/#15/#19), so the Planner (and this ADR) proceed.
> Caveat: we have mostly heard from structured planners; watch for a casual,
> low-frequency leader before assuming the full hierarchy is universally wanted.

## References

- `meeting-notes.md` — "Findings against the open questions (§9)", "Model
  decisions"; ábendingar #1, #5, #11, #15, #19, #22, #25, #26, #61.
- `tharfagreining2.md` — §5.1 three scales, §9 open questions, glossary.
- `docs/functional_requirements.md` — FR-B (Program Bank), FR-E (Events), FR-T (Tasks)
- Related ADRs: [ADR-002](./adr-002-event-typing-and-grid.md),
  [ADR-003](./adr-003-resources-and-registries.md)
- Related skill: `discover-journey-map` (cyclical journey ≈ dagskrárhringur)
