# Feature Spec: Planner (Dagskrárgerð)

**Status:** Draft
**Date:** 2026-06-01
**Target users:** Scout leaders (foringjar) — Slóði is a **leaders' tool** (#97). Youth/parents are view-only audiences, never account holders.
**Implements:** post-processing.md step 7
**Source:** `meeting-notes.md` (#1–#97), `prioritisation.md` (build-first cap of 5)

> **Reading note — volunteer team, prudent scope.** Slóði is built by a ~15-person
> volunteer team (≈5 developers incl. 2 leads; 6 in testing & endurmat; 3 in content
> moderation). Engineering capacity is the dev team, so scope is kept disciplined —
> everything below is sequenced so the smallest useful slice ships first. The spec
> deliberately *defers* large surfaces (resources, registries, community,
> integrations) — see [§7 Out of scope](#7-out-of-scope-phase-2) and the non-goals
> in `prioritisation.md` (d).

---

## 1. Data model (validated)

The Planner sits on the temporal hierarchy decided in the ADRs. **This spec
references the ADRs rather than re-deriving them** — read them for the evidence and
alternatives:

- [ADR-001](../tharfagreining2/adr-001-dagskra-vs-program.md) — the hierarchy above `Program`.
- [ADR-002](../tharfagreining2/adr-002-event-typing-and-grid.md) — Event typing, the grid, the block model.
- [ADR-003](../tharfagreining2/adr-003-resources-and-registries.md) — resources + registries (**later phase, not here**).

### 1.1 The planning spine

```
WorkYear  (work year / heildarmynd)        ── top-level container, year goals (#15, #1)
  └── Cycle  (cycle / term)       ── first-class, copyable scaffold (#5, #22)
        └── Event { type, scope }           ── typed + scoped meeting/event (#15, #19, #25)
              └── Task (+context)           ── dagskrárliður; carries purpose/status/venue (#5, #27)
```

> **Naming (D6, `../tharfagreining2/decisions-log.md`).** Code identifiers are
> **English** — `WorkYear` (UI label: "starfsár"), `Cycle` (UI label:
> "dagskrárhringur"); `Event` and `Task` keep their names. All Icelandic stays in the
> UI; the codebase reads in English.

Today's `Program` is **subsumed by `Cycle`** (ADR-001). We extend the
existing polymorphic `Content` chain upward, not invent a parallel concept.

- **`Event.type`** — `skipulags · sveitar · flokks · uppskeru · útilega · dagsferð · mót` (#15/#57). Drives default slot sets.
- **`Event.scope`** — `troop-wide` (spans all grid columns) vs `per-flokkur` (one patrol's column) (#19/#25). This is what lets parallel flokksfundir coexist.
- **`Task` additions** (ADR-002 §3): multi-week **spanning** (badge Part 1/2, #19), **status** (`tentative`/`draft`/`confirmed` + the first-class **"?" to-fill marker**, #19/#23/#24), **venue/location** (rotates per fundur, #23), and an **endurmat note** that travels on reuse (#45/#48).

> **Optionality is a hard requirement** (ADR-001 negative consequence). A casual,
> low-frequency leader must be able to work at the `Event`/`Task` level without ever
> touching `WorkYear`/`Cycle`. The upper levels are scaffolding, not gates.

### 1.2 The three views (one dataset, three projections)

The `Cycle` is stored once as a **week×flokkur grid** and rendered three
ways (ADR-002 §2). These are **projections/filters, not separate tools or duplicated
data**:

| View | Axes | Use | Ábending |
|------|------|-----|----------|
| **Grid** | weeks (Y) × flokkar (X) + utility cols (ATH, Innkaup) | dense term overview, balance across patrols | #19, #25 |
| **Per-flokkur timeline** | time → one patrol's meetings | the natural default for working on a meeting; legible | #21 |
| **Month calendar** | days × weeks | scheduling, venues, holidays | #23 |

**Build order for the views (sequencing for the dev team):**
1. **Per-flokkur timeline first** — it is the default working surface and the closest to today's `Program → Event → Task` editor.
2. **Grid** — the zoom-out overview; the higher-value, higher-effort surface.
3. **Month calendar** — last; scheduling layer.

---

## 2. Tier 1 — most needed (the build-first core)

These six clusters are **Tier 1** of the 6-month roadmap
(`../tharfagreining2/roadmap.md`); the spine (A · J · B · C · E) was **ratified (D1,
`../tharfagreining2/decisions-log.md`)** pending a quick formal Note-and-Vote, and
**D (endurmat) was promoted into Tier 1 (D2)**. Each is justified by votes · pain ·
foundational dependency. The rest of this document specs them in order.

> **Priority order, not strictly serial (5-dev team).** Run independent tracks in
> parallel where dependencies allow: **A** (the spine: entities + views) on the lead
> pair; **E** (the bank, which mostly reuses today's Program Bank + tags) on a second
> pair, since E has the least dependency on A; **D** (endurmat) by the testing &
> endurmat team once A's data model has the endurmat field. J · B · C still sequence
> after A (they consume its data model). See §4 and the roadmap.

| # | Cluster | Role here | Depends on |
|---|---------|-----------|-----------|
| **A** | One source of truth — grid / timeline / calendar | The spine + the 3 views. Everything hangs off it (#38). | — (root) |
| **J** | Roles, access tiers & sharing | Who can see/edit/receive. Builds on existing RBAC. | A |
| **B** | Templates / sniðmát (blocks) | Copy-and-edit blocks, type-aware launcher. | A |
| **C** | Assign & notify ahead | Per-meeting task/role assignment + lead-time push. | A, J |
| **E** | Activity / games bank | Mobile, searchable; feeds B's blocks. | (standalone; feeds B) |
| **D** | Written endurmat loop | Notes that resurface on reuse. Owned by the testing & endurmat team (D2). | A (endurmat field) |

**Still bundled (ride on A/B, no slot of their own):** **derived procurement
worklist** from the grid's Innkaup column (cluster I, #19/#39) and **latent ÆSKA
tags** for a later coverage view (cluster F, #27/#92). *(Endurmat was here too; it is
now first-class D, above — see its section below.)*

---

## A — Shared master plan (grid · timeline · calendar)

> **The need.** One authoritative home for the whole plan instead of Excel / Google
> Sheets / Drive docs / whiteboard / verbal hand-offs, so every co-leader is "með á
> nótunum" (#38, #16, #18, #82, #94). Highest concrete pain of the day — Excel is
> "mesta vesenið", ~4/5 (#11). Named the **precondition for everything else** (#38).
> User stories: **A1–A8**.

### Data-model touchpoints
- New entities **`WorkYear`** and **`Cycle`** above `Program`/`Event` (ADR-001). Migrate existing `Program` rows into the cycle level.
- `Event.type` + `Event.scope` (ADR-002 §1); `Task` gains span / status / venue / endurmat note (ADR-002 §3).
- The grid is the canonical store; timeline + calendar are read projections — **no duplicated tables** (ADR-002 alt C, rejected).

### Core user flows
1. **Open a cycle (skipulagsfundur, #19/#37).** Create a `Cycle` under the `WorkYear`, set cycle markmið (#5), pick the flokkar that form the X-axis. A casual leader can skip `WorkYear` and create a bare cycle.
2. **Lay out the term (grid).** Add troop-wide bands (sveitarfundur, útilega — span all columns) and per-flokkur cells. Mark cells `?` / tentative and detail later (#16/#24 — progressive detailing, A8).
3. **Work a meeting (timeline).** Switch to the per-flokkur timeline; open one fundur; edit its `Task`s (the dagskrárliðir). This is the everyday surface.
4. **Schedule (calendar).** Switch to the month view to set dates, venues (#23), and slot around holidays.
5. **Rolling window (A7, #28).** A "next ~4 fundir" filter on the timeline for the small horizon leaders actually work in.

### Bundled-lightweight on A
- **Endurmat note on Event/Task** that is retained and **re-shown when the same thing is planned again** (D1/D2/D3, #45/#48). Capture is **optional** for routine fundir, structured for events (#46/#47).
- **Innkaup/procurement column** on the grid → the buyer's list is *derived*, not free-typed (I2, #19/#15). Sending it is part of **C** below.

### Out of scope (A)
- **Real-time multi-cursor co-editing.** The need is shared *awareness* ("allir með á nótunum", #16), which shared-read + last-write-wins satisfies. Do **not** build live co-editing unless a later probe shows shared-read is insufficient (`prioritisation.md` d).
- **Auto-generated starfsáætlun document (A6, #1)** — keep as a thin later export; not v1.
- **Mót planning** — multi-track heavy logistics; útilega is an Event type, mót is **not** a phase-2 target (`prioritisation.md` d).
- **Version history (X2, #77)** — nice-to-have, later.

---

## J — Roles, access tiers & sharing

> **The need.** Runaway top vote (7 dots). Once the plan lives in-tool, contribution
> is frictionless (#94) — this is the collaboration unlock that §5.2 had wrongly
> dropped. Adds a council tier (#93), youth view-only (#97), parent partial view
> (#20). User stories: **J1–J8**.

### Builds on existing RBAC — incremental, not greenfield
Slóði already has `WorkspaceRole = viewer < editor < admin < owner`
(`backend/app/domain/enums.py`) enforced in `app/core/auth.py`. The Planner reuses
this and adds **two new capability shades**, not a new role system:

| Tier | Maps to / new | Can do | Story / # |
|------|---------------|--------|-----------|
| **Samforingi (co-leader)** | existing `editor`+ | co-edit the dagskrá | J1, #67/#30 |
| **Aðstoðarforingi (receive-tasks)** | **new shade** — `viewer` + assigned tasks | see the plan, receive *own* tasks/fyrirmæli, no edit | J2, #68/#30/#33 |
| **Starfsráð (council)** | existing `admin`/`owner` view | work in-tool, see archive/endurmat | J6, #93/#46 |
| **Partial view (parent / older youth)** | **new shade** — scoped read of the *dagskrá only* | see programme, never innri mál | J3/G1, #69/#20/#97 |
| **Youth (older)** | **not an account** | view-only read link; age-appropriateness by leader discretion, not a technical lock (D8) | #97, #79 |

> **The privacy line (J8/K, #79/#71/#97).** Member / badge / personal data is
> **félag-internal only**. The shareable surface is the *dagskrá* (the programme);
> **innri mál** (planning notes, endurmat, assignments, council records) is never
> exposed to view-only/partial tiers. This **content boundary** (not an age lock) is
> what actually keeps youth view-only safe — see D8.

### Core user flows
1. **Invite a co-leader** → existing workspace membership at `editor`.
2. **Add an aðstoðarforingi** → `viewer` + they appear in the assignee picker (ties C). They see the plan and a "your tasks" view, cannot edit.
3. **Share a read-only dagskrá link** (J4/G1, #70/#97) → generates a scoped, programme-only view (no innri mál). **No technical age lock (D8)** — who it's shared with is the leader's call, guided by our stated wish (dróttskátar/rekar yes, drekar/fálkar no; G4, #15/#97).
4. **Council tier** (J6, #93) → admins/owners see the cycle's archived endurmat + fundargerðir.

### Out of scope (J)
- **Youth / minor accounts** — RESOLVED non-goal (#97). No edit, no login for youth. De-risks the entire K safeguarding surface.
- **Rich parent portal** — parents "skoða lítið" (#20); a read-only tier is enough (`prioritisation.md` d).
- **Per-field / per-cell ACLs** — too granular to maintain; tiers are plan-level, with the innri-mál/dagskrá split as the only content boundary.
- **Individual profiles for follow/badges (J5, #80)** — only the *view-the-master* half is in scope; follow/social is community (M, deferred).

---

## B — Templates / sniðmát (blocks)

> **The need.** Strongest value-prop (#57–#59), emphatic "SNIÐMÁT" vote (Foringi G).
> Serves new leaders (run-as-is, low/zero-prep handoff) **and** veterans (remix)
> (#63/#64). Copy-and-edit, parametrised by theme. User stories: **B1–B14**.

### Data-model touchpoints (ADR-002 §4)
- **Blocks = legó carrying context.** A reusable block bundles the activity **with its envelope: theme + ÆSKA/þroskasvið + underlying learning** (#52/#27) — a bare activity is "hard to grab" (B3).
- **Copy-and-edit, not frozen** (#54/#62/#63) — reuse clones a starting point you then adapt (B4).
- **Generic block + theme parameter** (#62) — one generic næturleikur re-skinned per theme (B6).
- **Fractal reuse** — same block abstraction at slot → fundur → camp → year (#55/#57/#61, B5).
- **Default slot sets per `Event.type`** are **editable defaults**, not hardcoded (meetings: setning/dagskrá/leikur/slit/endurmat #6; camps: kvöldvaka/næturleikur/matur/smiðjur #61). The slots carry their own purpose/prompts (B13, #17).
- **Endurmat travels with the clone** (D3, #45/#48) — copying last year's scaffold carries its lessons.

### Core user flows
1. **Type-aware "create…" launcher (B2, #65).** "Hvað viltu gera í dag?" → búa til fund / útilegu, each loading the right slot skeleton + relevant templates.
2. **Assemble a meeting (B1, #6/#24).** Start from the fixed beinagrind (setning → dagskrá → leikur → slit → endurmat) and puzzle bank items / blocks into the slots.
3. **Save & reuse (B4/B5).** Save a fundur, cycle, or whole útilega as a template; clone next time ("same camp, swap the theme") and tweak.
4. **Færnimerki as runnable templates (B8/B9, #60/#92/#3).** Pull an official badge as a ready-made dagskrá, adapt, add to a fundur. (Catalogue source coordinates with ADR-003's badge registry — **one catalogue, not two**.)

### Out of scope (B)
- **A full theme-overlay engine** — start with plain clone-and-edit; the generic-block + theme-parameter design (#62) is the *direction*, not v1 (ADR-002 negative: risk of over-engineering).
- **Community template library / publishing (M3, #84)** — sharing templates beyond your workspace is community (M), deferred to phase 2.5/3.
- **Badge progress tracking per scout (H4, #78)** — that is a félag registry (ADR-003, minors' data); B only *runs* the badge as a template.

---

## C — Assign & notify ahead

> **The need — pain pick, not vote pick.** Top, recurring collaboration pain of the
> day: the "5 minutes before the meeting" scramble at informing + splitting tasks,
> "ógeðslega lélegur", ~4/5 (#33); procurement sent too late (#39); the JIT 15-min
> huddle (#43). Only 1 dot, but **pain ≫ dots** (`prioritisation.md` b). Cheap once A
> + J exist. User stories: **C1–C5**.

### Data-model touchpoints
- **Assignee** on `Task`/`Event` → a workspace member (reuses J's membership; aðstoðarforingjar are valid assignees via the new view-tier).
- **Per-item ownership** ("hver tekur ábyrgð á hverju", C3/#40) — `Task.owner`.
- **Derived procurement list** from the grid's Innkaup column (C4/#39, bundled-I) → a worklist, with a target lead time.
- A lightweight **notification** record (who, what, when sent).

### Core user flows
1. **Assign (C1/C3).** On a fundur, assign each `Task`/slot an owner from the team.
2. **Notify ahead (C1/C2).** Push the next meeting's plan + each aðstoðarforingi's tasks to them with lead time (email via existing Resend integration; in-app "your tasks today" glanceable view, C2/#68).
3. **Send procurement (C4/#39).** Generate the buyer's list from the Innkaup column and send to the starfsmaður "tímanlega".

### Out of scope (C)
- **A full notification/preference centre** — start with one email + one in-app list; no digest/SMS/push settings.
- **Pre/post-meeting structured workflow (C5/#43)** beyond the assign + endurmat-note primitives A/B already give.
- **SMART-goal tooling (#43)** — capture goals as free text at the cycle level (#5); no dedicated goal engine.

---

## E — Activity / games bank

> **The need.** Daily, in-the-moment use — grab a quick game live on a phone
> (#53/#29/#85); searchable fallback when planning or when scouts get stuck (#10);
> feeds **B** (blocks are assembled from bank items). 4–5 dots. User stories: **E1–E6**.

### Data-model touchpoints
- Largely **reuses today's Program Bank + Tag/ContentTag** (see `docs/features/tag-management.md` — tags already apply to content). The bank item is a `Task`-like content record with rich metadata (duration, energy, age, gear) and tags.
- **Favourites** (E4/#81) — a user↔content bookmark.
- A bank item, dropped into a slot, becomes a **block** (the B handoff): the bank is where B's blocks come from.

### Core user flows
1. **Quick lookup (E1, mobile).** Filter by duration / energy / age / gear; grab a game in the moment.
2. **Search while planning (E2/E3, #73).** Better tags (fill gaps like "eldur"), text search; pull into a fundur.
3. **Favourite (E4).** Bookmark items for fast reuse.
4. **Scouting-specific types (E6, #54).** Model hróp / kvöldvökur / songs as first-class, editable bank content — not just generic "activities".

### Out of scope (E)
- **Community curation / dedup at scale (E5, #89)** — raises §9 "who maintains quality?"; that is a community (M) concern, deferred. Build basic create/search/favourite first.
- **Native mobile app** — mobile means **responsive web / PWA** (#88, X1; confirm intent in §9). No app-store client.

---

## D — Written endurmat loop

> **The need — promoted to first-class (D2, `../tharfagreining2/decisions-log.md`).**
> Verbal-only endurmat means "we repeat the same mistakes because it wasn't written
> down" (#45, ~4/5 pain); reviewing the previous run's notes is the payoff, especially
> for a new mótstjórn taking over (#48). Originally bundled-lightweight; **promoted**
> because the **6-person testing & endurmat team owns it** — capacity is no longer the
> constraint. User stories: **D1–D6**.
>
> ⚠️ **To be confirmed with Signý** before build.

### Data-model touchpoints
- **Endurmat note** on `Task` / `Event` / `Cycle` (the field already added in A; ADR-002 §4).
- **Travels with reuse** — cloning a block/template carries its endurmat note along (B's copy-and-edit, D3).
- **Council archive** — event-level endurmat is promoted to the starfsráð archive (#46), surfaced via J's council tier.

### Core user flows
1. **Capture (low-friction, #47).** Optional one-line "hvað gekk vel / hvað mátti betur" on a routine fundur; structured written endurmat on an event (#46/#49).
2. **Resurface (passive, D7).** Opening or cloning a recurring event/template shows last time's endurmat in a side panel — never a blocking prompt.
3. **Archive & review.** The council tier (J6) browses a cycle's filed endurmat + fundargerðir (#35/#46).

### Scope guard
- **Not a heavy form.** The endurmat team owns the resurfacing UX; capture stays near-zero-friction (#47). Routine endurmat is skippable; only events force the structured version.
- **Owner:** the 6-person testing & endurmat sub-team.

---

## 3. Cross-cutting constraints (not slots)

These constrain how A–C/E are built; they are not separate features
(`prioritisation.md` d):

- **Mobile + desktop responsive web / PWA (#88, decided D3).** Optimise the web for both mobile and desktop; **no native app yet.** In-the-moment use (E, live game grab) is phone; heavy planning (grid) is desktop. Planner drag must stay smooth (FR 5.1, 60 fps).
- **K — Safeguarding guardrail (#71/#79/#97).** No open youth-to-youth channels; minors' data stays félag-internal; the dagskrá/innri-mál split (J8) is the **technical** enforcement line. **No technical age lock (D8)** — age-appropriateness is honour-system guidance; the content boundary is what keeps it safe. Largely *satisfied by #97* making youth view-only.
- **Accessibility (FR 5.3).** WCAG 2.1 AA; keyboard + ARIA across the Planner (esp. the grid).
- **Scroll-position preservation (X3, Foringi F).** Keep scroll on back-nav in long plans/lists — a papercut to fix while building A.

---

## 4. Sequencing (minimal-first; parallel tracks)

Burn-down order; **tracks 2–3 run in parallel with track 1** (5-dev team, D1):

**Track 1 — A spine (lead pair):**
1. **A core** — `WorkYear`/`Cycle` entities + `Event.type`/`scope` + `Task` additions (incl. the endurmat note field); **per-flokkur timeline** view (closest to today's editor). Fold in the Innkaup column.
2. **J** — wire the two new view tiers + the dagskrá/innri-mál split + a read-only share link. (Small; builds on existing RBAC.)
3. **A grid view** — the zoom-out overview over the same data.
4. **B** — type-aware launcher + clone-and-edit blocks + default slot sets.
5. **C** — assignee + lead-time email/in-app "your tasks" + derived procurement send.
6. **A calendar view** — scheduling layer, last.

**Track 2 — E bank (second pair, from day one):** bank search/favourites on the existing Program Bank + tags; later feeds B's blocks. Least dependency on A.

**Track 3 — D endurmat (testing & endurmat team):** starts once A's `Task`/`Event` has the endurmat note field; capture + passive resurfacing (D7) + council archive.

---

## 5. functional_requirements.md updates (proposed)

`docs/functional_requirements.md` predates the hierarchy. Proposed additions
(to apply in a follow-up edit):

- **FR-B (Program Bank):** note `Program` is subsumed by `Cycle` at cycle scale (ADR-001); add `WorkYear` as the top container.
- **FR-E (Events):** add `Event.type` (enum) and `Event.scope` (`troop-wide` / `per-flokkur`).
- **FR-T (Tasks):** add multi-week span, `status` (incl. `?` to-fill), `venue`, `endurmat note`, `owner/assignee`.
- **FR-G/RBAC:** add the two capability shades (receive-tasks viewer; partial dagskrá-only read) and the dagskrá/innri-mál content boundary.
- **content_type_enum:** extend with `starfsar`, `dagskrarhringur` (or reuse the polymorphic chain — settle in the model spec).

---

## 6. Cross-links

- ADRs: [ADR-001](../tharfagreining2/adr-001-dagskra-vs-program.md), [ADR-002](../tharfagreining2/adr-002-event-typing-and-grid.md), [ADR-003](../tharfagreining2/adr-003-resources-and-registries.md).
- [User stories](../tharfagreining2/user-stories.md) — A1–A8, B1–B14, C1–C5, E1–E6, J1–J8 (+ D, F bundled).
- [Prioritisation](../tharfagreining2/prioritisation.md) — build-first cap, non-goals, bundled-lightweight.
- [Tag management](./tag-management.md) — the tag layer E reuses.
- [Meeting notes](../tharfagreining2/meeting-notes.md) — ábendingar #1–#97.

---

## 7. Out of scope (phase 2)

Mirrors `prioritisation.md` (d). Captured so they are not silently re-smuggled in:

| Out of scope | Why | # |
|--------------|-----|---|
| Youth / minor accounts; technical age lock | RESOLVED (#97, D8) — leaders' tool; youth view-only via share link; age-appropriateness is honour-system guidance, not enforced | #97/#20/#69/#79/#71 |
| Real-time co-editing | Need is shared *awareness*, not multi-cursor (#16) | #16/#30/#38 |
| Resources / clash detection / equipment registry | Large surface; later `Resource` entity | ADR-003; #11/#12 |
| Félag registries (members/gear/badges/skills) | Big surface, after core Planner | ADR-003; #72/#78/#86 |
| Community / cross-org discovery | Highest enthusiasm but biggest surface; phase 2.5/3 | #76/#83/#84/#87 |
| Integrations (Drive / BÍS / Abler.io) | Valuable but big; later | #2/#82/#83/#91 |
| Gamification for leaders | Nice-to-have; maintenance burden | #74/#75/#95 |
| Mót planning | Multi-track heavy logistics; útilega only | plan glossary; #48 |
| Auto starfsáætlun doc / print-export | Thin later output, not v1 | #1/#96 (cluster I) |
| ÆSKA coverage view | Tags captured now; coverage view later | #27/#92 (cluster F) |

---

## 8. Open questions (for Halldór + Signý)

1. **Ratify Tier 1.** Ratified as the sequencing spine (D1) + endurmat promoted (D2); still **run the quick formal Note-and-Vote with Signý** to confirm A · J · B · C · E · D before build (`prioritisation.md` next step).
2. **Mobile — RESOLVED (D3):** responsive web / **PWA optimised for mobile + desktop; no native app yet.** Revisit native only for offline-at-camp / push.
3. **`WorkYear` optionality.** Is the work-year level mandatory, or can a casual leader live entirely at the cycle/Event level? (ADR-001 flags the casual-leader risk — we have mostly heard from structured planners.)
4. **Migration of existing `Program` rows** into `Cycle` — strategy + downtime plan.
5. **Endurmat resurfacing trigger** — on clone only, or also a proactive "last time you ran this…" prompt? Keep capture near-zero-friction either way (#47).
6. **Naming — RESOLVED (D6):** English code identifiers (`WorkYear`, `Cycle`); Icelandic stays in the UI.
7. **Youth read links — RESOLVED (D8):** **no technical age lock**; read-only dagskrá-only link + honour-system guidance on who to share with. Content boundary stays enforced. A light K safeguarding review of the link mechanics (revocation, no indexing) is still advised.
