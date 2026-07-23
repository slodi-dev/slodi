# Design Spec — Arnór-Clicker

> Slóði design pipeline · Stage 1 output · consumed by design-handoff → design-implement
> Slug: `arnor-clicker` · Route: `/leikir/arnor-clicker` · Date: 2026-07-23

## 1. Overview

- **What it is:** an idle/incremental "clicker" where you **assist Arnór, the fundarstjóri, in running a Skátaþing**. Tap Arnór to move the assembly forward; recruit the parts of the þing to run themselves; buy upgrades; ride random bonuses; and each year *slíta þingi* to prestige.
- **Audience:** Icelandic scouts visiting the Slóði /leikir hub — a light, in-joke-laden game for short repeat sessions.
- **Single job of the screen:** keep the player tapping and buying, watching **fundarstig** climb, with something meaningful to do every 30–90 s.
- **Platforms:** desktop **and** mobile (distinct layouts).
- **Currency:** **fundarstig** (the in-game score, grows huge). **Leaderboard = total Þingstig ever earned** (the prestige points) — a small, slow-growing number that fits the backend cap natively; `fjöldi þinga` (prestige count) as tiebreaker.

## 2. Layout

**Frame:** fills `calc(100dvh - 60px)` below the sticky 60px header, `overflow: hidden`. Only the Fundarsköp/upgrade list scrolls (`overscroll-behavior: contain`). Use `dvh`.

**Breakpoints:** mobile `<768px` · tablet `768–1023px` · desktop `≥1024px`.

### Desktop (≥1024px) — play area + persistent right sidebar
```
┌───────────────────────── site header (60px, sticky) ─────────────────────────┐
├───────────────────────────────────────────────┬──────────────────────────────┤
│  fundarstig: 1,24 m.                           │  [ Fundarsköp | Uppfærslur |  │
│  +820/sek · smellur = 3,2 sek af vinnu         │    Þing ]      (tabs)         │
│                                                │  1 · 5 · 10 · 25 · 100 (buyqty)│
│                 ✨ (golden Arnór drifts)        │ ┌──────────────────────────┐ │
│                                                │ │ Þingfulltrúi   á 15       │ │
│                  ┌──────────┐                   │ │ á 0,1/sek  ·  á: 12       │ │
│                  │  ARNÓR   │  ← face, tap     │ ├──────────────────────────┤ │
│                  │  (face)  │    +N floats up   │ │ Kaffipása      á 100      │ │
│                  └──────────┘                   │ │ …                        │ │
│                                                │ └──────────────────────────┘ │
│  (feedback layer over play area)               │  (only this column scrolls)  │
└────────────────────────────────────────────────┴──────────────────────────────┘
```

### Mobile (<768px) — tap target in thumb zone + bottom-sheet
```
┌────── header (60px) ──────┐
│ fundarstig: 1,24 m.       │  ← readout pinned top
│ +820/sek                  │
│        ✨                  │
│      ┌────────┐            │
│      │ ARNÓR  │  ← lower-  │  tap target sits in the
│      │        │   center   │  natural thumb arc
│      └────────┘            │
│  +N feedback over target   │
├────────────────────────────┤
│ ╭ Fundarsköp ─ drag up ╮   │  ← bottom sheet: peeks,
│ [Fundarsköp][Uppf.][Þing]  │     drags up to shop;
│  1 · 5 · 10 · 25 · 100      │     tab bar inside
╰────────────────────────────╯
```
Tablet: single column with the panel as a toggleable/tabbed sheet.

## 3. Tokens

- **Accent:** **rekkar** patrol — `--sl-color-patrol-rekkar` (`177 58% 59%`), text-on-accent `--sl-color-patrol-rekkar-foreground` (`222 47% 11%`). This is the arnor-clicker card's identity color on the hub.
- **Affordable / CTA:** `--sl-color-primary` (green `142 50% 42%`).
- **Surface/text/border:** `--sl-color-surface`, `--sl-color-text-primary`/`-secondary`, `--sl-color-border`.
- **Radius/spacing:** `--sl-radius-card`, `--sl-radius-button`, `--sl-spacing-*`.
- **Golden Arnór:** warm gold, defined as a local token on the component (`--gold: 42 90% 55%`), distinct from both accent and semantic colors. Negative-type Arnór uses `--sl-color-warning`.
- Both themes: light ✅ / dark ✅.

