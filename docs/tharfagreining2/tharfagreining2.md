# Needs Analysis (þarfagreining) — Slóði Phase 2

**Date:** 1 June 2026
**Facilitators:** Two (Halldór + co-facilitator) — split the room, swap energy
**Scribe:** Signý (roving — captures + photographs, does **not** facilitate)
**Group size:** 6–10 participants → run exercises in **2 breakout groups of 3–5**
**Phase 2 scope:** Planner (dagskrárgerð) · Workspaces & collaboration · Templates & reuse

> This is our prep as facilitators. The goal is **not** to present a finished
> solution — it's to draw out leaders' real needs before we design phase 2.
> Listen more than we talk.

### Glossary (keep these terms consistent all day)

| Term | Meaning |
|---|---|
| **skátafundur** | A single scout meeting (~1–2 hrs, usually weekly). The container/event. |
| **dagskrá** | The program: the sequence of activities/elements run *within* a meeting. A single element = *dagskrárliður*. |
| **dagskrárhringur** | A full program cycle — a term/season's worth of meetings that hang together. |
| **útilega** (pl. *útilegur*) | A weekend camp — one troop, multi-day. |
| **mót** | A larger multi-troop rally/jamboree. *Different beast from an útilega* — many participants, parallel tracks, heavy logistics. Probe separately if it comes up. |

---

## 1. Goals of the workshop

1. Understand **how leaders build their dagskrá today** (without Slóði) — tools, process, pain points.
2. Validate whether a drag-and-drop Planner solves a real problem — or whether we'd be solving one that doesn't exist.
3. Understand **collaboration**: who plans together, how they share, who "owns" the dagskrá.
4. Find out **which templates** would actually save time (weekly skátafundur, útilega, mót, skill badges…).
5. Prioritise: which of the three (Planner / workspaces / templates) matters **first**.

**What we want to walk out with:**
- A list of real user stories ("As a leader I want… so that…").
- Prioritisation from the leaders themselves (not just our gut feeling).
- A raw list of the templates people want (prioritising the *designs* comes later).
- Clarity on what is *not* needed — so we don't over-build.

> **Kill / pivot criterion (decide this before we walk in).** The Planner is the
> heaviest build in phase 2 and we designed it — so we must pre-commit to what
> "it's not needed" looks like, or we'll only hear validation. **Signal to
> reconsider:** if most leaders describe their current planning as low-pain
> (≤2/5) and low-frequency, or if their mental model doesn't resemble assembling
> ordered activities at all — we pause and rethink the Planner before building.

---

## 2. Agenda (draft, 10:00–15:00 with lunch)

> We probably won't start exactly at 10:00 — leave a **buffer** so people can
> arrive, grab coffee, and settle. Better to start calmly than rushed.

This table doubles as the **run of show** — who leads each block. Signý scribes throughout.

| Time | Block | Lead | Format |
|---|---|---|---|
| 10:00–10:20 | **Buffer** — arrivals, coffee, chat | — | — |
| 10:20–10:30 | Welcome + ground rules + how the input will be used + short Slóði status | Halldór | Presentation |
| 10:30–10:40 | Warm-up — round-robin (name, troop, one word on planning) | Co-facilitator | Round-robin |
| 10:40–12:00 | **Exercise 1: "How do you picture it?"** — skátafundur (25) → dagskrárhringur (35) → útilega (20) | Both float groups | Breakout sketch + share |
| 12:00–12:45 | **Lunch** | — | 🍽️ |
| 12:45–13:35 | Exercise 2: Mapping collaboration | Halldór leads, co-fac floats | Stories + relationship sketch |
| 13:35–13:50 | Short coffee break | — | ☕ |
| 13:50–14:30 | Exercise 3: Template discovery | Co-facilitator leads | Collection (no dot-vote yet) |
| 14:30–14:55 | Closing: **Note-and-Vote** on needs (build-first cap) | Halldór = Decider | Silent note → vote → decide |
| 14:55–15:00 | Next steps + how we follow up + thanks | Both | Close |

> Participant-facing (approximate) version of this agenda is in `prework-email.md` —
> what the leaders were told. This table is our detailed internal plan.

> **Pacing on a long session.** 5 hours is long — energy dips after lunch. The
> heaviest work (Planner, Ex.1) is **before lunch** while people are fresh, and
> the highest-leverage scale (dagskrárhringur) gets the **most time and the
> middle slot** — not the hungry pre-lunch tail. After lunch: more interactive,
> less talking. Keep breaks sacred.

