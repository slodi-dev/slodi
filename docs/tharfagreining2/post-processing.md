# Post-processing — þarfagreining vol2

What to do now that the workshop (1 June 2026) is captured. Goal: turn the **raw
capture** into **decision-ready, buildable artifacts** — faithfully, separating
*what participants said* from *what was inferred live*.

## Inputs
- `meeting-notes.md` — 97 ábendingar (#1–#97) + closing vote tally + a first synthesis.
- `assets/` — 4 participant sketches (Foringi A grid/calendar, Foringi C fundur, Signý grid).
- Padlet export PDF (in `~/Downloads`) — board snapshot up to ~13:52 (jokes stripped).
- `tharfagreining2.md` (the plan), `adr-001-dagskra-vs-program.md`.

## Why process at all
`meeting-notes.md` is **live, lossy, interpretation-heavy** capture (terse Icelandic
post-its + Claude's "Interpretation/Maps to" layer). Before it drives expensive build
decisions it must be made **trustworthy**: verified, de-duplicated, need-not-solution,
prioritised, model-decided, scoped.

## Steps

- [ ] **1. Reconcile capture.**
  - Apply the **handle→name key** (top of `meeting-notes.md`) to all `Source:` fields;
    fill the `_TBD_` sources from the Padlet authors.
  - Fix the 3 known mislabels: **#14** → PEACEFUL BUG (unidentified), **#16/#17/#18** → Foringi B.
  - 4 handles stay **unidentified** (SEEDLING PLANTER, PEACEFUL BUG, HELPFUL TIGER,
    PEACEFUL PLATYPUS) — leave as-is.
  - Note: #51–#64 (templates) and #90–#97 were **verbal/post-export** — board doesn't cover them.

- [ ] **2. Need vs. solution (§7 why-ladder).** Many ábendingar are feature-framed
  (búnaðarskráning, App, Abler.io). Dig each to the underlying need before building.

- [ ] **3. Ábendingar → user stories** in the §8 schema:
  `As a [role] I want [X] so that [Y]` · pain /5 · frequency · who.

- [ ] **4. Clean clusters + reconcile the vote.** Tidy A–N (de-dupe, merge). **Dots ≠ value:**
  - **C** (assign/notify ahead) = 1 dot but ~4/5 **pain** (#33/#39).
  - **D** (endurmat loop) = 0 dots but cheap + strong in discussion (#45/#48).
  - **J** (access/sharing) + **M** (community) dominated the vote — §5.2 had *dropped* RBAC.

- [ ] **5. Model decisions → ADR** (extend `adr-001`):
  `Starfsár → Dagskrárhringur → Event{type, scope} → Task(+context)`; legó blocks
  parametrised by theme; ÆSKA = the envelope; endurmat written + travels; later:
  `Resource`/venue + félag registries.

- [ ] **6. Prioritise → build-first set (cap 5) + explicit NON-goals.** Draft recommendation
  in `meeting-notes.md` synthesis: **A** (one-source grid) · **J** (access/sharing) ·
  **B** (templates) · **C** (assign/notify) · **E** (activity bank). Decide minimum scope w/ Signý.

- [ ] **7. Map to spec.** Write up `docs/features/planner.md`; update
  `functional_requirements.md`; sketch user flows for the build-first items.

- [ ] **8. Close the loop.** Send participants a thank-you summary showing their input
  shaped the decisions (sustains engagement for the template dot-vote round).

## Small leftovers to fold in
- Scroll-position UX (Foringi F): preserve position on back-nav (don't jump to top).
- Emphatic "SNIÐMÁT" vote (Foringi G) → extra weight to **B**.
- Resolved already: **🅰️ youth-as-users (#97)** = leaders' tool; youth view-only. Age-appropriateness is honour-system guidance, **no technical age lock** (D8, `decisions-log.md`).

## Open decision
- **Privacy:** `meeting-notes.md` + sketches name real people on a **public** repo;
  the board kept most pseudonymous. Decide whether to keep names or scrub before this
  spreads.