## 4. Component inventory

| Component | Reuse? | Purpose | States |
|---|---|---|---|
| `ClickerGame` | new | client shell: state, tick loop, layout, persistence | loading·active |
| `ScoreBoard` | new | fundarstig total + rate readout, `aria-live` | idle·rolling |
| `ArnorFace` (tap target) | new | **Arnór's face, dead center** — the hero button; tap → sound + "+N", squash | default·pressed·reduced-motion |
| `OrbitField` | new | **magnitude-tier rings of worker icons around Arnór** (place-value odometer; inner=1 each, outer rings worth exponentially more) | grows as owned climbs; total-icon capped |
| `FeedbackLayer` | new | pooled floating "+N" + particles over the face | on/off (reduced-motion) |
| `FundarskopPanel` | new | responsive wrapper: sidebar (desktop) / bottom-sheet+tabs (mobile) | expanded·collapsed |
| `WorkerCard` | new | one Fundarsköp generator: name, owned, output, cost, buy | affordable·almost·unaffordable·maxed-milestone |
| `UpgradeCard` | new | one upgrade (click or worker boost) | affordable·unaffordable·owned |
| `BuyQuantityToggle` | new | buy **1 / 5 / 10 / 25 / 100** at a time | selected state |
| `GoldenArnor` | new | drifting **golden Arnór** (buff); tap → effect + callout | spawning·drifting·claimed·expiring |
| `RedArnor` | new | drifting **red Arnór** (debuff, optional); tap or ignore → temporary penalty | spawning·drifting·claimed·expiring |
| `ActiveBuffBar` | new | shows running buffs (Fundarhiti ×7 …) with countdown | empty·1..n buffs |
| `PrestigePanel` | new | *Slíta þingi*: shows Þingstig gain + permanent tree | locked·eligible·confirm |
| `OfflineModal` | new | "á meðan þú varst í burtu" collect screen | — |
| `Leaderboard` | reuse pattern from `components/leikir/horpuhopp/HorpuhoppLeaderboard` | top scores via `/api/leikir/arnor-clicker/scores` | empty·list·login·error |

### `ArnorFace` (tap target) — THE SIGNATURE
- **The whole screen centers on Arnór's face.** It is the hero and the only primary click target. Use **`arnor.png` directly — it *is* the face** — standing on its own at ~160–200px, **no disc, frame, ring, or backdrop behind it.** Sits in the middle of the play area (lower-center on mobile for thumb reach).
- Tap → grants `clickPower × multipliers` fundarstig, plays a **blipp**, and floats a **"+N"** up from the tap point with a squash-pop.
- **States:** default (gentle idle breathing to signal "tap me"); pressed (`scale(0.94)` spring-back); reduced-motion (no breathing, instant flash).
- **Ergonomics:** `touch-action: manipulation`, `user-select:none`, `-webkit-touch-callout:none`, `-webkit-tap-highlight-color:transparent`; drive off `pointerdown`; animate `transform`/`opacity` only.
- **Asset:** `arnor.png` is ready to use as-is (transparent, unframed). The orbit rings sit *around* it in empty space, not on any plate.

### `OrbitField` — the workforce as an orbiting odometer (the signature)
Bought workers **blend into concentric rings** around Arnór's face. Each **worker type keeps its own icon/emoji**; the rings are **magnitude tiers** (a place-value "abacus"), so you read your whole workforce at a glance and watch it grow.

**How a type's count maps to icons** — inner rings fill fast, each outer ring stands for many more workers:

| Ring | 1 icon = N of that worker | Behaviour |
|---|---|---|
| 1 (inner) | 1 | fills fast — a handful shown (~5) |
| 2 | 5 | |
| 3 | 10 | |
| 4 | 25 | |
| 5 | 100 | |
| 6, 7, 8 … | keeps climbing (~exponentially) | rarely, but never stops |