> Keep the "what's already built" intro **short** — otherwise we burn the day
> demoing instead of listening.

---

## 3. Before the day (prep checklist)

- [ ] **Confirm the attendee list** — the personas below assume a mix; adjust if it skews.
- [ ] **Send participants pre-work** (one short email): "Bring the last skátafundur and the last útilega you planned in mind — we'll sketch them." Lets reflective people arrive ready. *(Draft ready in `prework-email.md` — Icelandic, Messenger-formatted.)*
- [ ] **Signý briefed as scribe** — knows the capture format (§8) and that she's roving, not facilitating.
- [ ] **Two facilitators agree the split** — who leads which block, who floats which breakout group.
- [ ] **Materials:** paper/A3 sheets per group, markers, sticky notes, dots (for later), wall space, camera.
- [ ] **Write wall labels & prompts in Icelandic ahead of time** — don't translate live. (This doc is English for our own reference only.)
- [ ] **Ground rules written on a flip sheet** (see §7).

### Participants (fill in before the meeting)

- [ ] Who's coming? (troop leaders, assistant leaders, group leaders, youth?)
- [ ] Age range of scouts they work with (drekar / fálkar / dróttskátar / rekkar?)
- [ ] Who is inexperienced vs. experienced at planning?
- [ ] Who already uses Slóði vs. not?
- [ ] Anyone who **co-plans** with others today (paired leadership)?

**Personas to keep in mind:**
- *The new leader* — doesn't know what to do, wants templates and ideas.
- *The veteran* — has lots of their own material, wants structure and reuse.
- *The group leader* — oversees several troops, thinks about consistency and overview.

---

## 4. Current state (baseline — what already exists)

So we can answer "why not just…" questions:

- **Program bank** exists: programs with description, image, tags.
- **Workspaces** and groups with roles: `owner / admin / editor / viewer`.
- **Tags and search/filtering** in progress (the catalog work).
- Login via Auth0, RBAC on workspaces.
- **What's missing (= phase 2):** *assembling* a full dagskrá from items, a
  timeline/ordering, templates, and collaborating on a single dagskrá.

Current data model: `Program → Event → Task` (tasks ordered by `order_index`, with timing).

---

## 5. Questions by topic

### 5.1 Planner — "How do you picture it?"

The core question of the whole workshop. Same question shape, **three scales** —
we compare where the mental model changes. That tells us where the "seams" in
the system should be.

**Scale 1 — skátafundur** (a single meeting, ~1–2 hrs) — *the warm-up, everyone can do it*
- When you plan one meeting, how do you picture it in your head? Draw it.
- Do you start from time, theme, or activities?
- Is there a fixed structure? (opening / core / closing, rituals, a game at the end…)
- Where does the time "live" — on each activity, or as a total?
- *Model test:* does `Event → ordered Tasks` fit? Where do "breaks", "moving between locations", opening/closing ceremony fit?

> **The five dimensions of a dagskrárliður** — but don't drown the sketch.
> Have them **sketch the structure first**, then probe **one or two elements**
> for these five. We're testing whether leaders think this way, not annotating
> everything:
>
> | Dimension | Question | Maps to |
> |---|---|---|
> | **What** | What activity is run? | `Task.name` |
> | **How** | How is it carried out? (instructions, method) | `Task.description` |
> | **Why** | What is the purpose of this element? | *(missing? — rationale field)* |
> | **With what gear** | What equipment/materials are needed? | `Task` equipment |
> | **Toward what greater purpose** | What development goal does it serve? (ÆSKA / þroskasvið) | tags / objectives |
>
> Listen for: do leaders reach for "why" and "greater purpose" naturally, or is
> it a burden? That decides whether these become **required fields, optional
> fields, or auto-suggestions.**

**Scale 2 — dagskrárhringur** (a full term/season, themed) — *the centerpiece, most time*
- How do you picture a whole dagskrárhringur? How does a sequence of meetings hang together?
- What drives the order — theme, progression, skill badges, variety?
- Do you think about balance (ÆSKA / þroskasvið) when sequencing?
- Do you see it as a calendar, a theme-wheel, a checklist — or something else?
- *Model test:* is there an entity **above** `Program`? Is "Program" actually the dagskrárhringur, and the meeting = `Event`? **This is where it's decided whether the current model holds.** Record the terminology precisely.

