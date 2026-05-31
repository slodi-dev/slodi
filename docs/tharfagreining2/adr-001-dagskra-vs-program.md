---
artifact: adr
version: "1.0"
created: 2026-05-31
status: draft
---

# ADR-001: Data model for "dagskrá" — reuse `Program` or introduce a new entity

## Status

**Proposed** — STUB, to be completed from the phase-2 needs workshop (1 June 2026).

**Date:** 2026-05-31 (drafted) → decide after workshop
**Deciders:** Halldór Valberg, Signý Kristín Sigurjónsdóttir

> Pre-staged so we can fill **Decision** and **Consequences** straight from
> Exercise 1 ("How do you picture it?", three scales). Target home once accepted:
> `docs/decisions/` (or `docs/adr/`) in the slodi repo. Built with the
> `develop-adr` skill (Nygard format).

## Context

Phase 2 introduces the Planner (dagskrárgerð). The central unresolved question is
how the user-facing concept of a **dagskrá** maps onto the existing data model.

Current model:

```
Program → Event → Task   (Task ordered by order_index, with timing)
```

In the workshop we are probing three scales of planning, each of which stresses
the model differently:

- **skátafundur** — a single meeting; a linear, ordered set of activities.
- **dagskrárhringur** — a whole term/season; a *sequence of meetings* that hang
  together by theme, progression, and ÆSKA/þroskasvið balance.
- **útilega / mót** — multi-day, possibly **parallel tracks** (days × tracks),
  with logistics (food, sleep, gear) that may or may not be "dagskrá".

Forces at play:
- **Volunteer capacity** (two maintainers) — strongly favours the smallest model change that works.
- **Conceptual fit** — if leaders think of "dagskrá" as the *term cycle*, then today's `Program` may actually be the cycle and the meeting should be the `Event` — or we may need an entity *above* `Program`.
- **Camps may break linearity** — the linear `Event → Task` chain may not represent parallel tracks; forcing it could create a tool that can't plan an útilega.
- **Open metadata gap** — the "Why / greater purpose" dimension of a dagskrárliður may have no home on `Task` today (see workshop §5.1).

Key evidence to capture in the workshop (fill in):
- [ ] Which scale do leaders call a "dagskrá"? (record exact terminology)
- [ ] Does the meeting sketch map cleanly onto `Event → ordered Tasks`?
- [ ] Is there a real entity *above* `Program` in their mental model?
- [ ] Do útilegur need a 2-D (days × tracks) representation, i.e. break the line?

## Decision

> **TBD — complete after the workshop.** State in active voice: "We will…"

[State the chosen mapping clearly once findings are in.]

## Consequences

> **TBD — complete after the workshop.**

### Positive
- [ ]

### Negative
- [ ]

### Neutral
- [ ]

## Alternatives Considered

### A. Reuse `Program` as the dagskrá (minimal change)
`Program` = the dagskrárhringur (term), `Event` = a skátafundur, `Task` = a
dagskrárliður. No new tables. *Risk:* may not match how leaders think; no clean
home for a single-meeting-as-first-class object or for camps.

### B. Introduce an entity **above** `Program`
New `Dagskrárhringur` (term/cycle) containing `Program`s, where `Program` becomes
a single meeting's dagskrá. *Risk:* larger migration; more model surface for two
maintainers.

### C. New dedicated `Dagskra` entity, separate from `Program`
Keep `Program` as the bank/catalog item; add a distinct planning entity. *Risk:*
two overlapping concepts to keep in sync; duplication.

### D. Separate model for camps (útilega/mót)
Linear model for meetings + a distinct 2-D (days × tracks) model for camps.
*Risk:* two planners to build and maintain; only justified if camps clearly break
the line.

> Decide among these (or a hybrid) based on workshop evidence. Note the kill
> criterion (workshop §1): if the planning need turns out low-pain, the whole
> Planner — and this ADR — may be deferred.

## References

- Workshop prep: `~/dev/tharfagreining2/tharfagreining2.md` (§5.1 three scales, §9 open questions)
- `docs/functional_requirements.md` — FR-B (Program Bank), FR-E (Events), FR-T (Tasks)
- Related skill: `discover-journey-map` (cyclical journey ≈ dagskrárhringur)
