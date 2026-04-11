# Heiðursorðla

A portmanteau of **heiðursorða** ("word of honor" — the scout-promise concept) and **Orðla** (Icelandic Wordle: [orðla.is](https://ordla.is)). Renamed from "Skátdl" — see commit history if you're hunting for the old name.

Status: in build. **Phase 1 deadline: Saturday 11 April 2026, morning** — first puzzle must be playable when foringjar wake up. The full feature set ships in phases through Saturday and beyond; see [Phased delivery](#phased-delivery) at the bottom of this doc.

See [`../README.md`](../README.md) for the broader Skátaþing event context (login wall, mobile-first, four-challenges-per-day cadence, locked decisions).

## Aim of the game

Heiðursorðla is an Icelandic-language Wordle clone themed around the scout movement. The player is shown an empty grid and must guess a hidden 5-letter Icelandic word in up to 6 tries. Each guess colors the letters to give feedback (right letter in the right place, right letter in the wrong place, not in the word at all), and the player narrows in on the answer until they either solve it or run out of attempts.

Where it diverges from generic Wordle:

- All UI and content is in **Icelandic**, including the virtual keyboard (with `Þ Æ Ö Á É Í Ó Ú Ý Ð` as their own keys).
- The curated **answer list** is drawn from scout vocabulary — knots, ranks, gear, places, traditions, programs, songs — anything that resonates with foringjar.
- The **valid-guess dictionary** is a flat text file of all 5-letter Icelandic words, shipped with the backend image (see [Word list](#word-list) below).
- It runs as part of the Skátaþing event with a **front-loaded staggered cadence**: four puzzles per event day, weighted toward the daytime. Three back-to-back 2h30 sprint rounds run between 10:30 and 18:00 (10:30–13:00, 13:00–15:30, 15:30–18:00) and one long final round fills 18:00 → midnight (6h). At most one puzzle is live at any moment; when a round rolls over the previous puzzle locks and a new word takes its place. Each puzzle has its own independent score and leaderboard — there is no carry-over between rounds. Words are pre-curated and assigned to specific round windows ahead of time; the `heidursordla_puzzles` table is the schedule.
- Wordle's emoji-grid share string is in scope.
- A live H:m:s countdown to the next puzzle drop, including for not-yet-unlocked puzzles where the wait *is* the page.
- The **top-10 leaderboard shows each player's emoji grid** alongside their score, so you can see at a glance *how* they played, not just *that* they won.

### Win / loss

- **Win:** guess the answer within 6 attempts.
- **Loss:** run out of attempts without guessing it. The answer is then revealed.

### Scoring & leaderboard

- Lower is better. **Score = number of guesses used to solve.** A perfect score is 1; a typical good score is 3–4; the maximum solvable score is 6.
- Loss does not earn a leaderboard position for that puzzle.

**Leaderboard view: top 10**, with each entry showing:

- Rank (1–10)
- Player display name
- Final score (number of guesses used)
- **The player's emoji grid** — the same 🟩🟨⬛ representation used in the share string, so you can scan the leaderboard and see at a glance who walked into a lucky 1-shot vs. who clawed it back from a near-loss in 6.

**Sort order:**

1. **Primary:** fewest guesses first (ASC by `guesses_used`).
2. **Tiebreaker:** earliest finisher first (ASC by `finished_at`). If two players both solve in 3 guesses, whoever submitted their winning guess first ranks higher.

This means the leaderboard is partly a race — early Saturday-morning solvers get a shot at the top of the board even if a later player matches their guess count.

**What we deliberately don't show:** the actual letter content of past guesses. Only the color tiles. Same convention as Wordle's share string.

## Word list

A flat text file shipped inside the backend image, containing all 5-letter Icelandic words, one per line, NFC-normalized, lowercased. The file is **already committed** at `backend/app/data/icelandic_5_letter_words.txt` — **24,930 words**, generated from BÍN via the `islenska` package (CC BY-SA 4.0). The runtime backend has no `islenska` dep; only `backend/scripts/generate_heidursordla_dictionary.py` does, in the dev dependency group. No external HTTP calls at runtime, no DB table for words.

- **Path:** `backend/app/data/icelandic_5_letter_words.txt` (proposal — adjust if there's a more idiomatic location in the repo).
- **Format:** one word per line, UTF-8, NFC-normalized, lowercase, trimmed. Blank lines and lines starting with `#` are ignored on load.
- **Loading:** read once at process startup in `app/services/heidursordla.py` into a module-level `frozenset[str]`. Cost: a few hundred KB of RAM, microsecond lookup. No DB hit per guess.
- **Validation at load:** assert all entries are exactly 5 characters long after normalization; log and skip anything that isn't, so a malformed line doesn't crash the worker.
- **Curated answer list** (the secret words the puzzles use) is **not** the dictionary — that lives in `heidursordla_puzzles.answer`, curated separately by a scout content owner. The dictionary is what we accept as a valid *guess*; the answer list is what we use as a valid *puzzle answer*.

## Rules

| Thing                 | Decided | Notes |
|-----------------------|---------|-------|
| Word length           | **5 letters** | Locked. No 6-letter variant for the event. |
| Max guesses           | **6** | Standard. |
| Special letters       | **Distinct keys** — `Þ Æ Ö Á É Í Ó Ú Ý Ð` are their own letters, not aliases of A/E/I/O/U/D | Icelandic linguistic convention. |
| Hard mode             | **No** | Out of scope. |
| Replay                | **No** | One attempt per user per puzzle, server-enforced. |
| Daily reset           | Per the README cadence — puzzles unlock in the morning, lock at midnight Iceland time. |

## Implementation

### Frontend

**Routes (under `frontend/app/skatathing/heidursordla/`):**

- `page.tsx` — index for today's puzzles. Shows tiles for all four of today's rounds (three sprint rounds + one long final round) with status badges (**upcoming** / **live now** / **finished – view answer**) and a single H:m:s countdown to the next round boundary. At most one tile is "live now". The currently-live puzzle's leaderboard is featured prominently; finished puzzles' leaderboards are accessible behind their tile. If no puzzle is currently live (off-hours, 00:00–10:30) the page renders only the countdown to the next 10:30 drop.
- `[puzzleId]/page.tsx` — single-puzzle play view. If the puzzle's `unlocks_at` is in the future, this page renders only the `NextPuzzleCountdown` component centered, no grid, no keyboard.

**Layout (mobile-first, 375px portrait, single-puzzle play view):**

```
┌─────────────────────┐
│  ←  Heiðursorðla #12 │  ← title bar with back button + puzzle number
├─────────────────────┤
│   ⬜ ⬜ ⬜ ⬜ ⬜      │
│   ⬜ ⬜ ⬜ ⬜ ⬜      │
│   ⬜ ⬜ ⬜ ⬜ ⬜      │  ← 6×5 guess grid
│   ⬜ ⬜ ⬜ ⬜ ⬜      │
│   ⬜ ⬜ ⬜ ⬜ ⬜      │
│   ⬜ ⬜ ⬜ ⬜ ⬜      │
├─────────────────────┤
│  [ Q  W  E  R  T … ] │
│  [ Á  É  Í  Ó  Ú … ] │  ← virtual Icelandic keyboard, 3–4 rows
│  [ Þ  Æ  Ö  Ð  ↵ ⌫ ] │
└─────────────────────┘
```

**Locked-puzzle layout (when `now < unlocks_at`):**

```
┌─────────────────────┐
│  ←  Heiðursorðla     │
├─────────────────────┤
│                     │
│                     │
│   Næsta þraut       │
│   opnast eftir       │
│                     │
│      04:32:11       │
│                     │
│                     │
└─────────────────────┘
```

When the countdown reaches zero, the page refetches `/today` (or the specific puzzle endpoint) and renders the play view.

**Components** (under `frontend/components/skatathing/heidursordla/`):

- `HeidursordlaGrid.tsx` — the 6×5 guess grid (used both for the active play view and, in a smaller form, in leaderboard rows). Supports a `shake` prop that triggers a CSS shake animation on the active row when an invalid guess is submitted.
- `HeidursordlaKeyboard.tsx` — virtual Icelandic keyboard with per-key color state derived from completed guesses.
- `HeidursordlaShareButton.tsx` — builds the emoji-grid string and copies via `navigator.clipboard.writeText()`.
- `HeidursordlaGameOver.tsx` — final-state overlay; shows the answer (on loss), the score, share button, and the countdown to the next puzzle drop.
- `HeidursordlaLeaderboard.tsx` — top-10 list. Each row renders rank, display name, score, and a compact emoji-grid of the player's guesses (reuses `HeidursordlaGrid` in a small/read-only mode).
- `HeidursordlaToast.tsx` — small Icelandic toast for transient messages ("Ekki í orðabók", "Of stutt orð", "Afritað í minnið!"). Auto-dismisses after ~2s.
- `NextPuzzleCountdown.tsx` — reusable H:m:s countdown component (see below).

#### Invalid-guess error states (MVP, not v2)

When a player tries to submit a word that the server rejects (not in dictionary, wrong length, etc.):

- The active row of `HeidursordlaGrid` triggers a CSS shake animation (~400ms).
- A `HeidursordlaToast` shows an Icelandic message based on the failure reason: `"Ekki í orðabók"` (not in dictionary), `"Of stutt orð"` (too short), `"Of langt orð"` (too long). Auto-dismisses.
- The guess is **not** consumed — the row remains editable, the player can fix the word and try again.
- The keyboard does not change color state (since the guess never registered).

This is non-negotiable for v1. Without it the game feels broken to anyone who tries an unusual word.

#### Physical keyboard support

A `keydown` listener on the play view captures:

- `a–z` and Icelandic letters (`á é í ó ú ý þ æ ö ð`) → append to current guess if length < 5
- `Backspace` → remove last letter
- `Enter` → submit current guess

The virtual keyboard remains the primary input on phones; the physical listener is additive. Cleaned up on unmount. Disabled when an overlay (game-over, locked-puzzle) is shown.

#### `NextPuzzleCountdown` component

- Props: `targetIso: string` (the next unlock timestamp from the backend), `label?: string` (default `"Næsta þraut eftir"`), `onExpire?: () => void`.
- Behavior: ticks every 1s on a `setInterval`, formats as `H:m:s` (e.g. `04:32:11`).
- When the countdown hits zero, calls `onExpire` so the parent can refetch.
- Cleans up the interval on unmount.
- Used in:
  1. Heiðursorðla index page header.
  2. Game-over overlay.
  3. Locked-puzzle page (the wait *is* the page).
  4. Skátaþing landing page (`/skatathing`) — shared, used by other games' index views too.

#### State (per puzzle)

- React local state for the in-progress guess.
- React local state for the list of completed guesses + their colors (returned by the server on each guess).
- React local state for the active toast / shake trigger.
- `localStorage` persistence keyed by `heidursordla:{puzzleId}:{userId}` so a refresh mid-puzzle doesn't lose progress. Cleared on terminal status.

**Service module:** `frontend/services/heidursordla.service.ts`, wrapping the backend endpoints below. Called via `fetchWithAuth` from `lib/api.ts`.

**Share string** (built client-side, copied via `navigator.clipboard.writeText()`):

```
Heiðursorðla #12 — 4/6
🟩⬛⬛🟨⬛
🟨🟩⬛⬛⬛
🟩🟩🟩⬛🟨
🟩🟩🟩🟩🟩

slodi.is/skatathing
```

Show an Icelandic toast on success ("Afritað í minnið!"). Fall back to a hidden `<textarea>` + `select()` + `document.execCommand('copy')` on browsers without Clipboard API.

### Backend

**New router:** `backend/app/routers/heidursordla.py`, mounted at `/skatathing/heidursordla`.

**New service:** `backend/app/services/heidursordla.py` — owns puzzle lookup, guess validation, color computation, attempt-state transitions, and score recording. **Owns the in-memory dictionary** loaded from the static word file at startup.

**New repository:** `backend/app/repositories/heidursordla.py` — only layer that touches the SQLAlchemy session for heidursordla tables, per the project's layered architecture (see `CLAUDE.md`).

#### Data model (Alembic migration)

Two new tables, plus reuse of the cross-game `game_scores` table sketched in the README.

```
heidursordla_puzzles
  id            uuid pk
  puzzle_number int unique          -- human-readable number for share string ("Heiðursorðla #12")
  answer        varchar(8)          -- the secret word, lowercase, NFC-normalized at write time
  word_length   int                 -- 5; stored per-puzzle for forward compatibility
  unlocks_at    timestamptz         -- when the puzzle becomes playable
  locks_at      timestamptz         -- midnight Iceland of the same event day
  created_at    timestamptz

heidursordla_attempts
  id            uuid pk
  user_id       uuid fk → users.id
  puzzle_id     uuid fk → heidursordla_puzzles.id
  guesses       jsonb               -- list of {word, colors}; the colors are what powers the leaderboard emoji grid
  status        enum('in_progress','won','lost')
  started_at    timestamptz         -- set on first guess
  finished_at   timestamptz null    -- set on terminal status; powers the leaderboard tiebreaker
  unique (user_id, puzzle_id)       -- one attempt per user per puzzle
```

The valid-guess dictionary is **not in the database** — see [Word list](#word-list).

Score writes go to the existing cross-game `game_scores` table with `game = 'heidursordla'`, `score = guesses_used` (1–6), and `metadata = {puzzle_id, solve_seconds}`. Losses are not written to `game_scores` — they live only in `heidursordla_attempts.status='lost'`.

#### NFC normalization (critical)

Icelandic letters with diacritics — `á é í ó ú ý þ æ ö ð` — can be encoded in Unicode in two ways:

- **NFC:** a single composed codepoint (e.g. `á` = U+00E1)
- **NFD:** a base letter plus a combining mark (e.g. `á` = U+0061 + U+0301)

A naïve dictionary lookup will fail when these don't match. The backend service normalizes everywhere it touches a word:

- **At dictionary load:** every line of the word file is run through `unicodedata.normalize("NFC", line.strip().lower())` before being added to the `frozenset`.
- **At puzzle creation / migration:** every `answer` is NFC-normalized before being written to `heidursordla_puzzles.answer`.
- **At guess submission:** the `POST /{puzzle_id}/guess` handler runs `unicodedata.normalize("NFC", body.word.strip().lower())` *first*, before any length check, dictionary lookup, or color comparison.

If we miss any one of these, a player whose phone keyboard happens to send NFD (some iOS keyboards do, especially with auto-correct) will see all their guesses bounce as "Ekki í orðabók" and have no idea why. This is the kind of bug that wastes the entire event.

#### API surface

All endpoints require auth (Auth0 JWT, via the standard `get_current_user` dep). All errors are returned in Icelandic.

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/skatathing/heidursordla/today` | Today's available puzzles for *this user*: `[{id, puzzle_number, word_length, status, unlocks_at, locks_at}]`. Includes `next_unlock_at` for the countdown. Never returns answers. |
| `GET`  | `/skatathing/heidursordla/{puzzle_id}` | Puzzle metadata + this user's attempt state (existing guesses with colors, status). Used on page load to restore in-progress games. Returns `{..., is_unlocked: false, unlocks_at: "..."}` if the puzzle is not yet playable, so the frontend knows to render the locked-countdown view. |
| `POST` | `/skatathing/heidursordla/{puzzle_id}/guess` | Submit one guess. Body: `{"word": "skáti"}`. Returns: `{colors, status, guesses_used, answer: null \| "skáti"}` on success. **Error responses** are HTTP 400 with a typed `error_code` field so the frontend can pick the right toast: `not_in_dictionary` / `wrong_length` / `puzzle_locked` / `attempt_finished`. |
| `GET`  | `/skatathing/heidursordla/leaderboard?puzzle_id={id}&limit=10` | Top 10 by `(guesses_used ASC, finished_at ASC)`. **Returns the per-row color grid so the frontend can render emoji grids.** Cached ~30s. See response shape below. |

**Guess error response shape (HTTP 400):**

```jsonc
{
  "error_code": "not_in_dictionary",  // or "wrong_length" | "puzzle_locked" | "attempt_finished"
  "detail": "Ekki í orðabók"          // pre-translated Icelandic, can go straight into the toast
}
```

**Leaderboard response shape:**

```jsonc
{
  "puzzle_id": "…",
  "puzzle_number": 12,
  "word_length": 5,
  "entries": [
    {
      "rank": 1,
      "display_name": "Halldór",
      "guesses_used": 3,
      "finished_at": "2026-04-11T08:14:22+00:00",
      "guess_colors": [
        ["correct", "absent", "absent", "present", "absent"],
        ["present", "correct", "absent", "absent", "absent"],
        ["correct", "correct", "correct", "correct", "correct"]
      ]
    }
    // … 9 more
  ]
}
```

The frontend turns each `guess_colors` row into a row of emoji tiles. **No guess words, no answers.**

#### Server-side state & anti-cheat

- The answer is **never** sent to the client until the game is over (and only to the player who finished it — the leaderboard never includes the answer).
- The dictionary lives server-side. Guess validation is server-side. The client cannot submit a non-word.
- Color computation is server-side. The client is a renderer.
- One attempt per user per puzzle, enforced by `unique (user_id, puzzle_id)` in `heidursordla_attempts`.
- Rate-limit `POST .../guess` to ~30/min per user via `app/core` rate-limiting infra.
- The leaderboard endpoint only returns entries where `status='won'` — losers never appear, in-progress players never appear.

### Caching

- `GET .../today`, `GET .../{puzzle_id}` — **not cached** (per-user state).
- Word dictionary — loaded once at process start into a `frozenset[str]`, no per-request DB hit.
- `GET .../leaderboard` — `aiocache` TTL 30s. Public, hot, the most-trafficked endpoint of the event.

## Phased delivery

The full spec above is the destination. We **do not cut features** — we phase them. Phase 1 must be live and playable Saturday morning; everything after that ships during Saturday or shortly after.

### Phase 1 — Saturday 11 April, morning launch (the deadline)

The minimum playable Heiðursorðla, on a phone, behind login.

- [x] **Word list file** committed at `backend/app/data/icelandic_5_letter_words.txt` (24,930 NFC-normalized 5-letter Icelandic words, generated from BÍN via the islenska package — see `backend/scripts/generate_heidursordla_dictionary.py`).
- [ ] Hard login wall on `/skatathing` (Auth0 middleware path config).
- [ ] Header button on the landing page → `/skatathing`.
- [ ] Routes: `/skatathing/heidursordla` (today's index) and `/skatathing/heidursordla/[puzzleId]` (play view).
- [ ] Frontend components: `HeidursordlaGrid` (with shake animation), `HeidursordlaKeyboard`, `HeidursordlaToast`, minimal `HeidursordlaGameOver`. Mobile-first 375px portrait layout, tested on a real phone.
- [ ] Physical-keyboard `keydown` listener on the play view.
- [ ] Invalid-guess UX: shake + toast with the right Icelandic message based on `error_code`.
- [ ] `NextPuzzleCountdown` component, shown on the index, the game-over overlay, and the locked-puzzle view.
- [ ] Locked-puzzle UX: if `unlocks_at > now`, render only the countdown; refetch on expire.
- [ ] Backend: `heidursordla_puzzles` + `heidursordla_attempts` tables, single Alembic migration.
- [ ] Backend service: dictionary load at startup (with NFC normalization), service module that exposes guess validation, color computation, attempt state transitions.
- [ ] Backend endpoints: `GET /today`, `GET /{puzzle_id}`, `POST /{puzzle_id}/guess`. NFC-normalize incoming guesses. Server-side guess validation, color computation, one-attempt-per-user, rate limiting. Typed `error_code` on guess failures.
- [ ] **Seed Saturday's first two rounds** as `heidursordla_puzzles` rows: **`hnýta`** for Round 1 (`unlocks_at = 2026-04-11 10:30 Atlantic/Reykjavik`, `locks_at = 13:00`), **`æskan`** for Round 2 (`13:00 → 15:30`). Rounds 3 & 4 will be seeded by the user later in the day before their windows open.
- [ ] **`/today` endpoint returns the currently-live puzzle** (the row whose `unlocks_at ≤ now < locks_at`) plus the timestamp of the next round boundary for the countdown. With both rounds seeded ahead of time, the frontend rolls over from hnýta → æskan automatically at 13:00 with no redeploy.
- [ ] **Event-ended (closed/archive) state.** Hardcode `EVENT_END = 2026-04-12T00:00 Atlantic/Reykjavik` (Saturday midnight, Sunday 00:00) in the backend service. After that timestamp: `/today` returns `{event_ended: true, leaderboards: [...]}` with all four Saturday rounds' final top-10s; `/{puzzle_id}/guess` returns HTTP 410 Gone. Frontend renders a "Skátaþingsorðlu er lokið" view with the four locked leaderboards, the four answers revealed, and a thank-you message — no countdown, no play view, no redirect.
- [ ] Score recording into `game_scores` (write path; read path / leaderboard UI lands in Phase 2).

### Phase 2 — Saturday daytime (during the event)

Round out Heiðursorðla into the full feature set.

- [ ] **Top-10 leaderboard endpoint** with the per-row `guess_colors` payload defined above.
- [ ] **`HeidursordlaLeaderboard` component** on the index page, rendering each row's emoji grid alongside name + score. Sort by `(guesses_used ASC, finished_at ASC)`, displayed with Icelandic labels.
- [ ] Emoji-grid clipboard share (`HeidursordlaShareButton`). Icelandic toast on success.
- [ ] Multi-puzzle support: the four-challenges-per-day cadence. Index page lists multiple puzzles with status badges; tapping one opens the play view.
- [ ] Additional curated puzzles for Saturday's later batches.
- [ ] In-progress restore via `localStorage` + `GET /{puzzle_id}` rehydrate.
- [ ] Game-over overlay polish (animations, final-grid reveal, share-button placement).

### Phase 3 — post-event (week after Skátaþing)

- [ ] Tengingar (see [`tengingar.md`](./tengingar.md)).
- [ ] Daily cadence automation (puzzles unlocked/locked by `unlocks_at`/`locks_at` columns rather than hardcoded today's puzzle).
- [ ] Per-day leaderboard slicing wired into the UI.

### Phase 4 — later

- [ ] Hörpuhopp (see [`horpuhopp.md`](./horpuhopp.md)).
- [ ] Display-name / alias system across Slóði (separate ticket; needed before minors use the platform).
- [ ] Hard mode, cross-day streak counters, per-troop leaderboards, Web Share API.

### Acceptance bar for Phase 1

> A logged-in foringi opens slodi.is on their phone, sees a "Skátaþing" button in the header, taps through to Heiðursorðla, taps letters on a working Icelandic keyboard (or types on a physical keyboard if they're on a tablet), submits guesses, sees colors, gets a friendly Icelandic shake-and-toast if they typed a non-word, wins or loses, and feels like they played a Wordle. Their result is recorded server-side. They cannot replay. They cannot see the answer in the bundle. They see a countdown to the next puzzle. If they hit the page before it unlocks, they see the countdown instead of the grid.

## Open questions / decisions needed

1. **Curated answer list — owner: the user (Halldór).** Saturday Round 1 = **`hnýta`** (10:30–13:00) and Saturday Round 2 = **`æskan`** (13:00–15:30) are locked. Saturday Rounds 3 & 4 (15:30–18:00 and 18:00–24:00) are TBD; the user will seed them during Saturday morning as `heidursordla_puzzles` rows ahead of each window. **Total volume = 4 puzzles** (Saturday-only event — Sunday is out of scope; the app goes into closed/archive mode at Saturday midnight).
2. ~~**Daily challenge ordering** — free-pick or sequential unlock?~~ **Resolved by the staggered cadence**: only one puzzle is ever live at a time, so there's nothing to gate. Finished puzzles remain viewable in read-only mode (answer revealed + per-puzzle leaderboard) for the rest of the day — confirm this is desired.
3. **Lost-puzzle reveal** — show the answer on a loss? Yes by default.
4. **Keyboard layout** — Icelandic QWERTY with diacritics on dedicated keys (~32 keys) vs. a tighter custom layout. Visual mock needed.
5. **Leaderboard scope** — one leaderboard per puzzle (current design), or aggregated across all of Saturday's puzzles? Current default: per-puzzle. An aggregated view can come in Phase 3.