**Scale 3 — útilega** (multi-day, possibly parallel tracks) — *lighter; we mainly need to know if the line breaks*
- How do you plan an útilega? What's different from a normal meeting?
- Do multiple things happen at once? (parallel tracks, different age groups simultaneously)
- Food, sleep, gear, transport — is that part of the "dagskrá"?
- Do you see it as a line (like a meeting) or a grid (days × tracks)?
- *Model test:* does the linear `Event → Task` model break here? Is útilega planning a **separate tool**, or the same tool with a "parallel" mode? (If *mót* comes up, flag it as an even bigger, separate case — don't try to design for it today.)

> **Why this matters most:** this single exercise can answer the three biggest
> open questions (§9) — whether "dagskrá" = `Program`, single meeting vs. whole
> term, and minimum scope — AND whether camps need their own tool. Highest
> leverage of the day.

### 5.2 Workspaces & collaboration — mapping real collaboration

> Dropped: the old "who can do what" roles exercise. The role model
> (`owner/admin/editor/viewer`) is not the uncertainty in phase 2 — **whether and
> how** leaders collaborate is. Ask about reality, not RBAC.

- Who plans the dagskrá with you? Tell me about the last time you worked together on a meeting or an útilega.
- Do you work alone, in pairs, or in a team?
- How do you split the work? (one drafts, the other reviews? split by week? by activity?)
- Where does that conversation happen today? (Messenger, in person, a shared doc, nowhere)
- Does anyone "review/approve"? Does the group leader want oversight across several troops?
- Do you share a **finished** dagskrá with others — or do you want to work on it **together** while it's in progress?
- Super-workspace: do you want to pull others' programs and copy them to yours? Publish yours? (FR-B6/B7)

**Lighter format:** discussion + maybe "draw who you plan with" (a small relationship sketch). No formal role-sorting.

> **Why:** tells us WHETHER collaboration features matter and WHICH ones —
> real-time co-editing? comments? sharing a copy? oversight? Avoids building
> Google-Docs-style co-editing if everyone actually plans solo and just wants to
> *share a finished thing*.

### 5.3 Templates & reuse — discovery, not prioritisation (yet)

> **Dot-vote is deferred.** We don't prioritise template *designs* until we have
> design drafts to work with. Today we collect the raw material.

- Which events do you repeat over and over? (weekly skátafundur, annual party, útilega, skill badges…)
- If you could start from something ready-made, what would save you the most time?
- Do you want **your own** templates (copy an old meeting) or **shared** ones from the movement?
- Reuse: do you want a **copy** (frozen) or a **link** (updates with the source)?
- What must never be fixed in a template? (always needs changing)

**Output today:** a raw list of templates + preferences on reuse "semantics" (copy vs. link). Prioritisation (dot-vote) waits for a later round with design drafts.

---

## 6. Exercises (interactive — so this isn't just a lecture)

**Group setup:** with 6–10 people, split into **2 breakout groups of 3–5**. One
facilitator floats each group; Signý rotates between them capturing + shooting
photos. Share back to the full room after each round.

**Exercise 1 — "How do you picture it?" (before lunch, the core, 80 min).**
Three rounds, same structure, increasing scale: **skátafundur (25) →
dagskrárhringur (35) → útilega (20)** (questions in §5.1). Each round: groups
**sketch first**, then share. Each scale on its own sheet so we can compare.
→ **The comparison is the data** — where the mental model changes between scales
shows where the seams in the product should be. For the skátafundur, after the
sketch, probe one or two elements for the five dimensions (what / how / why /
gear / greater purpose) — don't annotate every element.

**Exercise 2 — Mapping collaboration (after lunch, 50 min).**
Stories of real collaboration + a small "who do you plan with" relationship
sketch (questions in §5.2).
→ Identify WHETHER and WHICH collaboration features are a real need — not RBAC mechanics.

**Exercise 3 — Template discovery (40 min, no dot-vote yet).**
Collect a raw list of repeated events + reuse preferences (copy vs. link), §5.3.
→ Raw material for the next round. Prioritisation waits until we have design drafts.

**Closing exercise — Note-and-Vote (25 min).**
Use the Note-and-Vote mechanic (Google Ventures) instead of open sorting — silent
individual work first beats groupthink and the loudest-voice problem. Run it on
the day's *needs* (across all three topics):
1. **Note (7 min, silent):** each person writes their top needs on their own — no discussion.
2. **Self-vote (2 min):** each circles their own 2–3 strongest.
3. **Share + cluster (8 min):** post on the wall, group duplicates, brief clarifying only.
4. **Vote (3 min):** everyone gets a fixed number of dots (e.g. 3) on the clustered needs.
5. **Decider picks (5 min):** the Decider (Halldór) reviews the vote and names the **"build-first" set** — informed by the vote, not bound by it.

> **Agree the cap first:** write a hard limit (e.g. *max 5*) on the "build-first"
> set on the wall *before* voting — otherwise everything reads as "valuable."
> This ranks *needs*, not specific design solutions, and gives us permission to
> cut phase 2 scope. (Skill: `tool-note-and-vote`.)

---

## 7. Facilitation — what we specifically need to watch

We designed this system, which makes us the worst-positioned people to stay
neutral — and neutrality is the job today. Four disciplines:

1. **Treat our own design as a hypothesis to falsify, not defend.** When someone's
   workflow doesn't fit the model, that's a *finding*, not a problem to argue
   away. Visibly write it down.
2. **Don't lead the witness.** "Wouldn't drag-and-drop be great?" → everyone nods
   → we learn nothing. Ask open: "How would you want to put a meeting together?"
3. **Stay in problem-space before lunch, solution-space after.** Understand the
   *pain* first; solutions are cheap once the pain is clear.
4. **Dig past the feature request to the need (the "why" ladder).** "I want a
   calendar view" → *why?* → "to see the whole term" → the real need is
   term-level overview, solvable many ways. Capture the need, not the widget.

**Two facilitators:** one runs the front / timekeeps, the other floats and
listens deep in groups. Swap on the energy dip after lunch. Neither scribes —
that's Signý.

**Ground rules to state at the start (and post on the wall, in Icelandic):**
- One conversation at a time.
- No idea is a bad idea — but we *park* solutions for later (parking lot on the wall).
- We're here to understand your reality, not to sell you a tool.
- It's fine to say "this wouldn't help me" — that's the most useful thing you can say.
- Phones down during exercises.

**Parking lot:** a visible wall sheet for off-scope ideas — people feel heard, we don't derail.

---

## 8. How we capture (Signý)

**Live, during discussion — keep it fast:** sticky notes / quick bullets on the
wall. One idea per note. Don't try to write full user stories in the moment.

**Structured up afterward — same day:** turn the notes into rows of
**user story · pain (1–5) · frequency · who said it**:

```
As a [role] I want [action] so that [benefit].
Pain today: __/5   Frequency: daily / weekly / rarely
Source: [name / troop]
```

- [ ] Photograph the walls / sketches / sticky notes (Signý).
- [ ] Write it up clean the same day while it's fresh.

---

## 9. Open questions / risk

- Is "dagskrá" = `Program`, or something new? The model may need to change.
- Timeline: single meeting vs. whole dagskrárhringur — hugely different tools. Which first?
- The **"Why" dimension may have no home in the current `Task` model** — confirm tomorrow.
- Drag-and-drop on phone vs. computer — where do leaders actually use this?
- Shared templates imply curation/quality — who maintains that?
- Real-time collaboration (like Google Docs) vs. "one editor at a time" — what's the expectation?
- Útilegur may break the linear model; *mót* almost certainly does — separate tool, or a mode?
- Too much scope for a volunteer project — what is the **minimum** for phase 2?
- **Are we hearing validation because it's real, or because we built it?** (See the kill criterion in §1.)

---

## 10. Next steps (after the meeting)

- [ ] Write up notes + photos into `docs/` (e.g. `docs/features/planner.md`).
- [ ] Consolidate into a prioritised requirements list (update `functional_requirements.md`).
- [ ] Sketch rough user flows for the highest-priority stories.
- [ ] Send participants a summary + thanks (shows we listened).
- [ ] Decide the minimum phase 2 scope with Signý.
- [ ] Plan a *later* round to dot-vote template designs once drafts exist.

---

*Related: README "Tímalína" · `docs/functional_requirements.md` (FR-B, FR-E, FR-T, FR-CN) · `docs/features/tag-management.md`*
