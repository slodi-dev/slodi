# Skátaþing landing + games

Brainstorming doc — nothing here is decided yet. The goal is to capture the idea, surface open questions, and converge on an MVP scope before we cut tickets.

## Goal

Drive scout-community traffic to slodi.is around Skátaþing by hosting a small set of fun, scout-themed browser games behind login. Secondary goals:

1. **Sign-ups** — gating play behind Auth0 turns curious players into accounts in our user table.
2. **Soft stress test** — concentrated traffic at a known time gives us a real-world load profile we don't otherwise have.
3. **Brand / awareness** — people who would never click a "program planning tool" link will click "play Heiðursorðla".

> 🚨 **Phase 1 deadline: Saturday 11 April 2026, morning.** Skátaþing was rescheduled from March to **Fri 10 – Sat 11 April 2026** due to weather. **Phase 1 (Heiðursorðla MVP) goes live for Saturday morning** — that's ~24 hours from now (today is Fri 2026-04-10). **Heiðursorðla is Saturday-only**: the playable window opens at 10:30 Saturday, the last round locks at midnight Saturday, and from Sunday 00:00 onward the app shows a closed/archive view (the event is over). Friday is not a playable day for Heiðursorðla. The full feature set is delivered in [phases](#phased-delivery) — we are **not cutting features, we are sequencing them**.

## Decided

These are locked in based on conversation so far — no longer open questions:

- **Hard login wall.** No anonymous play. You must have an account to see the games at all. Maximizes signups (which is the point) and gives us a clean stress-test traffic profile. Logged-out visitors hitting `/skatathing` get redirected straight to Auth0 sign-up.
- **Mobile-first, not "responsive".** Design and build the 375px phone view *first*; desktop is a secondary adaptation. Almost all event traffic will arrive via QR code on a phone. Every interaction (Heiðursorðla keyboard, Tengingar tap-select, Hörpuhopp controls) must work one-thumbed in portrait.
- **Event window for Heiðursorðla: Saturday only, 10:30 → 24:00 Iceland time.** One playable day. From Sunday 00:00 onward the app is in closed/archive mode — the leaderboards are frozen and visible read-only, the answers from Saturday's rounds are revealed, but no further play. (The broader Skátaþing physical event runs Friday–Saturday, but Heiðursorðla doesn't have puzzles on Friday — Phase 1 only ships in time for Saturday morning.)
- **Cadence: four Heiðursorðla puzzles per event day, front-loaded toward the daytime.** The day window is **10:30 → 24:00 Iceland time** (13.5 hours), split into three back-to-back 2h30 sprint rounds and one long final round filling the evening. Rounds don't overlap, so **at most one puzzle is "live" at any moment**:
  - Puzzle #1: unlocks 10:30, locks 13:00 (2h30)
  - Puzzle #2: unlocks 13:00, locks 15:30 (2h30)
  - Puzzle #3: unlocks 15:30, locks 18:00 (2h30)
  - Puzzle #4 (final): unlocks 18:00, locks 24:00 (6h)

  When a round rolls over the previous puzzle locks and the next one unlocks; each puzzle's score is independent (its own attempt row, its own leaderboard, no carry-over between rounds). During off-hours (00:00–10:30) no puzzle is live and the page shows a countdown to the next 10:30 drop. "Four per day" is **per game**, not split across games — Tengingar will get its own puzzle count when it ships in Phase 3. Hörpuhopp runs continuously across the whole event window (it's a high-score game, not a daily puzzle).
