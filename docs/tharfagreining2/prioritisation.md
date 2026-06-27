---
artifact: prioritisation
version: "1.0"
created: 2026-06-01
status: draft
deciders: [Halldór Valberg, Signý]
implements: post-processing.md steps 4 & 6
source: meeting-notes.md (#1–#97, closing vote tally)
---

# Phase-2 prioritisation — build-first set + non-goals

Decision-support for Halldór + Signý. Turns the closing-vote tally and the
synthesis in `meeting-notes.md` into a **capped build-first set** and an
**explicit non-goals list**. Traceability to ábendingar (`#N`) is preserved
throughout.

> **Reading note — the vote was a live relay, not a clean silent dot-vote.**
> The closing was facilitated as a running post-it walkthrough (#65–#96) with
> votes called out in the room, not a silent self-vote then anonymous dotting.
> Treat dot counts as **direction, not precision.** This is why the reconciliation
> below leans on *pain* and *foundational dependency* as much as on dots, and why
> a formal Note-and-Vote (cap 5) with Signý is still listed as a next step.

---

## (a) Cluster list A–N — tidied & de-duped

One line each, with member ábendingar. Merges/notes called out where the live
clustering double-counted or split a theme.

| ID | Cluster | One-line definition | Members |
|----|---------|---------------------|---------|
| **A** | One source of truth / Sheets-like grid | A single authoritative plan (meetings × flokkar grid + calendar + per-flokkur timeline) of ONE dataset, replacing the Drive/Excel/Sheets/whiteboard scatter. | #18, #19, #21, #23, #25, #38, #66, #70, #80, #82, #94 |
| **B** | Templates / sniðmát (blocks) | Copy-and-edit program blocks ("dagskrárkubbar"), typed beinagrindur, parametrised by theme; type-aware "create fundur / create útilega" launcher; badge catalog as runnable templates. | #6, #22, #51–#64, #65, #66, #77, #84, #90, #92 |
| **C** | Assign & notify ahead | Assign tasks/roles per meeting and push the plan to co-leaders + staff with lead time — kill the 5-min-before scramble. | #15e, #30, #33, #39, #40, #43, #68 |
| **D** | Endurmat loop (written, resurfacing) | Written endurmat that is kept and re-shown at the next relevant planning moment, so the same mistakes stop recurring. | #45, #46, #48, #49 |
| **E** | Activity / games bank + search | Mobile, in-the-moment quick-grab activity/games bank with rich tags, filters, favourites, and dedup/curation. | #10, #29, #53, #54, #73, #81, #85, #87, #89 |
| **F** | ÆSKA coverage / balance | The þroskasvið envelope made visible — a coverage/balance view over a plan. | #27, #60, #92 |
| **G** | Youth access (view + suggest) | Youth/parent visibility into the dagskrá with a "suggest change" right — **NOT** full accounts. **Resolved by #97** (see below); folded into **J** as access tiers. | #8, #20, #69 → resolved #97 |
| **H** | Félag-level registries | Félag data foundation: member roster, equipment, badge progress, venues, leader skills/experience. | #11, #12, #62, #72, #78, #86 |
| **I** | Outputs / generation | Derived worklists + print/export: procurement lists, starfsáætlun, printable fundir/sniðmát. | #1, #10, #15d, #19, #96 |
| **J** | Roles, access tiers, profiles & sharing | Tiered access — edit (samforingjar) · view+receive-tasks (aðstoðarforingjar) · partial view (others) · council (starfsráð) · youth view-only — plus individual profiles and plan sharing. | #67, #68, #69, #70, #79, #80, #93 |
| **K** | Safeguarding & data security ⚠️ | Guardrail, not a feature: minors' persónuvernd + prevent neteinelti; gates anything that gives youth interaction. | #71 (gates G/J) |
| **L** | Gamification / engagement | Adoption incentives for *leaders* — usage badges, points/levels, Slóðaverðlaun. Distinct from scout færnimerki (B/F). | #74, #75, #95 |
| **M** | Community / cross-org discovery | The movement-wide super-workspace: browse/follow other félög & leaders, publish + save ideas, official BÍS/shared event catalog. | #76, #83, #84, #86, #87 |
| **N** | Integrations / external systems | Don't re-key what lives elsewhere: Drive import, BÍS official events, Abler.io member data. | #2, #82(import), #83, #91 |

**De-dupe / merge notes**

- **G is dissolved into J + K.** #97 resolved youth as view-only (age-appropriateness
  by guidance, no technical lock — D8), so
  "youth access" is no longer a standalone build candidate — it is one **tier**
  inside J, constrained by the K guardrail. Parents (#20, "skoða lítið") are the
  lowest-value tier of the same axis.
- **D ⊂ A/B.** D's mechanism (a written endurmat field that travels on reuse) has
  no UI of its own — it lives **on the block/event** that A and B already own. Kept
  as a distinct cluster for traceability, but it is a *bundled-lightweight* item,
  not a fifth slot (see (e)).
- **H absorbs the equipment/resource strand** (#11/#12/#62) and the people/skills
  strand (#72/#78/#86) into one "félag registries" surface — they share the same
  "félag → {members, gear, badges, skills, venues}" foundation.
- **#86 is double-counted** under H (skill registry) and M (peer help). Primary
  home = **H**; the "teach/help others" framing is an M flavour.
- **#92 is triple-counted** (B add-to-plan / E browse-catalog / F ÆSKA link).
  Primary home = **B** (it is a template you add to a plan).
- **#88 (mobile app)** and **K** are **cross-cutting platform/guardrail items**, not
  feature clusters — they constrain the build-first set rather than competing for a slot.

---

## (b) Vote reconciliation — DOTS ≠ VALUE

Dot tally (relay-style, from "Final cluster tally"):

```
J 7  ·  B 6  ·  A 5  ·  M 5  ·  E 4–5  ·  H 3  ·  L 3  ·  C 1  ·  N 1  ·  I 1  ·  K 1  ·  D 0
```

Thematic energy: Social/access/community (J+M+K+N ≈ 14) > Planning core (A+B = 11)
> Banks/registries (E+H ≈ 8) > Engagement (L = 3).

Where dots **misrepresent** value:

- **C — 1 dot, but ~4/5 PAIN.** Cluster C drew a single dot (#68) yet carries the
  **clearest, most-corroborated pain of the day**: #33 ("ógeðslega lélegur"… 5-min
  scramble, ~4/5), #39 (procurement sent too late — self-corrected to "tímanlega"),
  #43 (the JIT 15-min huddle recurs). Three independent voices describe the same
  unmet need (#15e/#30/#33). Low dots reflect that it is a *felt* pain people are
  resigned to, not a shiny want — the relay format under-counts exactly this kind of
  item. **Pain ≫ dots → keep it in the build-first set.**

- **D — 0 dots, but cheap + strong in discussion.** Endurmat scored **zero dots**
  yet was emphatic in conversation: #45 ("we repeat the same mistakes because it
  wasn't written down", ~4/5 pain) and #48 (review the previous event's endurmat —
  high payoff for rotating mótstjórn, ~4/5). This is a **felt-vs-designed gap**: real
  pain that no one voted for because the *solution* is invisible (it is a field on a
  block, not a feature with a name). **Cheap to build, high continuity value → bundle
  it (see (e)), don't drop it.**

- **J + M dominated — but the plan had DROPPED the RBAC exercise.** The two runaway
  clusters (J = 7, M = 5) were **not** anticipated as build candidates: §5.2 had
  *dropped* the RBAC/access exercise as low-priority, and community/discovery was
  treated as a later super-workspace concern. The room overrode that assumption —
  access/sharing/roles is the *collaboration unlock* (#94: plan-in-tool → easy
  contribution; #93: council works in-tool), and community/inspiration carried the
  **highest enthusiasm** ("ótrúlega spenntur", #76). **Implication:** J is promoted
  into the build-first set on its own merits; M is acknowledged as high-energy but
  **deferred** (biggest surface, needs A/B/J to exist to share *from* — see non-goals).

- **General relay caveat.** Because votes were called aloud during a running
  walkthrough (not silent + anonymous), high-visibility/early items likely accreted
  dots and quiet pains (C, D) were under-weighted. **Use the counts as direction;
  re-run a formal silent Note-and-Vote (cap 5) with Signý before committing.**

---

## (c) BUILD-FIRST SET — hard cap of 5

The cap is 5 by design (Note-and-Vote, §6) — this is a **volunteer project** built by
a ~15-person team (≈5 developers, 2 lead; 6 testing & endurmat; 3 content moderation),
so scope discipline is still the whole point even with more hands than the original
two-maintainer assumption. Each item is justified by the **three lenses**
(votes · pain · foundational dependency), not dots alone.

| # | Cluster | Why it makes the cap | Votes | Pain | Foundation |
|---|---------|----------------------|-------|------|------------|
| 1 | **A — Shared master plan / one source of truth** | Everything hangs off it: #38 names it the *precondition* for all else; the grid (#19/#25) + calendar (#23) is the most-corroborated need across voices (#11/#15/#16/#18/#82). Beats the painful Excel/Sheets incumbent. | 5 | High (Excel ~4/5) | **Yes — #38 dependency root** |
| 2 | **J — Roles, access & sharing** | Runaway top vote (7). Unlocks collaboration: once the plan lives in-tool, contribution is frictionless (#94); adds council tier (#93), youth view-only (#97), parent view (#20). Builds on Slóði's existing `owner/admin/editor/viewer` RBAC — incremental, not greenfield. | 7 | Medium–high | Builds on existing RBAC |
| 3 | **B — Templates / sniðmát (blocks)** | Strongest value-prop (#57–#59); serves new + veteran leaders (#63/#64). Copy-and-edit blocks parametrised by theme (#62), type-aware launcher (#65), badge catalog (#92). | 6 | Medium | Consumes A's data model |
| 4 | **C — Assign & notify ahead** | **Pain pick, not vote pick.** Top, recurring collaboration pain (#33 ~4/5; #39; #43); directly counters the 5-min scramble. Pairs naturally with A (the plan) + J (who can see/receive). Cheap once A+J exist. | 1 | **~4/5 (highest)** | Rides on A + J |
| 5 | **E — Activity / games bank + search** | Daily, in-the-moment use (mobile #53); feeds B (blocks are assembled from bank items); rich tags/search (#73), favourites (#81), dedup (#89). | 4–5 | Medium | Feeds B |

**Reasoning summary.** Slots 1–3 are the **Decider synthesis core** (A · J · B) and
also the top three by combined signal. Slot 4 (C) is a deliberate **pain-over-dots**
correction — it is the cheapest high-pain win once A+J are in place. Slot 5 (E) is
the **daily-use anchor** that makes B useful (you assemble blocks from the bank). F
(ÆSKA), M (community), and H (registries) all narrowly miss the cap and are the first
candidates if a slot frees up.

**What was on the synthesis list and what changed:** the recommended-set in
`meeting-notes.md` (A · J · B · C · E) is carried through **unchanged** — this
document supplies the reasoning (the three lenses) and the explicit cut-line.

> **Ratified (D1, `decisions-log.md`).** The five are accepted as the **sequencing
> spine**, pending a quick formal silent Note-and-Vote to confirm (the closing vote
> was a live relay, not a clean dot-vote — see *Next step*). Nothing in the evidence
> argues for swapping a cluster in.
>
> **Parallel tracks (5-dev team).** The cap is a *priority* order, not a strictly
> serial build. With ≈5 developers you can run two tracks at once:
> - **Track 1 (lead pair): A — the spine.** New entities + the three views + the
>   shared data model everything else depends on (#38).
> - **Track 2 (second pair): E — activity/games bank.** Mostly **reuses today's
>   Program Bank + tags** (`docs/features/tag-management.md`), so it has the least
>   dependency on A and can progress immediately; it later feeds B's blocks.
>
> J/B/C still **sequence after A** (they consume A's data model), and the **endurmat
> team** can begin the cluster-D loop in parallel (see D2 — not yet ratified).

---

## (d) NON-GOALS for phase 2

Explicit permission to cut. These are real needs that were heard and **deliberately
deferred** — capturing them here so they are not silently re-smuggled into scope.

| Non-goal | Why out of phase 2 | Evidence |
|----------|--------------------|----------|
| **Youth accounts / youth as users; technical age lock** | **Resolved (#97, D8):** Slóði is a leaders' tool. Youth get **view-only** access to the dagskrá (not innri mál) via a share link; **age-appropriateness is honour-system guidance, not a technical lock**. No minor-account/edit system in v1 — this de-risks the whole K safeguarding surface. Implemented as a **tier inside J**, not a build item. | #97 (RESOLVED), #20, #69, #79, #71 |
| **Real-time Google-Docs co-editing** | Not evidenced as the need. The stated need is **shared awareness** — "allir með á nótunum" (#16) — which **shared-read of one source (A) may fully satisfy.** Don't build live multi-cursor co-editing unless a later probe shows shared-read is insufficient. | #16 (shared-read may suffice), #30, #38 |
| **Full equipment registry + inter-félag lending** | Large surface (H); #12 was explicitly solution-space ("ef við förum í þá átt…"), and cross-félag borrowing balloons scope. The underlying clash/inventory pain (#11 ~4/5) is real but better served *later* by a `Resource` entity than by an equipment marketplace now. | #11, #12, #62, #72 |
| **Mót planning** | Multi-troop, parallel-track, heavy-logistics — a "different beast" (plan §glossary). Útilega is in scope as an Event type; **mót is not** a phase-2 planner target. | plan glossary, #15 (útilega planned inside the year), #48 (mót context only) |
| **Rich parent portal** | Parents "**skoða lítið**" (#20) — lowest-value audience. A read-only view tier (part of J) is enough; do not over-invest in a parent-facing experience. | #20 |
| **Community / cross-org discovery (cluster M) — *as a build-first item*** | Highest enthusiasm (#76) but the **biggest surface** (super-workspace, follow/copy, official catalog #83, curation/dedup #89). Needs A/B/J to exist first to have something to share *from*. Target **phase 2.5/3**, not now. | #76, #83, #84, #87, #89, FR-B6/B7 |

**Cross-cutting (not deferred, but not slots):** mobile-first responsive web/PWA
(#88 — confirm native-vs-PWA intent) and the K safeguarding guardrail are
**constraints on the build-first set**, applied as we build A–C/E, not separate
features. Integrations (N: Drive/BÍS/Abler #91) and outputs/print (I: #96, flagged
*mikilvægt* — small) are **later**.

---

## (e) Bundled-lightweight call-outs

Items too cheap/valuable to drop but too small to spend a cap slot on — folded into
the build-first features rather than deferred:

- **D — written endurmat loop → PROMOTED to Tier 1 (D2, `decisions-log.md`).** *No
  longer bundled.* The 0-dots-but-~4/5-pain endurmat loop (#45 "we repeat the same
  mistakes because it wasn't written down", #48) is now a **first-class track owned by
  the 6-person testing & endurmat team** — it was only demoted under the old
  two-maintainer capacity assumption. Still built **lightweight**: a notes/endurmat
  field (on A's data model) that **travels on reuse** (B's copy-and-edit) and
  **resurfaces passively** at the next planning moment (D7); capture stays optional for
  routine fundir (#47), structured for events (#46). *To be confirmed with Signý.* See
  `planner.md` §D and `roadmap.md` Tier 1.
- **Procurement / derived worklists (#19/#39, cluster I) → fold the *generation* into
  A.** The grid already carries an "Innkaup" column (#19); generating the buyer's
  list from it (and sending with lead time) is a thin output on top of A + C, not a
  separate I build. Full print/export (#96) stays a later, separate small item.
- **ÆSKA coverage (F) → latent on A.** Coverage is a *view* over A's tagged data
  (#27/#92); the tags can be captured now and the coverage view added cheaply later
  — no slot needed in phase 2.

---

## Next step

Run the **formal silent Note-and-Vote (cap 5) with Signý** to ratify A · J · B · C ·
E against this reasoning (the relay vote is direction, not a mandate), then proceed to
post-processing step 7: write `docs/features/planner.md` and sketch flows for the
grid (A), template launcher (#65, B), and access tiers (#97, J).