So ~5 of a worker on ring 1 "carry" into one icon on ring 2, and so on — like an abacus/odometer. Because each outer ring's per-icon value keeps climbing, **you keep earning fresh icons deep into the late-late game** (a ring-8 icon might be worth thousands of that worker). Exact **value + capacity per ring is tunable config** — the numbers above are a starting point to settle in playtest — and the ladder can run to **many rings**, growing exponentially, so late game always has a next icon to chase.

- **Blended, not segregated:** one ring can hold icons of several worker types at that magnitude; types are told apart by their icon. (Emoji-per-type is expected here — this is the *game* surface, distinct from the UI chrome.)
- **Bounded for performance:** the encoding is positional, so a million workers is a *handful* of icons, not a million. Keep a **hard total-icon cap (~60–80)** and shed the least-significant ring if needed — *explicitly so it never crashes a low-end phone.*
- **Motion:** each ring rotates slowly, alternating direction/speed — one `transform` on the ring container, never per-icon. **Reduced-motion → rings static.**
- On buying, the affected rings update, so growth is always visible.

### `WorkerCard`
- Shows: icon · **name** · owned count · **output/sec (its contribution)** · **cost**. Buy on click, quantity from `BuyQuantityToggle` (**1/5/10/25/100**); when a quantity >1 is selected the card shows the **aggregate cost + total output gain** for that batch.
- States: affordable (full color, primary border), almost (subtle warning tint), unaffordable (~60% opacity, disabled but still legible), milestone-just-hit (brief highlight).

## 5. Interaction & motion

| Trigger | Effect | Reduced-motion fallback |
|---|---|---|
| Tap Arnór's face | squash-pop + floating "+N" from tap point (~700ms ease-out translateY+opacity) + blipp | instant value + short color flash, no float, no sound unless unmuted |
| Buy worker | card pulse; total roll-up; **the orbit odometer updates** — icons fill the inner ring, carrying outward as counts cross each ring's threshold | instant update; icons appear without fly-in |
| Orbit rings | each ring rotates slowly, alternating direction/speed — **one `transform` per ring**, never per-icon | **rings static** |
| Buy upgrade | card pulse; total roll-up | instant number update |
| Golden / red Arnór spawn | fades/drifts across, gentle bob | appears statically, no bob |
| Buff / debuff active | `ActiveBuffBar` chip with shrinking timer | static chip with text countdown |
| Big gain | number roll-up on total | hard set |

Particles/floaters: **pooled DOM nodes**, `transform`/`opacity` only, cap ~50 mobile / ~200 desktop. All gated behind `prefers-reduced-motion: reduce` and an in-game motion toggle.

## 6. Audio — "blipp og blopp" (no bells, no files)

Web Audio API, **synthesized**. Muted-by-default toggle in a corner; also silenced under `prefers-reduced-motion`. Soft, addictive, low-fatigue.

| Event | Waveform | Pitch / variance | Envelope (a/d/s/r) | Notes |
|---|---|---|---|---|
| Click (blipp) | sine / triangle | base ~440–660 Hz, ±5–7% random per tap; tiny upward step on combo streak | 2ms / 40ms / 0 / 30ms | very short, low gain (~0.08); rounded, not percussive |
| Buy (blopp) | triangle | lower, ~220–330 Hz | 3ms / 90ms / 0 / 60ms | softer, "settled" confirmation |
| Golden Arnór claim | sine + slight detuned layer | rising two-note arpeggio | short | celebratory but gentle |
| Prestige | sine pad | soft chord swell | long release | rare, rewarding |

Rules: one shared `AudioContext` (resumed on first user gesture); reuse a small pool of oscillators/gain nodes; never let concurrent taps stack into clipping (cap gain, quick release). Keep it *soft* — the loop should be pleasant at 5 taps/sec.

## 7. Copy (Icelandic — real strings, sentence case)

| Key | String |
|---|---|
| currency | fundarstig |
| rate | +{n}/sek |
| click hint | Smelltu á Arnór til að afgreiða málin |
| tab: workers | Fundarsköp |
| tab: upgrades | Uppfærslur |
| tab: prestige | Þing |
| buy qty | 1 · 5 · 10 · 25 · 100 |
| worker cost | á {cost} |
| worker output | {n}/sek |
| golden claim (frenzy) | Fundarhiti! ×7 í smá stund |
| golden claim (lucky) | Heppin tillaga samþykkt! |
| golden claim (risk) | Málþóf … fundurinn tefst |
| prestige CTA | Slíta þingi og boða til nýs |
| prestige gain | Þú færð {n} Þingstig (+{p}% varanlega) |
| offline modal | Á meðan þú varst í burtu afgreiddi þingið {n} fundarstig |
| leaderboard empty | Engar færslur enn |
| score error | Villa við að vista stig |
| login prompt | Skráðu þig inn til að vista stig |