- **Curation model: pre-picked words bound to time windows.** Puzzle words are chosen ahead of time by the content owner and seeded directly into `heidursordla_puzzles` rows with explicit `(unlocks_at, locks_at)` columns. The puzzles table *is* the schedule — the backend has no runtime puzzle-generation, no algorithmic word-of-the-day picker, and no per-user randomization. To change the schedule, edit (or add) rows.
- **Live H:m:s countdown to the next puzzle drop.** Reusable `NextPuzzleCountdown` component shown on the Skátaþing landing page, on each game's index, and on the game-over overlay after a puzzle is finished. Drives return visits to the page.
- **Top-10 leaderboard with emoji grids.** Each game's leaderboard shows the top 10 players with their final score *and* the 🟩🟨⬛ emoji-grid representation of how they played, not just their score. Sort: fewest guesses first, earliest finisher wins ties.
- **Word length: 5 letters only.** No 6-letter variant for the event.
- **Word list: generated from BÍN via the `islenska` pip package, then committed as a static file.** Same source the existing Icelandic Wordle clones (orðla, orðill) use. A one-shot Python script (`backend/scripts/generate_heidursordla_dictionary.py`, dev-group dep on `islenska`) iterates BÍN lemmas, filters to 5-character entries excluding personal names (`ism`) and place names (`örn`), NFC-normalizes, and writes the result to `backend/app/data/icelandic_5_letter_words.txt`. That file is committed to the repo; the backend loads it once at startup into a `frozenset[str]`. Expected size: ~3,000–8,000 words. License: BÍN data is **CC BY-SA 4.0** — legally clean. The runtime backend has no `islenska` dep; it's only needed when regenerating. **The curated answer list is separate** and is still hand-curated scout vocabulary by a content owner — see open questions.
- **Invalid-guess UX is MVP, not v2.** When a player tries to submit a word that isn't in the valid-guess list, the active row shakes and an Icelandic toast appears (e.g. "Ekki í orðabók"). The guess is *not* consumed — they can edit it and try again. Missing this would make the game feel broken to anyone who tries an unusual word.
- **Physical keyboard support.** A `keydown` listener on the play view captures letters, Backspace, and Enter so foringjar on a desktop or tablet can type. The virtual keyboard remains the primary input on phones; the physical listener is additive. ~5 minutes of work and a real UX win.
- **NFC normalization on every incoming guess.** The backend `POST /guess` handler runs `unicodedata.normalize("NFC", word.lower())` on the incoming word *before* dictionary lookup or comparison to the answer. The dictionary file and the stored answer are both NFC-normalized at load time. This prevents the "á as a + combining acute" failure mode where a player's keyboard sends a decomposed codepoint sequence and the lookup silently misses.
- **Locked-puzzle UX = the countdown is the page.** If a player hits a Heiðursorðla page before its `unlocks_at`, the page renders the `NextPuzzleCountdown` component centered, with Icelandic copy ("Næsta þraut opnast eftir H:m:s"), and no grid or keyboard. Same for the index during off-hours (Saturday 00:00–10:30) when no puzzle is live yet. When the countdown hits zero, the component fires `onExpire` and the page refetches `/today`. No 404, no redirect — the wait *is* the experience.
- **Event-ended UX = closed archive view.** From **Sunday 12 April 2026 00:00 Atlantic/Reykjavik onward**, the event is over. The `/skatathing/heidursordla` page renders a "Skátaþingsorðlu er lokið" view that shows Saturday's four final per-round leaderboards, the answers for each round revealed, and a thank-you message — read-only, no countdown, no play. The backend enforces this by having `/today` return `{event_ended: true}` and `/{puzzle_id}/guess` return HTTP 410 Gone after the cutoff. The cutoff is a hardcoded constant in the backend service for Phase 1 — no admin toggle.
- **Full deploy, phased delivery.** All three games and all features are in scope. Phasing is about sequencing, not cutting. See [Phased delivery](#phased-delivery).

## Proposed scope

- New route: `slodi.is/skatathing` (Next.js App Router segment under `frontend/app/skatathing/`), **mobile-first** (build the 375px portrait layout before touching desktop)
- Header button on the landing page linking to it (visible to logged-out users — it's the hook into the funnel)
- **Hard login wall.** Hitting `/skatathing` while logged out redirects to Auth0 sign-up; no preview, no demo round, no leaderboard peek
- Three games:
  1. **Heiðursorðla** — Icelandic word guessing, scout vocabulary (from *heiðursorða* + *Orðla*)
  2. **Tengingar (Connections)** — group-of-four puzzle with scout categories
  3. **Hörpuhopp (Doodle-Jump)** — platformer with a scout leader character
- **Four Heiðursorðla challenges on Saturday**, staggered across the day per the cadence above (2h30+2h30+2h30+6h), all locking at midnight Saturday. Hörpuhopp (Phase 4) runs continuously across whatever window is active for it — separate question.
- Single backend table for high scores across all games
- Per-game **top-10 leaderboards with emoji grids**: daily for Heiðursorðla/Tengingar, all-event for Hörpuhopp

## Games — initial thoughts

### Heiðursorðla — Phase 1 game (full spec in [`games/heidursordla.md`](./games/heidursordla.md))

- **Cadence:** four puzzles per event day, front-loaded — three back-to-back 2h30 sprint rounds (10:30–13:00, 13:00–15:30, 15:30–18:00) plus one long final round (18:00–24:00); only one puzzle is live at a time
- All UI text in Icelandic
- Icelandic alphabet — virtual keyboard must include `Þ Æ Ö Á É Í Ó Ú Ý Ð`
- Curated **answer list** = scout vocabulary (hand-picked, currently `hnýta` and `æskan` for Saturday Rounds 1 & 2); **valid-guess list** = the full 5-letter Icelandic word list generated from BÍN via the `islenska` package, committed at `backend/app/data/icelandic_5_letter_words.txt` (24,930 words)
- Score = guesses used, lower is better
- **Share string** — NYT-style emoji grid (🟩🟨⬛) copied to clipboard, Icelandic copy ("Heiðursorðla #12 — 4/6"), purely client-side
- **Top-10 leaderboard** displays each player's emoji-grid alongside their score

### Tengingar (Connections) — Phase 3 game (stub in [`games/tengingar.md`](./games/tengingar.md))

- 16 words, 4 groups of 4, scout-themed categories ("útilegubúnaður", "skátahnútar", "foringjastig", …)
- **Cadence:** to be confirmed for Phase 3. Tengingar's puzzle count and quarter mapping is a separate question — Heiðursorðla's quarterly schedule is not necessarily what Tengingar should adopt
- All UI text in Icelandic
- Score = mistakes made + time, or just "solved / not solved + mistakes"
- Share string — same model as Heiðursorðla (color-block grid showing which guesses were right)
- Curation is the hard part — need a content owner

### Hörpuhopp (Doodle-Jump) — highest effort

- **Cadence:** runs continuously across whatever event window applies when Hörpuhopp ships (Phase 4 — out of scope for the Saturday-only Heiðursorðla launch). The leaderboard is "best score across the active event window".
- Canvas + game loop, runs in-browser
- Mobile controls: tap-left / tap-right halves of the screen. **No device tilt** — the iOS Safari permission flow is awful and tilt is inconsistent across phones.
- Theming ideas: scout leader character, jump on knots / tents / campfires, avoid rain clouds and mosquitoes, collect badges
- All UI text in Icelandic
- Score = max height reached
- **Cheating risk is high here** — the score is a single number from the client. See "Anti-cheat" below.

## Backend — score storage

Sketch of the single table the user proposed:

```
game_scores
  id          uuid pk
  user_id     uuid fk → users.id
  game        enum('heidursordla','tengingar','horpuhopp')
  score       int           -- semantics depend on game (lower-better for heidursordla, higher-better for horpuhopp)
  metadata    jsonb null    -- guesses, time taken, puzzle-of-the-day id, etc.
  created_at  timestamptz
  -- index on (game, score desc) for leaderboard
  -- index on (game, user_id, created_at) for "my scores"
```

Open question: **per-game tables vs. one polymorphic table?** A single table is simpler and matches the user's instinct. The downside is mixed score semantics (lower-is-better vs higher-is-better) — leaderboard queries need to know per game which direction to sort. Worth it for the simplicity, IMO, as long as we keep the sort direction in code (or in a small games config table).

Endpoints needed (rough):

- `POST /skatathing/scores` — submit a score (auth required)
- `GET  /skatathing/leaderboard/{game}?period=all|today` — top N
- `GET  /skatathing/me/scores` — current user's history
- `GET  /skatathing/heidursordla/today` / `GET /skatathing/tengingar/today` — daily puzzle data

Cache leaderboards aggressively (`aiocache`, ~30s TTL) — they will be the hottest endpoint and don't need to be real-time.

## Open questions / things to think about

These are the things we haven't talked about that I think matter:

### Product / UX

1. ~~Login wall vs. demo mode~~ — **decided: hard wall.** See Decided section.
2. ~~Mobile-first~~ — **decided: yes, build phone first.** See Decided section.
3. ~~Daily challenge mechanic~~ — **decided: three back-to-back 2h30 sprint rounds (10:30–13:00, 13:00–15:30, 15:30–18:00) + one long final round (18:00–24:00); one live puzzle at a time; Hörpuhopp continuous.** See Decided section.
4. ~~Display name on leaderboard~~ — **deferred.** Skátaþing is an adults-only event so we can show real names from Auth0 for the launch. The broader question (display-name / alias support across Slóði for when minors use the platform later) is real but **out of scope for this feature** — track separately.
5. ~~Sharing~~ — **decided: in MVP.** Client-side NYT-style emoji-grid copy-to-clipboard for Heiðursorðla and Tengingar. Icelandic copy.
6. ~~Language~~ — **decided: 100% Icelandic.** Game text, share strings, error messages, button labels, the lot.

### Content

7. ~~**Who owns curation?**~~ **Heiðursorðla curation = the user (Halldór).** Tengingar puzzles and Hörpuhopp theming still need an owner when those games ship; out of scope for the Saturday-only Heiðursorðla launch.
8. ~~How many puzzles do we need?~~ **Resolved**: **4 puzzles total** (Saturday only, four rounds). Two are locked: `hnýta` for Round 1 and `æskan` for Round 2. Rounds 3 & 4 (15:30–18:00 and 18:00–24:00) will be seeded by the user during Saturday morning. No buffer is needed because there's no extension scenario — the event is Saturday-only.
9. ~~**Heiðursorðla word list — discovery needed.**~~ **Resolved**: we sourced the valid-guess dictionary by brute-forcing the 32-letter Icelandic alphabet (32^5 ≈ 33.5M candidates) through the `islenska` Python package's DAWG-backed `Bin.contains()` check, then filtering hits to entries with `hluti='alm'` (general vocabulary, no person/place names), and NFC-normalizing the survivors. The resulting 24,930-word list is committed at `backend/app/data/icelandic_5_letter_words.txt`. The `islenska` package wraps BÍN (Beygingarlýsing íslensks nútímamáls), released under CC BY-SA 4.0 — legally clean. The runtime backend has no `islenska` dep; the regenerator script lives at `backend/scripts/generate_heidursordla_dictionary.py` with `islenska` in dev deps only.

### Technical

9. **Anti-cheat.** Client-submitted scores are trivially fakeable.
   - Heiðursorðla: server stores the answer, client submits guesses, server scores. Hard to cheat.
   - Tengingar: same — server validates the grouping.
   - Hörpuhopp: genuinely hard. Options: (a) accept it, this is a fun event not a tournament; (b) submit a replay/seed and validate server-side; (c) rate-limit + sanity-cap (no score above X plausible value). Recommend (a) + (c) for MVP.
10. **Rate limiting on score submission.** Already have `app/core` rate limiting infra — wire it up here.
11. **Bundle size.** Don't ship game code in the main bundle. Each game should be a code-split route under `app/skatathing/[game]/page.tsx` and lazy-load any canvas/engine deps.
12. **Stress test instrumentation.** If "stress test" is a goal, we need to know what we're measuring *before* the event: what RPS, what p95 latency, what error budget. Otherwise we just get a vibe. Worth checking what observability we have today (`backend/app/core/logging.py`, any APM?) and filling gaps now.
13. **Auth0 cost / rate limits.** Sudden burst of new signups — does our Auth0 plan handle it? Worth checking the tenant's monthly active user quota before we advertise the URL.
14. **Migration ordering.** New table → new Alembic revision via `make makemigration m="add game_scores table"`. Standard.

### Legal / privacy

15. ~~Minors~~ — **N/A for Skátaþing** (adults-only event). Flagged as a future concern for the broader Slóði platform when minors will use it; track separately, not in this feature.
16. **Data retention.** How long do we keep scores? Forever is probably fine; just be intentional.

### Operational

17. **Kill switch.** If something goes badly wrong during the event, can we disable score submission / hide the leaderboard without a redeploy? A feature flag or admin-toggleable setting would be cheap insurance.
18. **Analytics.** How will we measure success? "Drove traffic" needs a number — page views, signups, scores submitted, return visits. Vercel Analytics is already a dep; make sure events are wired.
19. **Graceful degradation.** If the backend is overloaded, the games themselves (Heiðursorðla/Tengingar client logic) can probably keep working with cached daily puzzles even if score submission fails. Worth designing for.

## Suggested MVP

If we have to cut, ship in this order:

1. **Heiðursorðla** (lowest effort, highest virality, server-side scoring is easy) — **this is the Phase 1 ship**
2. **Tengingar (Connections)** (similar effort, depends on content curation)
3. **Hörpuhopp (Doodle-Jump)** (most effort, most fun, ship if time allows)

Plus: header button, `/skatathing` landing page with game tiles + global leaderboard preview, login wall on play, score submission API, single `game_scores` table.

## Next steps

- [x] ~~Pick the actual launch target~~ — Saturday 11 April 2026, 10:30 Atlantic/Reykjavik (Phase 1 deadline at the top of this doc).
- [x] ~~Discovery spike: Árnastofnun word-list API~~ — resolved by going through the `islenska` package; see open question 9 for details.
- [x] ~~Name a content owner for Heiðursorðla answer list~~ — Halldór is curating Heiðursorðla. Tengingar/Hörpuhopp ownership is out of scope for the Saturday-only Heiðursorðla launch.
- [ ] Implement the Heiðursorðla end-to-end slice (login wall → mobile route → tables + service + router → seed Round 1 `hnýta` & Round 2 `æskan` → emoji-grid share). Spec lives in [`games/heidursordla.md`](./games/heidursordla.md).
- [ ] (Future, separate ticket) Display-name / alias support for Slóði broadly, for when minors use the platform.
