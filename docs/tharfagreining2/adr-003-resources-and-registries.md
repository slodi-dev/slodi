---
artifact: adr
version: "1.0"
created: 2026-06-01
status: proposed
---

# ADR-003: Resources, bookings, and félag registries

## Status

**Proposed** — later phase, explicitly **not build-first**.

**Date:** 2026-06-01 (from the phase-2 needs workshop)
**Deciders:** Halldór Valberg, Signý (to revisit when the core Planner exists)

> Eventual home: `docs/decisions/`. Kept in `docs/tharfagreining2/` for now.
> Built with the `develop-adr` skill (Nygard format).
>
> **Depends on** [ADR-001](./adr-001-dagskra-vs-program.md) and
> [ADR-002](./adr-002-event-typing-and-grid.md) — resources and registries hang
> off the hierarchy and grid those ADRs define.

## Context

The workshop surfaced a coherent "auðlindanotkun" (resource usage) theme plus
several félag-level registries. These are real, recurring needs — but they are a
**large surface** and the build-first set (A/B/J + C, plus lightweight D) does not
include them. This ADR records the decision *to defer*, with enough shape that the
later build is unambiguous.

What the evidence showed:

- **Shared physical resources clash across parallel flokkar.** Foringi D's "mesta
  vesenið": with many patrols running at once, the **eldhús (kitchen)** gets
  double-booked or used 3× by one flokkur (#11). This is *not* in today's model.
  Signý framed the grid itself as the **"samnýting aðfanga"** surface — where
  shared-resource conflicts become visible and resolvable (#25). Venues rotate per
  fundur and a venue is a bookable resource (#23). Location shapes the dagskrá
  (#62).
- **Equipment registry + bookings + cross-félag coordination.** Register under a
  félag, keep a **búnaðarskráning** so you know "hvað þú getur gert", declare when
  gear is in use, and possibly **borrow across félög** (#12). *(Note §7 framing
  caveat: #12 was phrased as a solution; the underlying needs are inventory
  awareness, not double-booking — a generalisation of #11 — and cross-group
  coordination.)*
- **Leader skills / qualifications registry.** "Who can run klifur" — register
  leader competencies so activities can be matched to a qualified leader, tied to
  **Safe from Harm** safeguarding (#13).
- **Member / badge registries at félag scope.** Closing-vote cluster H (félag
  registries: members / equipment / badges / leader-skills) drew 3 dots
  (#72/#78/#86); badges already double as movement-wide program templates (#60).

Forces at play:

- **Volunteer capacity** — equipment management, inter-félag lending, and
  qualification/Safe-from-Harm compliance are each a *big* surface. None can be
  done well by the dev team (≈5, 2 lead) while the core Planner is still being built.
- **Sequencing** — resources/registries are most useful *after* A (the grid),
  J (roles/access), and B (templates) exist to hang them on. The grid is already
  the natural UI home for clash detection (#25), so deferring loses nothing
  structurally.
- **Compliance gravity** — Safe from Harm (#13) and persónuvernd touch minors and
  safety; doing them later, deliberately, is safer than rushing them.

## Decision

**We will model resources, bookings, and félag registries as a later phase, not in
the build-first set. We record the intended shape now so the future build is
clear, and we do not start implementation until the core Planner (ADR-001/002) is
in place.**

Intended later shape:

- **`Resource`** — a schedulable thing at félag scope: **venues/rooms** (e.g.
  eldhús, skátaheimilið, #11/#23), **equipment/gear** (#12), and — by extension —
  **human capability** (leader qualifications, #13). One concept covering places,
  gear, and people-as-capability.
- **Bookings + clash detection across flokkar** — a `Resource` can be booked to a
  week/event; the system **detects collisions** when parallel flokkar contend for
  the same resource (#11). The week×flokkur **grid is the UI surface** for
  surfacing and resolving these (#25); venues plotted on the calendar carry the
  scheduling view (#23).
- **Félag registries** (#72/#78/#86/#13):
  - **Members** — who is in the félag/sveit/flokkur;
  - **Equipment** — búnaðarskráning: what gear exists and its availability (#12);
  - **Badges** — the færnimerki catalogue (which also serve as program templates,
    #60 — coordinate with ADR-002's block library);
  - **Leader skills** — competency/qualification registry, "who can run klifur",
    tied to **Safe from Harm** (#13).
- **Cross-félag coordination** (borrow/coordinate gear between groups, #12) is the
  *furthest-out* layer — it depends on the super-workspace/community surface
  (cluster M) and is later still.

## Consequences

### Positive

- **Captures the resource/registry needs faithfully** (#11/#12/#13/#72/#78/#86)
  without letting them balloon phase-2 scope.
- **Clash detection has a natural home** — the grid (ADR-002) is already where
  samnýting happens (#25), so the later build slots in cleanly.
- **Safeguarding (Safe from Harm) is deliberately scheduled**, not rushed (#13).

### Negative

- **The kitchen-clash pain (~4/5, #11) is not relieved in v1** — the highest
  concrete resource pain waits. Mitigation: the grid's ATH/notes column (ADR-002)
  lets leaders flag clashes manually in the interim.
- **Inventory and qualification data entry is a real ongoing cost** to whoever
  maintains the registries; value depends on the data being kept current.

### Neutral

- The `Resource` concept spans places, gear, *and* people-as-capability — a
  unifying abstraction (#11/#12/#13) whose exact decomposition is deferred to the
  later design.
- Badges appear in two roles — registry entries here and program templates in
  ADR-002; the later build must reconcile them as one catalogue, not two (#60).

## Alternatives Considered

### A. Build resources/registries now, alongside the Planner — *not chosen*
**Rejected:** too large a surface to take on now; not in the build-first set;
most useful only after A/B/J exist to hang it on. Doing it now would starve the
core Planner.

### B. Free-text notes only (no modelled resources) — *partial interim*
Use the grid's ATH column to *note* clashes by hand (#19). **Adopted as the
interim**, not the end state: it relieves nothing systematically and gives no
cross-flokkur clash detection (#11/#25), but it costs nothing and buys time.

### C. Cross-félag lending as a first deliverable — *not chosen*
**Rejected:** depends on the super-workspace/community surface (cluster M, the
biggest surface of all) and on per-félag registries existing first (#12). Furthest
out, not first.

## References

- `meeting-notes.md` — "Model decisions" (later entities), "Final cluster tally"
  (cluster H), "Findings against the open questions (§9)" (resource clash);
  ábendingar #11, #12, #13, #23, #25, #60, #62, #72, #78, #86.
- `post-processing.md` — step 5 (later: `Resource`/venue + félag registries) and
  step 6 (build-first cap of 5 excludes these).
- Related ADRs: [ADR-001](./adr-001-dagskra-vs-program.md),
  [ADR-002](./adr-002-event-typing-and-grid.md).
