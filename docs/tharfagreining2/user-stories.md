# User-story backlog — þarfagreining vol2

**Post-processing step 3** (see `post-processing.md`). Converts the 97 raw
ábendingar (`meeting-notes.md`) into the §8 story schema:

```
As a [role] I want [action] so that [benefit].
Pain today: __/5   Frequency: daily / weekly / rarely
Source: [Foringi X / Signý / general]   Ábendingar: (#n …)
```

**Conventions**
- **Roles** are the people who *use* Slóði (it is a **leaders' tool**, #97):
  `foringi` (leader), `aðstoðarforingi` (co-/assistant leader),
  `sveitarforingi` / `flokksforingi` (troop / patrol leader),
  `félagsforingi` (group leader), `starfsráð` (staff council).
  **Youth (skátar)** and **parents** appear only as the *subject* or *audience* of a
  story — never as account-holding users (#97).
- **Pain** uses the noted /5 where a value was captured; otherwise `TBD`. Most
  morning entries were told as *method* (no felt pain) — marked `n/a (method)`.
- **Deduplication:** corroborated ábendingar are merged into one story. **More
  sources = stronger signal**, called out per story.
- Stories are grouped under the **cluster letters A–N** from the *Final cluster
  tally*. The cluster→ábending index is at the bottom.
- Traceability: every story keeps its `Ábendingar:` back-links.

---

## A — One source of truth / shared overview (Sheets-like grid + calendar + per-flokkur timeline of ONE dataset)

> Most-corroborated cluster of the day; the *precondition* for everything (#38).
> Highest concrete pain — the incumbent is Excel (#11).

### A1 — A single shared home for the plan ⭐⭐
**As a** foringi **I want** one authoritative place for the whole plan (instead of
scattering it across Excel, Google Sheets, Drive docs, a whiteboard and verbal
hand-offs) **so that** every co-leader is "með á nótunum" and works from the same
current view.
- Pain today: ~4/5 (scatter is the named enemy; Excel is "mesta vesenið")
- Frequency: daily (working reference)
- Source: general / Foringi A / Foringi D / Signý — **strongly corroborated**
- Ábendingar: #38, #16, #18, #82, #94, #11, #34, #30, #31, #32

### A2 — The dagskrárhringur as a grid (meetings × flokkar)
**As a** sveitarforingi **I want** to see the cycle as a grid with time on one axis
and flokkar on the other, each cell holding that patrol's meeting **so that** I can
lay out and balance a whole term across parallel patrols at a glance.
- Pain today: ~4/5 (done in Excel today; #11 "Excel-nördar")
- Frequency: monthly (term layout) / ongoing reference
- Source: Foringi A · independently corroborated by Signý
- Ábendingar: #19, #25, #22, #66, #82

### A3 — Plan it "like Google Sheets," better
**As a** foringi **I want** to edit the plan in a fast, grid-like, Sheets-style UI
(per-fundur, per-flokkur cells) **so that** Slóði actually beats the Excel/Sheets
workflow it is replacing, not just matches it.
- Pain today: ~4/5 (Sheets/Excel is the painful incumbent)
- Frequency: weekly / monthly
- Source: general (closing vote)
- Ábendingar: #82, #19, #25, #38

### A4 — One model, three views (grid · timeline · calendar)
**As a** foringi **I want** the same underlying plan shown as a grid, as a
single-flokkur timeline, *and* as a month/year calendar **so that** I can switch to
whichever projection fits the moment without re-entering data.
- Pain today: n/a (visualisation / mental model)
- Frequency: ongoing
- Source: Foringi A (grid #19, calendar #23) · Signý (timeline #21)
- Ábendingar: #19, #21, #23, #25

### A5 — The master calendar as the integration + discussion surface ⭐
**As a** sveitarforingi **I want** a heildardagatal that assembles every cycle,
meeting, camp and event into one calendar **so that** the team can set dates and
discuss the year *around* a shared artifact.
- Pain today: TBD (maintained by hand in Excel/calendar today)
- Frequency: yearly setup → ongoing reference
- Source: Foringi A / general — corroborated across #11/#15/#16/#18
- Ábendingar: #18, #15, #16, #23, #11

### A6 — A whole-year starfsáætlun, generated from the plan
**As a** félagsforingi **I want** Slóði to generate the félag's annual starfsáætlun
from the content already entered **so that** the year plan is a by-product of
planning, not a separate document to maintain.
- Pain today: TBD
- Frequency: annual (referenced often)
- Source: TBD (general)
- Ábendingar: #1, #15

### A7 — A rolling "next-N-meetings" working window
**As a** flokksforingi **I want** a per-flokkur view windowed to the next ~4 fundir
(done behind, skeleton ahead) **so that** scouts and I plan in the small horizon we
actually work in, not the whole year at once.
- Pain today: TBD (done on the paper "Fundarhugmyndir" sheet today)
- Frequency: rolling (every few meetings)
- Source: TBD (possibly Foringi B)
- Ábendingar: #28, #19, #21

### A8 — Progressive detailing / draft state
**As a** foringi **I want** to leave parts of the plan as "?" / to-fill and detail
them later (which leikir, exact timing) **so that** I can set the skeleton early and
fill day-of details just in time without the plan looking broken.
- Pain today: n/a (method)
- Frequency: every meeting (last-mile)
- Source: Foringi A (#16) · Foringi C ("?" tracking, #24)
- Ábendingar: #16, #24, #19, #56

---

## B — Templates / sniðmát (copy-and-edit blocks, parametrised by theme)

> Strongest value-prop (#57–#59); emphatic "SNIÐMÁT" vote (Foringi G). Serves both
> new leaders (run-as-is) and veterans (remix).

### B1 — Assemble a meeting from a fixed beinagrind + puzzle-in blocks ⭐
**As a** foringi **I want** to start a fundur from a fixed slot skeleton
(setning → dagskrá → leikur → slit → endurmat) and puzzle activities into it **so
that** building a meeting is assembling typed blocks, not authoring from a blank page.
- Pain today: n/a (described confidently as method)
- Frequency: weekly (build) / monthly (rotate slots)
- Source: Foringi A
- Ábendingar: #6, #24, #51, #26, #66

### B2 — Type-aware "create…" launcher
**As a** foringi **I want** to start from "hvað viltu gera í dag?" → búa til fund /
útilegu / mót, each loading the right slot skeleton + templates **so that** creating
a meeting and creating a camp follow their own appropriate flows.
- Pain today: TBD
- Frequency: per fundur / per event
- Source: TBD (closing vote)
- Ábendingar: #65, #6, #24, #61, #37

### B3 — Reusable blocks carry their context (theme + learning), not bare activities ⭐
**As a** foringi **I want** each reusable block to carry its theme and underlying
markmið/ÆSKA, not just the raw activity **so that** a grabbed block is meaningful and
transfers, instead of being a context-free fragment.
- Pain today: TBD (friction reusing context-free blocks)
- Frequency: every reuse
- Source: TBD
- Ábendingar: #52, #26, #27, #5

### B4 — Templates = fixed frame + fill-in blanks (copy-and-edit, never frozen)
**As a** foringi **I want** templates that keep the structure/flow fixed but leave
the content (exact dagskrá, which leikir, which places) as editable blanks **so that**
I can clone-and-tweak rather than rerun a cage.
- Pain today: TBD (clone+fill is the desired flow)
- Frequency: per reuse
- Source: TBD — copy-and-edit corroborated across #2/#3/#6/#22/#54/#56/#63
- Ábendingar: #56, #55, #54, #63, #64, #77

### B5 — Whole events as templates (útilega / mót / kvöldvaka), clone last year + tweak
**As a** sveitarforingi **I want** to save an entire útilega, mót or kvöldvaka as a
template and clone it next time ("same camp, swap the theme") **so that** recurring
events are minor edits, not a re-plan from scratch.
- Pain today: TBD (already done via copy; want clone+tweak first-class)
- Frequency: per recurring event (annual camps/móts)
- Source: TBD (Foringi A's troop, Kópar) — corroborated across #54/#55/#61
- Ábendingar: #55, #61, #54, #57, #58

### B6 — Generic block + theme parameter (parametrised templates)
**As a** foringi **I want** a generic base block (e.g. generic næturleikur) that I
re-skin with different themes **so that** one block yields many variants without
re-authoring each.
- Pain today: TBD (reuse efficiency)
- Frequency: per reuse
- Source: TBD
- Ábendingar: #62, #61, #57, #52

### B7 — Low/zero-prep handoff so any leader can run it ⭐⭐
**As a** new or rotating **foringi I want** to pick up a ready-made event/cycle and
run it with little-to-no prep (adapting to theme/group/circumstances/community) **so
that** I never reinvent the wheel and can add my own strengths on top.
- Pain today: high latent value (handoff/low-prep is the unmet promise)
- Frequency: per cycle / per event (esp. on rotation #15f)
- Source: TBD (drekaskátamót context) — #57+#58+#59 = the templates pitch
- Ábendingar: #57, #58, #59, #63, #64

### B8 — Færnimerki as runnable, adaptable program templates
**As a** foringi **I want** to pull an official færnimerki as a ready-made dagskrá,
adapt it, add it to a fundur and track completion **so that** badges (the canonical
movement-wide template) are easy to plan instead of "maus."
- Pain today: ~3/5 (badges hard to plan/browse today, #3)
- Frequency: ≥1 per dagskrárhringur (the "minnst eitt færnimerki" rule)
- Source: TBD — ties #3/#9/#60/#92
- Ábendingar: #60, #3, #9, #92

### B9 — Badge catalog with instructions, addable to a plan
**As a** foringi **I want** a browsable list of all færnimerki with their
leiðbeiningar ("bókin") that I can add straight to a fundur/dagskrá **so that** I can
find a "cool" badge and run it without hunting the physical planki.
- Pain today: ~3/5 (browsing badges as a leader is hard, #3)
- Frequency: per term
- Source: TBD
- Ábendingar: #92, #3, #60

### B10 — Link/relate program elements (liðir)
**As a** foringi **I want** to connect dagskrárliðir into series/dependencies (e.g.
badge Part 1 → Part 2, a multi-week project) **so that** related blocks aren't
isolated and a project can span several meetings.
- Pain today: TBD
- Frequency: occasional (multi-week projects)
- Source: TBD (closing vote)
- Ábendingar: #90, #66, #19

### B11 — Skipulagsfundur: set up the template, fill after youth plan
**As a** sveitarforingi **I want** to set up the term's template/grid at a
skipulagsfundur and fill it in once the scouts have planned the content **so that**
the cycle kickoff produces a frame ready for youth-supplied content.
- Pain today: TBD
- Frequency: per dagskrárhringur (term start)
- Source: TBD
- Ábendingar: #37, #15, #19, #28

### B12 — Theme-first / goal-first planning entry point
**As a** foringi **I want** to start planning from a theme *or* a markmið and collect
ideas toward it (rather than from a blank activity list) **so that** the cycle is
purposeful (markvisst), not a pile of unconnected wishes.
- Pain today: n/a (method) — markmið-first corroborated (re-stated, #5)
- Frequency: every dagskrárhringur / fundur
- Source: TBD — #4 (theme) · #5 (goal) · #43 (SMART goals)
- Ábendingar: #4, #5, #43, #9

### B13 — Typed slots carry their purpose (setning/slit = values+info, endurmat = retro)
**As a** foringi **I want** structural slots to come with their built-in purpose and
prompts (setning/slit teach lög og gildi + announcements; endurmat = check-in/out
retro) **so that** the skeleton guides the "why," not just the order.
- Pain today: n/a (method, positive)
- Frequency: every meeting
- Source: Foringi A
- Ábendingar: #17, #6, #5

### B14 — Reuse old material from Drive without recreating it
**As a** foringi **I want** to look up and reuse what already lives in old Google
Drive folders **so that** I build on existing material instead of authoring from
scratch.
- Pain today: TBD (finding + bringing in existing stuff is the friction)
- Frequency: per planning session
- Source: TBD — Drive recurs across #2/#34
- Ábendingar: #2, #34

---

## C — Assign & notify ahead (roles/tasks per meeting, share with lead time)

> Top collaboration **pain** (#33 "ógeðslega lélegur"); only 1 dot but ~4/5 pain —
> pain ≫ dots. Pairs with A + J.

### C1 — Share the plan + assign tasks to co-leaders ahead of time ⭐
**As a** foringi **I want** to push the next meeting's plan and each
aðstoðarforingi's tasks to them with lead time **so that** I kill the "5 minutes
before the meeting" scramble and everyone knows their role.
- Pain today: ~4/5 ("ógeðslega lélegur" at informing + splitting tasks)
- Frequency: every meeting
- Source: Foringi G — corroborated by Signý (#30) and Foringi A (#15e)
- Ábendingar: #33, #30, #15, #40, #68

### C2 — "Your role/tasks today" glanceable view
**As an** aðstoðarforingi **I want** a glanceable view of the plan and my role/tasks
for the next fundur **so that** I arrive prepared instead of being briefed verbally
minutes before.
- Pain today: ~4/5 (JIT verbal hand-off today)
- Frequency: every meeting
- Source: Signý (#30) · Foringi G (#33)
- Ábendingar: #68, #30, #33, #15

### C3 — Per-item ownership ("hver tekur ábyrgð á hverju")
**As a** sveitarforingi **I want** to assign explicit ownership to each plan item
**so that** it is clear who is responsible for what, across the planning process.
- Pain today: n/a (method, but encodes the assignment pain of #33)
- Frequency: per planning session / per meeting
- Source: Foringi D
- Ábendingar: #40, #15, #30, #33

### C4 — Send the procurement list to the staff buyer with lead time
**As a** sveitarforingi **I want** the procurement/innkaup list generated from the
plan and sent to the starfsmaður in good time (not right before) **so that** supplies
are bought ahead, not in a last-minute scramble.
- Pain today: ~3/5 (recognised as too-late, "gera tímanlega")
- Frequency: monthly (buying cycle)
- Source: TBD
- Ábendingar: #39, #19, #15

### C5 — Pre/post-meeting collaboration loop with role-split
**As a** sveitarforingi **I want** a short pre-meeting huddle to set goals (SMART /
markmið) and a post-meeting plan-next + endurmat with aðstoðarforingjar **so that**
each meeting has a clear before/after loop instead of a rushed 15-min squeeze.
- Pain today: moderate (the 15-min-before squeeze, cf #33)
- Frequency: every meeting
- Source: TBD
- Ábendingar: #43, #15, #40, #24

---

## D — Written endurmat that resurfaces (the learning loop)

> **PROMOTED to Tier 1 / first-class (D2, `decisions-log.md`).** 0 dots but ~4/5 pain
> (#45/#48) and facilitator-strong — only demoted under the old two-maintainer
> assumption. Now a **first-class track owned by the 6-person testing & endurmat
> team**, still built lightweight (capture optional #47, resurfaces passively D7).
> *To be confirmed with Signý.*

### D1 — Write endurmat so we stop repeating mistakes ⭐
**As a** foringi **I want** to attach written endurmat to a fundur / event / badge /
cycle **so that** lessons are kept instead of lost to verbal-only review and we stop
"making the same mistakes again and again."
- Pain today: ~4/5 (explicit repeated-mistakes cost)
- Frequency: every cycle (and lost every cycle it isn't written)
- Source: TBD
- Ábendingar: #45, #44, #46, #35

### D2 — Resurface the previous run's endurmat when planning again ⭐
**As a** foringi planning a recurring event/cycle **I want** last time's endurmat
surfaced automatically (esp. for a new mótstjórn taking over) **so that** I can "horfa
aftur um öxl" and build on others' lessons.
- Pain today: ~4/5 (repeated mistakes across rotating leadership)
- Frequency: per event/cycle (esp. on handoff #15f)
- Source: TBD (mót context) — closes the #45 loop
- Ábendingar: #48, #45, #46, #22

### D3 — Endurmat travels with reused templates
**As a** foringi **I want** the written endurmat to travel with a block/template when
I clone it **so that** when I copy last year's skeleton its lessons come along too.
- Pain today: TBD
- Frequency: per reuse
- Source: TBD
- Ábendingar: #45, #48, #22, #57

### D4 — Scale-appropriate, low-friction endurmat (capture the good + the bad)
**As a** foringi **I want** quick/optional endurmat for routine fundir and structured
written endurmat for events (filed to the council archive), prompting both "hvað gekk
vel" and "hvað hefði mátt fara betur" **so that** the worthwhile lessons get written
without forcing a field nobody fills.
- Pain today: TBD (routine endurmat is skippable / verbal-only today)
- Frequency: per meeting (optional) / per event (formal)
- Source: TBD
- Ábendingar: #46, #47, #49, #17

### D5 — Solo-draft → peer review/critique mode
**As a** foringi **I want** to plan a draft alone and invite constructive criticism
(comments, not edits) from other leaders **so that** I can get feedback without
surrendering ownership of the draft.
- Pain today: TBD (no review/comment channel today)
- Frequency: per planning session
- Source: Foringi E
- Ábendingar: #50, #20, #41

### D6 — Keep fundargerðir / meeting records
**As a** sveitarforingi **I want** to keep and search meeting minutes (fundargerðir),
especially for sveitaráðsfundir **so that** decisions and context carry forward across
rotating flokksforingjar.
- Pain today: TBD (scattered; continuity is the value)
- Frequency: per council meeting
- Source: TBD
- Ábendingar: #35, #15, #19

---

## E — Activity / games bank — mobile, in-the-moment, searchable

> Daily use; feeds B; 4–5 dots. Mobile-first for in-the-moment use (#53).

### E1 — A fast mobile "quick game" lookup 📱
**As a** foringi **I want** a leikjabanki on my phone to grab a quick game in the
moment (filter by duration, energy, age, gear) **so that** I can fill or rescue a
session live without pre-planning.
- Pain today: TBD (in a doc today; speed + mobile is the want)
- Frequency: weekly (in-meeting)
- Source: TBD — corroborated #29/#53/#85
- Ábendingar: #53, #29, #85, #10

### E2 — A searchable activity/idea bank for when planning (and when kids get stuck)
**As a** foringi **I want** a searchable bank of activities/ideas to pull from when
planning or when scouts get stuck **so that** I always have a fallback and don't have
to source everything from memory or the open web.
- Pain today: TBD (scattered in documents; findability is the pain)
- Frequency: weekly
- Source: TBD
- Ábendingar: #29, #10, #16, #85

### E3 — Richer tags + better search of the bank
**As a** foringi **I want** more and better tags (filling gaps like "eldur") on bank
content **so that** I can actually find the right activity.
- Pain today: TBD (findability)
- Frequency: weekly
- Source: TBD (closing vote)
- Ábendingar: #73, #53, #29

### E4 — Bookmark/save favourites
**As a** foringi **I want** a working bookmark/favourites button on programs and
activities **so that** I can save and quickly retrieve the ones I want to reuse.
- Pain today: TBD (small UX/utility)
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #81, #53, #87

### E5 — Prevent duplicates / curate the bank
**As a** foringi **I want** the program bank to avoid duplicate entries as community
contributions grow **so that** the bank stays trustworthy and searchable rather than
cluttered.
- Pain today: TBD (curation/quality need)
- Frequency: ongoing (as bank grows)
- Source: TBD (closing vote) — raises §9 "who maintains quality?"
- Ábendingar: #89, #84, #87, #82

### E6 — Scouting-specific content types (hróp, kvöldvökur, songs)
**As a** foringi **I want** the bank to model scouting-specific content (hróp,
kvöldvökur, songs, ceremonies), not just generic "activities" **so that** I can grab
ready-made, editable classics for camps and meetings.
- Pain today: TBD (wants ready-made + editable, on phone)
- Frequency: per camp / per meeting
- Source: TBD
- Ábendingar: #54, #53, #29

---

## F — ÆSKA coverage / balance (þroskasvið wrapper made visible)

> Facilitator-strong (#27), few dots. The "why" envelope made visible.

### F1 — See ÆSKA / þroskasvið coverage across the plan
**As a** sveitarforingi **I want** to see how the plan covers the ÆSKA developmental
areas (with ÆSKA as the wrapper around the whole dagskrá, not a single field) **so
that** I can balance the programme across þroskasvið over a cycle.
- Pain today: n/a (conceptual framing; coverage tooling is latent)
- Frequency: per dagskrárhringur
- Source: Foringi B — ties badges↔ÆSKA (#92)
- Ábendingar: #27, #60, #92

---

## G — Youth access: view + suggest (RESOLVED #97 — view-only, NOT users; age by guidance not lock, D8)

> 🅰️ RESOLVED: Slóði is a **leaders' tool**. Youth are the *subject* of these
> stories, never account-holding users. Older youth may *view* the dagskrá; younger
> (drekar/fálkar) get none; parents view-only.

### G1 — A youth/parent-facing read-only dagskrá view
**As a** foringi **I want** to share a read-only view of the *dagskrá* (the programme
only — not innri mál: planning notes, endurmat, assignments, council) with older
youth and parents **so that** they can see what's happening without accessing
leader-internal data.
- Pain today: TBD
- Frequency: per cycle / ongoing
- Source: Foringi A (#20 audiences) — RESOLVED by #97
- Ábendingar: #97, #20, #69, #79

### G2 — Capture and act on youth suggestions (leader-driven)
**As a** foringi **I want** to run a youth-led theme process (discuss → present →
vote → plan with help) and capture the scouts' suggestions/ideas in the plan **so
that** scouts genuinely co-create their dagskrá while I stay the account holder and
decision owner.
- Pain today: n/a (method + clear want)
- Frequency: per dagskrárhringur (theme) → weekly (kids plan)
- Source: Foringi A (#14) · others — corroborated across #4/#8/#9/#14
- Ábendingar: #8, #4, #9, #14, #20

### G3 — A youth-facing planning sheet/template (printable)
**As a** foringi **I want** to give scouts a template/sheet for *how a meeting should
be* and *what they need*, and print it for them to fill by hand **so that** the
template teaches them to plan and the paper step works without youth accounts.
- Pain today: TBD (current practice on paper)
- Frequency: per fundur / rolling
- Source: TBD — corroborated #8/#10/#28
- Ábendingar: #10, #8, #28, #96

### G4 — Age-scaled youth agency
**As a** sveitarforingi **I want** older age groups (dróttskátar, rekar) to be able
to influence/suggest more than younger ones (drekar/fálkar none) **so that** youth
participation scales appropriately with age and safeguarding.
- Pain today: n/a (current practice)
- Frequency: ongoing
- Source: Foringi A — RESOLVED by #97
- Ábendingar: #15, #97, #20

---

## H — Félag-level registries (members · gear · badges · venues · skills) [likely later]

> Big surface; mostly later, not build-first. People/personal data stays
> félag-internal (#79).

### H1 — Equipment registry + booking (búnaðarskráning)
**As a** félagsforingi **I want** to register the félag's gear, know what we have, and
declare when it is in use **so that** plans fit real inventory and gear isn't
double-booked.
- Pain today: TBD (underlying inventory/clash pain is real, cf #11 ~4/5)
- Frequency: ongoing
- Source: TBD (follows Foringi D's #11)
- Ábendingar: #12, #11, #72

### H2 — Resource clash detection across flokkar
**As a** sveitarforingi **I want** shared resources (kitchen, rooms, gear) tracked so
clashes are flagged when many flokkar run in parallel **so that** the eldhús isn't
booked three times at once — "mesta vesenið."
- Pain today: ~4/5 (highest concrete pain; needs Excel today)
- Frequency: monthly (term layout) / ongoing
- Source: Foringi D
- Ábendingar: #11, #12, #62

### H3 — Félag member roster (félagalisti)
**As a** félagsforingi **I want** a roster of who is in the félag **so that** I have a
people foundation for access, lending and registries — kept félag-internal only.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #72, #79, #1

### H4 — Per-scout færnimerki progress tracking
**As a** foringi **I want** to track which scouts have earned which færnimerki **so
that** I can see badge progress — kept félag-internal (minors' data, persónuvernd).
- Pain today: TBD
- Frequency: per term
- Source: TBD (closing vote) — ⚠️ minors' data → see K
- Ábendingar: #78, #72, #79

### H5 — Leader skill/experience registry (reynsluskráning)
**As a** félagsforingi **I want** to register which leaders can run what (e.g. who can
run klifur) and let leaders teach/help each other **so that** activities are matched
to qualified leaders (Safe from Harm) and we draw on each other's skills.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD — ties #13 leader skills
- Ábendingar: #86, #13, #72

### H6 — Cross-félag gear coordination
**As a** félagsforingi **I want** to reach other félög to borrow/coordinate gear we
lack **so that** we can "fá lánað og nýta aftur" instead of buying or going without.
- Pain today: TBD
- Frequency: occasional
- Source: TBD
- Ábendingar: #12, #72

---

## I — Outputs / generation (print, export, derived worklists)

### I1 — Print/export fundir, starfsáætlun, templates
**As a** foringi **I want** to print/export meetings, the starfsáætlun, templates "og
meira" **so that** the plan produces paper artifacts, not just an on-screen view.
- Pain today: TBD (flagged "mikilvægt")
- Frequency: per fundur / per term
- Source: TBD (closing vote)
- Ábendingar: #96, #10, #1, #23

### I2 — Derived worklists generated from the plan
**As a** sveitarforingi **I want** Slóði to generate "hvað þarf að framkvæma"
worklists (procurement, materials, to-dos) from the plan **so that** export is a
useful worklist, not just a print of the screen.
- Pain today: TBD (done by hand on written "blöð" today)
- Frequency: monthly
- Source: Foringi A
- Ábendingar: #15, #19, #1, #10

---

## J — Roles / access tiers / profiles / sharing ⭐⭐ (runaway top vote)

> §5.2 had *dropped* RBAC; the room says it is central. Builds on Slóði's existing
> owner/admin/editor/viewer roles, with new shades.

### J1 — Edit access for co-leaders (samforingjar)
**As a** foringi **I want** to give samforingjar edit access to the dagskrá **so
that** we can co-edit one plan (matching today's Google Sheets editor access) instead
of one author at a time.
- Pain today: TBD (met by Sheets editor access today)
- Frequency: every meeting / ongoing
- Source: Signý (#30) — closing vote #67
- Ábendingar: #67, #30, #94

### J2 — View + receive-tasks tier for aðstoðarforingjar
**As an** aðstoðarforingi **I want** to *see* the dagskrá and *receive my
tasks/fyrirmæli* (without full edit) **so that** I know the plan and my role without
being able to change everything. *(New shade beyond viewer/editor — ties C.)*
- Pain today: ~4/5 (verbal JIT hand-off today, cf #33)
- Frequency: every meeting
- Source: TBD (closing vote)
- Ábendingar: #68, #30, #33

### J3 — Partial view for others ("séð en ekki endilega allt")
**As a** foringi **I want** to grant a partial view to others (see some of the plan,
not all) **so that** I can share appropriately with parents/older youth without
exposing innri mál.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD (closing vote) — ties G/#97
- Ábendingar: #69, #20, #97

### J4 — Share the dagskrá with others
**As a** foringi **I want** to share the dagskrá with others **so that** the
one-source plan can be distributed beyond the editing team.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #70, #38, #18

### J5 — Individual profiles + view the master
**As a** foringi **I want** each person to have their own profile and be able to view
the "master" plan **so that** identity is per-person (enabling follow/badges) and
everyone can see the one source of truth.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #80, #38, #76

### J6 — Starfsráð (staff council) access + work in-tool
**As a** member of **starfsráð I want** an access tier to work directly inside Slóði
(instead of a separate starfsráðsmappa) **so that** the council works in one place and
Slóði becomes the digital council folder.
- Pain today: TBD
- Frequency: per council meeting
- Source: TBD (closing vote) — ties #15 governance, #46 archive
- Ábendingar: #93, #15, #46, #38

### J7 — Plan in-tool → frictionless contribution
**As a** foringi **I want** the plan to live in Slóði so it is trivial to get
co-leaders/others to add to it **so that** centralising the plan lowers the barrier to
contribution and directly counters the #33 "hard to involve co-leaders" pain.
- Pain today: ~4/5 (the #33 collaboration pain this unlocks)
- Frequency: ongoing
- Source: TBD (closing vote) — the A+J synergy
- Ábendingar: #94, #33, #38, #67

### J8 — Scope member/personal data félag-internal only ⭐
**As a** félagsforingi **I want** member/badge/personal data to be visible only inside
the félag, never to outsiders **so that** we can share programs/ideas openly across
félög while keeping people's data private (the safeguarding-compatible line).
- Pain today: TBD (key boundary)
- Frequency: ongoing
- Source: TBD (closing vote) — ties K
- Ábendingar: #79, #78, #72, #71

---

## K — Safeguarding & data security ⚠️ (guardrail, not a feature — gates G/J)

### K1 — Secure data + prevent neteinelti
**As a** foringi **I want** Slóði to keep data secure (persónuvernd, esp. minors) and
prevent neteinelti (cyberbullying) **so that** youth-access and sharing features are
safe — no open youth-to-youth channels, minors' data protected. *(Gates G/J; satisfied
in part by #97 making youth view-only.)*
- Pain today: TBD (guardrail)
- Frequency: ongoing (cross-cutting)
- Source: TBD (closing vote) — ties Safe from Harm #13
- Ábendingar: #71, #13, #79, #97

---

## L — Gamification / engagement (**Tier 1** — promoted; drives adoption)

### L1 — Achievement badges for leaders using Slóði
**As a** foringi **I want** achievement badges / points / levels (and Slóðaverðlaun)
for using Slóði **so that** there is an incentive to adopt and keep using the
platform. *(Distinct from scout færnimerki — this is platform engagement for leaders.)*
- Pain today: TBD (a genuine want, nice-to-have)
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #74, #75, #95

---

## M — Community / cross-org discovery & inspiration ⭐ (highest enthusiasm; phase 2.5/3)

> The movement-wide super-workspace (FR-B6/B7). Likely later, after A/B/J exist to
> share *from*. Share programs/ideas openly; keep people-data private (#79/J8).

### M1 — See what other félög/sveitir are doing; follow leaders ⭐
**As a** foringi **I want** to browse what other félög/sveitir are doing for
inspiration and follow specific leaders (e.g. "elta Signý sem gerir geggjaða fundi")
**so that** I can follow the tíðarandi and learn from great programmes across the
movement.
- Pain today: TBD ("ótrúlega spenntur" — high enthusiasm)
- Frequency: ongoing
- Source: TBD (closing vote) — ties #36 pool-experience
- Ábendingar: #76, #36, #80

### M2 — Pool experience and get advice from other leaders
**As a** foringi **I want** to mix different leaders' experience and get advice (ráð)
from others when building a dagskrá **so that** I benefit from diverse approaches
beyond my own team.
- Pain today: TBD (opportunity more than pain)
- Frequency: ongoing
- Source: Foringi E
- Ábendingar: #36, #76

### M3 — Create and share my own templates to the community
**As a** foringi **I want** to create my own templates and share them with others **so
that** the answer to own-vs-shared is "both" — my own templates plus a community
library.
- Pain today: TBD
- Frequency: occasional
- Source: TBD (closing vote)
- Ábendingar: #84, #22, #55, #36

### M4 — Pull official/shared events into my plan (BÍS + other félög)
**As a** foringi **I want** to drag official BÍS events and other félög's shared
events into my dagskrá **so that** authoritative/curated events auto-populate my plan
(landsmót, holidays) instead of being re-entered.
- Pain today: TBD
- Frequency: per term
- Source: TBD (closing vote) — ties #23 official events, #60 BÍS layer
- Ábendingar: #83, #23, #60, #2

### M5 — Save others' ideas to my own board (Pinterest-style)
**As a** foringi **I want** to save dagskrárhugmyndir from others to my personal wall
and organise/sort them **so that** I can collect-and-curate inspiration (see → save →
use) for later.
- Pain today: TBD
- Frequency: ongoing
- Source: TBD (closing vote)
- Ábendingar: #87, #76, #81

---

## N — Integrations / external systems (Drive · BÍS · Abler.io)

### N1 — Integrate with Abler.io (member data)
**As a** félagsforingi **I want** Slóði to pull member data from Abler.io **so that**
I don't re-key what already lives in the scouting membership system.
- Pain today: TBD
- Frequency: ongoing (sync)
- Source: TBD (closing vote)
- Ábendingar: #91, #72, #78

### N2 — Import an existing plan from outside (Drive / Sheets)
**As a** foringi **I want** to import/"sækja dagskrá utan frá" (from Drive/Sheets)
**so that** I can onboard existing plans instead of re-entering them. *(Probe:
import/migrate vs. link out — see §9.)*
- Pain today: TBD
- Frequency: onboarding / occasional
- Source: TBD (closing vote) — ties #2 import-vs-link
- Ábendingar: #82, #2, #34, #83

---

## Cross-cutting (not a feature cluster)

### X1 — Mobile / form factor 📱
**As a** foringi **I want** Slóði usable on my phone (in-the-moment use is phone;
planning may be desktop) **so that** I can grab a quick game or check the plan live at
a meeting. *(Confirm intent: native app vs responsive web / PWA.)*
- Pain today: TBD (terse "App?" post-it)
- Frequency: in-meeting (phone) / planning (desktop)
- Source: TBD (closing vote)
- Ábendingar: #88, #53, #54, #82

### X2 — Version history of the plan
**As a** foringi **I want** to see how the plan evolved over time (version history)
**so that** I can track changes and recover earlier states.
- Pain today: TBD
- Frequency: occasional
- Source: TBD (closing vote)
- Ábendingar: #77, #35

### X3 — Preserve scroll position on back-navigation
**As a** foringi **I want** the page to keep my scroll position when I navigate back
(not jump to the top) **so that** I don't lose my place in a long plan/list.
- Pain today: low (UX papercut)
- Frequency: ongoing
- Source: Foringi F
- Ábendingar: — (verbal leftover, post-processing.md)

---

## Non-goals / parking lot (explicit — volunteer project, finite capacity)

Captured needs that are real but **out of build-first scope** (bias to minimal viable
scope):
- **Youth accounts / youth-as-users; technical age lock** — RESOLVED non-goal (#97, D8):
  youth are view-only via a share link; age-appropriateness is honour-system guidance, not
  enforced; **no minor-account system and no age lock in v1.**
- **Full félag registries (H)** — gear/booking/rosters/badge-progress/skills: large
  surface, **likely later** (#11/#12/#13/#72/#78/#86).
- **Community super-workspace (M)** — high enthusiasm but the biggest surface;
  **phase 2.5/3**, after A/B/J exist to share from (#76/#83/#84/#86/#87).
- **Integrations (N)** — Abler.io/BÍS/Drive: valuable but big; **later** (#91/#82/#83).
- **Resource clash detection (H2)** — high pain but a new entity (`Resource`); **after
  the core grid** (#11).
- **Pedagogy-only pains** with no clear tool fit — e.g. mixed-ambition groups (#7):
  capture the need, do **not** force a feature.

---

## Index — cluster → contributing ábendingar

| Cluster | Ábendingar |
|---|---|
| **A — One source of truth / overview** | #1, #11, #15, #16, #18, #19, #21, #22, #23, #24, #25, #28, #30, #31, #32, #34, #38, #56, #66, #82, #94 |
| **B — Templates / sniðmát** | #2, #3, #4, #5, #6, #9, #17, #22, #24, #26, #27, #34, #37, #43, #51, #52, #54, #55, #56, #57, #58, #59, #60, #61, #62, #63, #64, #65, #66, #77, #90, #92 |
| **C — Assign & notify ahead** | #15, #24, #30, #33, #39, #40, #43, #68 |
| **D — Written endurmat loop** | #17, #20, #22, #35, #41, #44, #45, #46, #47, #48, #49, #50, #57 |
| **E — Activity / games bank + search** | #10, #16, #29, #53, #54, #73, #81, #82, #84, #85, #87, #89 |
| **F — ÆSKA coverage** | #27, #60, #92 |
| **G — Youth access (RESOLVED #97)** | #4, #8, #9, #10, #14, #15, #20, #28, #69, #79, #96, #97 |
| **H — Félag registries** | #11, #12, #13, #72, #78, #79, #86 |
| **I — Outputs / generation** | #1, #10, #15, #19, #23, #96 |
| **J — Roles / access / profiles / sharing** | #18, #20, #30, #33, #38, #46, #67, #68, #69, #70, #71, #72, #76, #78, #79, #80, #93, #94, #97 |
| **K — Safeguarding & data security** | #13, #71, #79, #97 |
| **L — Gamification / engagement** | #74, #75, #95 |
| **M — Community / cross-org discovery** | #2, #22, #23, #36, #55, #60, #76, #80, #81, #83, #84, #87 |
| **N — Integrations** | #2, #34, #72, #78, #82, #83, #91 |
| **Cross-cutting (X)** | #35, #53, #54, #77, #82, #88 + Foringi F scroll-position (verbal) |

> Note: clusters overlap by design (an ábending can feed several). The
> `meeting-notes.md` *Final cluster tally* assigns each closing post-it (#65–#96) a
> primary cluster; this index lists every ábending that *informs* a cluster, primary
> or supporting.
