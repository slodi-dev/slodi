# Phase-2 roadmap — 6-month burn-down (tiered)

**Timebox:** ~June–December 2026 (~6 months). **Team:** ~15 volunteers — ≈5 developers
(2 lead), 6 testing & endurmat, 3 content moderation, + misc.
**Approach:** *do everything we can and see how far we get.* These are **priority
tiers, not deadlines.** Build top-down: finish a tier before reaching into the next,
but run independent tracks in parallel where dependencies allow. Anything not reached
by month 6 simply rolls forward — nothing here is "cut," only **ordered**.

> Supersedes the "hard cap of 5" framing in `prioritisation.md`. The old build-first
> 5 (A · J · B · C · E) + endurmat (D) **become Tier 1.** The clusters that were
> "non-goals / deferred" become **Tier 2 / Tier 3** — later in the order, not
> forbidden. The three-lens reasoning (votes · pain · foundation) in `prioritisation.md`
> still justifies *why* each cluster sits where it does.

---

## The three tiers

| Tier | Meaning | Clusters |
|---|---|---|
| **1 — Most needed** | The core that delivers the value; the product is not useful without it. | **A · D · E · J · B · C** |
| **2 — Nice to have** | Real, valuable, build if Tier 1 lands with time to spare. | **F · I · H · M(discovery) · N(import) · X2** |
| **3 — Extra / for fun** | Delight, engagement, polish — no harm if it never ships in phase 2. | **L · M(social/boards)** |

**Constraints (apply across all tiers, not tiers themselves):** mobile-first
responsive web / **PWA** (D3), **K safeguarding** guardrail (#71/#97), accessibility
(WCAG 2.1 AA). See `decisions-log.md`.

---

## Tier 1 — Most needed (start now)

The order below is the burn-down order; parallel tracks noted.

1. **A — Shared master plan (the spine).** New `WorkYear` / `Cycle` entities,
   `Event.type`/`scope`, `Task` additions; the three views (timeline → grid →
   calendar). Everything hangs off it (#38, ~4/5 pain). *Lead pair, track 1.*
2. **E — Activity / games bank.** Mostly reuses today's Program Bank + tags
   (`docs/features/tag-management.md`), so it has the least dependency on A and can
   start immediately; later feeds B's blocks. *Second pair, track 2 — in parallel.*
3. **D — Written endurmat loop.** Note that resurfaces on reuse (#45/#48, ~4/5 pain).
   Promoted out of "bundled" because the **6-person endurmat team** owns it (D2). Can
   begin as soon as A's `Task`/`Event` has the endurmat field. *Endurmat team, parallel.*
4. **J — Roles, access & sharing.** View/edit/receive-tasks tiers + council tier (#93)
   + read-only dagskrá share link (youth/parents, #97/#20). Builds on existing RBAC.
   *After A's data model exists.*
5. **B — Templates / sniðmát.** Copy-and-edit blocks parametrised by theme; type-aware
   launcher (#65); badges-as-templates (#60). *Consumes A; after/with J.*
6. **C — Assign & notify ahead.** Per-meeting task/role assignment + lead-time push;
   derived procurement send (#33 ~4/5, #39). *Rides on A + J — cheap once they exist.*

**Quick wins (anytime, cheap):** scroll-position preservation on back-nav (X3); the
Innkaup/procurement *generation* and ÆSKA *tags* captured during A (so the Tier-2
views have data to render).

## Tier 2 — Nice to have (reach for these if Tier 1 lands)

- **F — ÆSKA / þroskasvið coverage view** — a view over A's tags (#27/#92); cheap once
  the tags exist.
- **I — Outputs / print / export** — full print of fundir, starfsáætlun, templates
  (#96); the *derived worklist* part already rode on A/C.
- **H — Félag registries (partial)** — start with **resource clash detection** (the
  grid's ATH column → real flag, #11/#25, ~4/5 pain) and a **member roster**; gear
  booking, badge-progress, leader-skills come later (ADR-003).
- **M — Community discovery (core)** — browse what other félög/sveitir do; pull
  official BÍS events (#76/#83). Needs A/B/J to exist to share *from*.
- **N — Import** — bring in an existing plan from Drive/Sheets one-time (#2/#82);
  prefer import over a live link (D11).
- **X2 — Version history** of a plan (#77).

## Tier 3 — Extra / for fun (only if there's room)

- **L — Gamification** for leaders — usage badges, points, Slóðaverðlaun (#74/#75/#95).
- **M — Social flourishes** — follow specific leaders (#76), Pinterest-style idea
  boards (#87/M5). The playful half of community, distinct from plain discovery.

---

## What's parked beyond phase 2 (still not "now")

These remain genuinely large or dependent and are unlikely within six months even at
full capacity — kept visible so they're not forgotten:

- **Full equipment registry + inter-félag lending** (H6/#12) — biggest registry surface.
- **Per-scout badge progress at scale** (H4/#78) — minors' data; needs the K review.
- **Mót planning** — multi-track heavy logistics; útilega is in (as an Event type), mót is not.
- **Native mobile app** — PWA covers the need (D3); revisit only for offline/push.
- **Real-time multi-cursor co-editing** — shared-read likely suffices (#16); only if a probe proves otherwise.
- **Abler.io / BÍS deep integration** (#91) — valuable but a big external dependency.

---

## How to use this with the team

- **Tier 1 is the commitment**; Tiers 2–3 are "if we get there."
- Re-check the ordering at each month boundary — pain/feedback from the testing &
  endurmat team should be allowed to re-rank.
- The **content-moderation team** has a natural home in **E** (bank quality/dedup,
  #89) and later **M** (community curation).
- Run the quick formal Note-and-Vote (D1) once to confirm Tier 1 before committing.

*Related: `prioritisation.md` (per-cluster reasoning), `decisions-log.md` (D1–D11),
`planner.md` (Tier-1 spec), `user-stories.md` (the stories behind each cluster).*