## 8. Data & i18n

- **Score:** stored as a float; **format on display only** with Icelandic **long scale** (`references/icelandic-numbers.md`): `þ. / m. / ma. / bilj.` then scientific `1,24·10¹⁸`. Decimal **comma**, 3 sig figs, `tabular-nums`, stable width. Remember **billjón = 10¹²**, not 10⁹.
- **Persistence:** full game state in `localStorage` (client-only). The real lifetime score lives client-side and drives the player's own readout.
- **Leaderboard score = total Þingstig (no encoding, no backend change):** `game_scores.score` is an integer capped at `999_999`, and the real fundarstig total dwarfs that. So we **don't submit fundarstig at all** — we submit **accumulated Þingstig** (the prestige points). Because Þingstig grow as `√(lifetime)` (§9), they stay small: even an absurd lifetime of `~10^24` fundarstig yields only ~`10^6` Þingstig, so with sane `K`/`SCALE` a player never approaches the cap (clamp as a final safety net).
  - Submit **total Þingstig ever earned** (lifetime, not current spendable balance) so the value only ever climbs — the backend's keep-max and DESC ordering stay correct, and it survives a prestige reset.
  - Stored and displayed **literally** — no encode/decode. The board reads as a plain, meaningful "how far they've gotten" number (e.g. `342 Þingstig`), tiebroken by `fjöldi þinga`.
  - Trade-off to note: a player who hasn't prestiged yet sits at `0` on the board until their first *slit þing*. Acceptable — the board rewards real progression. (The player's own big fundarstig total still shows in their readout, just not on the shared board.)
- **Offline earnings:** on load, credit `productionPerSec × min(secondsAway, CAP) × 0.5`, `CAP = 8h`; show `OfflineModal`.

## 9. Economy (starting numbers — tune later)

**Click:** base 1 fundarstig; relevant ~first 60 s only.

**Fundarsköp ladder** — the workers are the *things that happen at a þing*: some people, some moments, all comically churning out afgreidd mál. Proposed ordered ladder (`cost(n) = base · growth^owned`, bulk-buy closed-form; numbers are starting points to tune):

| # | Fundarskap | What it is | Base cost | Base out/sec | Growth |
|---|---|---|---|---|---|
| 1 | Þingfulltrúi | a delegate casting votes | 15 | 0.1 | 1.15 |
| 2 | Kaffipása | the hall refuels | 100 | 1 | 1.15 |
| 3 | Umræðuhópar | breakout discussion groups | 1,100 | 8 | 1.15 |
| 4 | Rifrildi í pontu | a good podium row | 12,000 | 47 | 1.14 |
| 5 | Langar umræður um fjármál | the endless budget debate | 130,000 | 260 | 1.13 |
| 6 | Allsherjarnefnd | general committee resolves it | 1,400,000 | 1,400 | 1.12 |
| 7 | Önnur mál | "any other business" that never ends | 20,000,000 | 7,800 | 1.11 |
| 8 | Skátahöfðingi | the Chief Scout closes the þing | 260,000,000 | 44,000 | 1.10 |

Unlock each when you can nearly afford it (own 1× the previous tier, then lifetime thresholds for the top tiers). **Candidate pool to swap/extend freely:** Fundarritari, Kjörbréfanefnd, Stjórn BÍS, Grunngildanefnd, atkvæðagreiðsla, nestistími.

**Milestones:** each worker ×2 at 10/25/50/100/150/200 owned. **Achievements:** small global bonuses (e.g. +1% each). Keep a purchase/reward ≤ ~90 s apart early game.

**Prestige:** unlock ~lifetime ≥ 1e12 (≈1–3h). `Þingstig = floor(K·√(lifetime/SCALE))`, each **+2%** global, spent in a small permanent tree (offline cap/rate, click power, cheaper Fundarsköp). Tune `K`/`SCALE` so first reset grants ~5–20.

