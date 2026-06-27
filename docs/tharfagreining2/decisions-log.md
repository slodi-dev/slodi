# Open decisions — for ratification (Halldór + Signý)

**Status:** drafted 2026-06-01 · partially ratified (see per-decision status) ·
resolves the open questions raised in `adr-001..003`, `planner.md` §8, `user-stories.md`.

Team context: ~15 volunteers — ≈5 developers (2 lead), 6 testing & endurmat, 3 content
moderation. **The "hard cap of 5" framing is superseded by a 6-month tiered roadmap**
(`roadmap.md`): the build-first 5 + endurmat = Tier 1.

**Ratified so far (1 June 2026):** D1 (Tier 1 spine, pending formal vote), D2 (endurmat
promoted), D3 (PWA / no app), D6 (English code names). Remaining are still proposals.

Legend: **🔒 team-vote** = genuinely a group/budget call · **✅ low-stakes** =
reversible. ✔︎ = decided this session.

---

## D1 — Ratify the build-first set (A · J · B · C · E) 🔒 ✔︎ RATIFIED (pending formal vote)
**Decision:** Accepted as Tier 1's sequencing spine; **still run the 10-minute formal
Note-and-Vote with Signý** to confirm.
**Recommendation:** Keep the five as the **sequencing spine**, but run a 10-minute
formal Note-and-Vote to confirm — the closing vote was a live relay, not a clean
silent dot-vote (`prioritisation.md` b).
**Why:** the three-lens justification (votes · pain · foundation) is strong and #38
makes A the dependency root. Nothing in the evidence argues for swapping a cluster in.
**Team twist:** with 5 devs you can run **two tracks in parallel** — A (the spine)
on the lead pair, E (activity bank, which mostly reuses today's Program Bank + tags)
on a second pair — instead of strictly serial. See D3.
**Affects:** `prioritisation.md`, `planner.md` §2.

## D2 — Promote cluster D (written endurmat) to a first-class track ✅ ✔︎ ACCEPTED (confirm with Signý)
**Decision:** Promoted into Tier 1, owned by the 6-person testing & endurmat team.
Applied to `prioritisation.md`, `planner.md` §D, `user-stories.md`, `roadmap.md`.
**To be run by Signý** before build kicks off.
**Recommendation:** Build the written-endurmat loop (D1/D2/D3) **properly from day
one**, owned by the **6-person testing & endurmat team** — not deferred or bolted on.
**Why:** D drew 0 dots but ~4/5 pain (#45 "we repeat the same mistakes because it
wasn't written down", #48). The only reason it was demoted was the old two-maintainer
capacity assumption — which is now wrong. You have a whole sub-team whose remit *is*
endurmat; this is the obvious place to apply it.
**Scope guard:** still keep *capture* near-zero-friction (#47) — optional for routine
fundir, structured for events. The team owns the resurfacing UX, not a heavy form.
**Affects:** `prioritisation.md` (move D out of "bundled"), `planner.md` (D gets its
own short section), `user-stories.md` D1–D6.

## D3 — Mobile: responsive web / PWA, not a native app 🔒 ✔︎ DECIDED
**Decision:** Optimise the web for **both mobile and desktop**; **no native app yet.**
Revisit native only for offline-at-camp / push. Applied to `planner.md` §3, `roadmap.md`.
**Recommendation:** **PWA / responsive web.** One Next.js codebase, installable,
works on phones for the in-the-moment use (quick game grab E1, #53). No app-store
client.
**Why:** a native app is a *separate* codebase + store releases + its own maintenance
— a poor trade even at 5 devs, for a v2 whose mobile need is "grab a game / check the
plan live," all doable on mobile web. Heavy planning (the grid) is desktop anyway.
**Revisit only if:** offline-at-camp or push notifications become hard requirements —
then reconsider native. (#88 was a terse "App?" post-it; confirm the intent isn't
specifically "store app".)
**Affects:** `planner.md` §3 (already leans PWA), `user-stories.md` X1, FR-5.x.

## D4 — `WorkYear` and `Cycle` are OPTIONAL, with sensible defaults ✅
**Recommendation:** The hierarchy is **scaffolding, not gates.** A casual leader can
create a standalone meeting (or a bare cycle) without ever touching the work-year
level. Implement as nullable parent FKs + an implicit "current cycle" when none is
chosen.
**Why:** we only heard from *structured* planners (Foringi A); ADR-001 explicitly
flags the over-modelling risk for casual leaders. Forcing the full stack would lose
the new/low-frequency leader.
**Affects:** ADR-001 (already a stated consequence), `planner.md` §1.1 (already
states it) — this just confirms it as a hard requirement.

## D5 — Don't destructively migrate `Program`; keep it as the bank/template item ✅ (amends ADR-001)
**Recommendation:** **Add the new levels alongside** the existing chain. Keep
`Program` as the **catalog / template** item it already is (its `Event → Task`
subtree = a reusable meeting/dagskrá template that feeds clusters B and E). The new
`Cycle` is a *fresh* entity that groups `Event`s; a `Program` can **seed**
one (clone-to-plan). **No bulk data migration of existing `Program` rows.**
**Why:** `Program` plays two roles today — (a) a reusable bank item, (b) a planned
thing. ADR-001's "Program is *subsumed* by Cycle" is too strong: the bank
items are templates, not cycles. Treating Program as the template source resolves the
tension, needs zero risky data migration, and directly powers B (templates) and E
(bank). This is the lowest-risk path for the dev team.
**This is a clarifying amendment to ADR-001** — please ratify the wording change from
"subsumed" to "Program = template/bank item; Cycle = the planning cycle,
optionally seeded from a Program."
**Affects:** ADR-001 (Decision + alt-A wording), `planner.md` §1.1 / §A data-model,
FR-B.

## D6 — Entity naming: ENGLISH code identifiers, Icelandic in the UI ✅ ✔︎ DECIDED
**Decision (overrides the original Icelandic-name recommendation):** Use **English
identifiers in the codebase**, with Icelandic kept entirely in the UI. The naming map:

| Icelandic concept (UI label) | Code identifier |
|---|---|
| starfsár (work year / heildarmynd) | **`WorkYear`** |
| dagskrárhringur (the term cycle) | **`Cycle`** |
| skátafundur / viðburður | `Event` (unchanged) — `+ type, scope` |
| dagskrárliður | `Task` (unchanged) — `+ context` |
| dagskrá / bank item | `Program` (unchanged) |

Enums: `EventType` (`skipulags`/`sveitar`/`flokks`/`uppskeru`/`útilega`/`dagsferð`/
`mót`), `EventScope` (`troop_wide`/`per_flokkur`). Enum *values* may keep the Icelandic
tokens since they name domain-specific meeting kinds with no English equivalent.

**Why English:** the existing codebase is English (`Program`/`Event`/`Task`/`Workspace`);
matching it keeps the model consistent and approachable for any contributor. Icelandic
domain richness lives in the UI strings and the enum values, not the table/class names.
**Alternatives:** `Cycle` could be `ProgramCycle`/`Term` and `WorkYear` could be
`ProgramYear` — a lead-dev call; the chosen pair is short and unambiguous in context.
**Applied to:** `planner.md`, `functional_requirements.md`, ADR-001, ADR-002,
`roadmap.md` (renamed). The historical capture (`meeting-notes.md`, `post-processing.md`)
keeps the Icelandic terms — that's the workshop record.

## D7 — Endurmat resurfacing: passive surface on clone + on open, never a nag ✅
**Recommendation:** When you clone/reuse a block or open a recurring event/template,
**auto-surface last time's endurmat** in a side panel ("Síðast: hvað gekk vel / hvað
mátti betur"). No modal, no blocking prompt. Capture stays optional (#47).
**Why:** #48 — reviewing the previous run's endurmat is the payoff of writing it,
*especially for a new mótstjórn taking over*. A passive panel delivers that without
friction. (Owned by the D2 endurmat team.)
**Affects:** `planner.md` (D section), ADR-002 (endurmat-travels note).

## D8 — Youth view = share link + honour-system guidance; NO technical age lock ✔︎ DECIDED
**Decision:** We will **not** implement any technical age lock/age-gating. The
"older-youth view" is an **unguessable read-only share link** to the *dagskrá-only*
view (no innri mál). Who it is shared with is **leader discretion guided by our stated
wishes** — we *ask* leaders to share with dróttskátar/rekar and not drekar/fálkar
(G4/#15) — but the system does **not** enforce or verify age.
**What stays technically enforced (the real safeguard):** the **content boundary** —
the link exposes only the dagskrá, never innri mál (planning notes, endurmat,
assignments, council, member/badge data, J8/#79). No youth accounts, no youth-to-youth
channels (#97/#71).
**Why honour-system on age:** verifying a minor's age is impossible without accounts
(#97); the content boundary — not an age lock — is what actually keeps minors' data
safe. Stating the wish keeps it simple and matches how leaders already operate.
**Still recommended:** a light **K safeguarding review** of the share-link mechanics
(link revocation, no search-indexing) — but the age question itself is settled: no lock.
**Affects:** `planner.md` §J + §3, `functional_requirements.md`, user-stories G1/G4/J3,
`prioritisation.md`.

## D9 — Badge model: one shared catalogue (read), progress tracking deferred ✅
**Recommendation:** **One canonical færnimerki catalogue** lives in the bank/E layer
(movement-wide, shared, read-only definitions + leiðbeiningar). Cluster B simply
**runs a badge as an adaptable template** (B8/B9, #60/#3). **Per-scout badge progress
(H4, #78) is a separate, later, félag-internal table** (ADR-003) — minors' data, out
of build-first. This resolves the "badges appear in two ADRs" ambiguity.
**Why:** separates the *definition* (shareable) from *who-earned-what* (private,
later). Avoids two competing badge models.
**Affects:** ADR-002 (block library owns the catalogue read-model), ADR-003 (progress
registry), `planner.md` §B.

## D10 — Bank curation owned by the 3-person content-moderation team ✅
**Recommendation:** Map cluster-E quality/dedup (#89, "who maintains quality?") to the
**content-moderation sub-team**. Build a lightweight **flag-duplicate / report +
moderation queue** when the community surface (M) opens — not before.
**Why:** #89 raised the §9 "who curates?" question with no answer; the team structure
answers it. Don't build curation tooling until there's community content to curate.
**Affects:** `user-stories.md` E5, `prioritisation.md` (note the owner), §9.

## D11 — Lower-stakes leftovers ✅
- **Import vs link (#2/#82, cluster N):** stays a non-goal for v2. *When* built, prefer
  one-time **import** over a live Drive link (a link is ongoing integration
  maintenance). Until then: manual recreate.
- **ADR location:** move `adr-001..003` to `docs/decisions/` at merge time, keep the
  numbering.
- **Source: TBD reconciliation:** **skip** unless you want per-author vote-weighting —
  the analysis rests on aggregate signal, not individual attribution. (The afternoon
  post-its #65–#96 were never attributed.)

## D12 — Promote cluster L (gamification) to Tier 1 ✅ ✔︎ ACCEPTED (Halldór, 2026-06-27)
**Decision:** Move **L — Gamification / engagement** from **Tier 3 → Tier 1**.
Applied to `roadmap.md` (Tier 1 item 7), `prioritisation.md` (removed from non-goals),
`user-stories.md` (L header + non-goals), and the Shortcut backlog (`prio:tier-1`).
**Why:** L drew only 3 dots and read as "nice-to-have" *at the workshop*, but the value
is in **adoption/retention** — usage badges/points/Slóðaverðlaun pull leaders back into
A–E daily. It is cheap to add and reinforces the core, so it earns a Tier-1 slot.
**Note:** the **`meeting-notes.md` vote tally is left unchanged** (it records the
workshop as it happened — 3 dots, "nice-to-have"); this is a *post-workshop* priority
decision, logged here.
**Affects:** `roadmap.md`, `prioritisation.md`, `user-stories.md`, Shortcut.

## D13 — Participant (þátttakendur) data: store-and-scope vs. units-only 🔒 ⚠️ OPEN
**Question:** Do we want **þátttakendur (participant / scout) personal information in
the system at all?** Two options:
- **(a) store-and-scope** — hold member/personal data, keep it strictly félag-internal
  (the original J8 framing).
- **(b) units-only / no personal data** — never hold participant personal data; assign
  content to *units* (`Patrol` / `Troop` / `Division`, §11) rather than named individuals.
**Why it matters:** per **#97** (youth are view-only, not users) and the **K
safeguarding / persónuvernd** guardrail, option (b) de-risks the entire safeguarding
surface and simplifies the parked Member/Scout registry (ADR-003).
**Status:** **Open — needs a human/team decision (Halldór + Signý).** Replaces the J8
story, which was removed from the build backlog (this is a decision, not build work).
**Affects:** J/G clusters, `terms-and-datamodel.md` (`Scout`/registry), ADR-003, K.

---

## What needs a real human/team decision (don't let me settle these)
- **D1** — ratify the cap (quick team vote).
- **D3** — native-vs-PWA is partly a budget/ambition call (recommend PWA).
- **D8** — youth share-link **must** get a safeguarding (K) review.

## Everything else (D2, D4–D7, D9–D11)
Reversible / low-stakes. Say the word and I'll apply them to the ADRs and `planner.md`
(D5 includes the ADR-001 "subsumed" wording amendment).