## 10. Golden & red Arnórs

A small Arnór drifts across the play area every **~3–6 min** (randomized, one at a time), lifetime ~8–13 s, fades if not tapped. **Golden Arnórs = buffs; red Arnórs = debuffs.** Red ones are visually distinct (red, wobblier) so the player can choose to tap them for the effect or let them pass. Effects stack into `ActiveBuffBar` with countdowns.

**Golden Arnórs (buffs):**

| Type | Name | Effect | Duration | Rarity |
|---|---|---|---|---|
| Frenzy | **Fundarhiti** | all fundarstig ×7 | 10 s | common |
| Lucky | **Heppin tillaga** | instant lump = min(15% of bank, ~15 min production) | instant | common |
| Click frenzy | **Lófaklapp** | click power ×777 | 8 s | uncommon |
| Worker rush | **Fundargleði** | Fundarsköp output ×3 | 15 s | uncommon |
| Jackpot | **Stórtillaga** | ×7 **and** a lump sum | 10 s | very rare |

**Red Arnórs (debuffs — optional, gentle):**

| Type | Name | Effect | Duration | Rarity |
|---|---|---|---|---|
| Stall | **Málþóf** | production ×0.5 (meeting drags on) | 12 s | rare |
| Recess | **Kaffi búið** | Fundarsköp paused briefly | 8 s | rare |

Debuffs are kept mild and skippable so the game never feels punishing — they add texture, not frustration.

## 11. Accessibility

- Primary tap target ≥120px; all buttons ≥48px.
- Real `<button>`s; visible focus ring; `Space`/`Enter` to tap and to buy; tab order through cards. Keyboard-only play viable.
- `aria-live="polite"` on the fundarstig total (throttled so it doesn't spam).
- Contrast AA+ in both themes, including dimmed "unaffordable" states.
- `prefers-reduced-motion` honored everywhere; audio muted by default with a clear toggle.

## 12. Acceptance criteria

- [ ] Fills `100dvh - 60px`, no page scroll; only the panel scrolls; works desktop + mobile.
- [ ] Tap grants points with float + squash + blipp; rapid tapping is smooth (no reflow, no audio clipping, no zoom).
- [ ] 7 Fundarsköp generators buyable in batches of 1/5/10/25/100 with correct aggregate costs; milestones apply.
- [ ] Upgrades boost clicks and workers; affordability states correct.
- [ ] ≥5 golden Arnór types spawn with correct effects + `ActiveBuffBar` countdowns.
- [ ] Offline earnings + collect modal; prestige loop with Þingstig multiplier.
- [ ] Numbers use Icelandic long-scale formatting; lifetime score submits to leaderboard.
- [ ] Both themes, full a11y floor, reduced-motion + mute respected.

## 13. Open questions

- **Backend score cap — RESOLVED:** leaderboard score = **total Þingstig (prestige points)**, which grows as `√(lifetime)` and so stays well under `999 999` — submitted and displayed literally, no encoding, no backend change. See §8.
- Exact `K`/`SCALE` for prestige and final growth-rate tuning — playtest.
- Abbreviation set for long-scale suffixes — confirm with team.

## 14. Leaderboard integrity (anti-cheat) — accepted posture

The score is computed client-side and POSTed, so a determined user **can** submit a
forged score from the browser console. This is inherent to any client-scored game
and cannot be fully prevented without the server simulating the economy
(out of scope). We accept this for an internal scout leaderboard, backed by the
existing server-side guardrails, which are the appropriate bar here:

- **Auth required** — only logged-in users can submit (`get_current_user`).
- **Bounds** — score clamped to `1…999_999` server-side (`GameScoreCreate`).
- **Rate-limited** — 10 submissions / 60s / user.
- **Keep-max upsert** — a lower score never overwrites a higher one, so nobody
  can lower another player's (or their own) standing.

Because the Þingstig cap is reachable by design (~tier 17, §9), the board reads
more as "who finished" than a tight ranking, which further lowers the stakes of a
forged max. If that changes, revisit with server-side sanity heuristics (cap by
elapsed time / account age, reject impossible jumps) before full server authority.
