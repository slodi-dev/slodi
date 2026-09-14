# Design Spec — Efnissíðan (`/programs/[id]`)

**Status:** draft for claude.ai/design · **Author:** Halldór + Claude · **Date:** 2026-09-12 **Route:** `/programs/[id]` · **Slug:** `efnissida`

---

## 1. Overview

**What it is.** The page a leader lands on when they open one item out of Dagskrárbankinn.

**Who it's for.** A foringi deciding *"can I run this at Thursday's fundur?"* — and, second, the author or a moderator who needs to change or remove it.

**The single job.** Answer "what is this, and can I run it?" above the fold, on a phone, without opening anything.

### Why it is being reshaped

The page was built when the bank held only Dagskrár, and four things now break:

1. **It speaks only Dagskrá.** The bank files Verkefni, Viðburður and Dagskrá, but the hero says „Breyta dagskrá", „Deila dagskrá" and the overview tab says „Um dagskrána" — on a Verkefni, all three are simply wrong. The breadcrumb says „Dagskrárbanki" while the item is a Verkefni.
2. **Nothing says which kind it is.** There is no badge anywhere. The reader cannot tell a single leikur from a collection.
3. **An item with no image gets a huge empty hero.** The title currently starts ~460 px down a 784 px viewport. Most submissions have no image, so this is the common case, not the edge case.
4. **Two back affordances.** A breadcrumb at the top and „← Til baka í dagskrárlista" at the bottom, which is also the only one that is not a link.

---

## 2. Layout

Three layouts, matching `useLayoutMode` already in the codebase (`wide` ≥1080, `half` ≥620, else `phone`) so the page and the create modal agree on breakpoints.

The page scrolls normally — it is not a `100dvh` view. The sticky 60 px header stays.

### Desktop / `wide` ≥1080 (ASCII wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Heim / Dagskrárbankinn / Kaðlabrautin                                │  breadcrumb
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │  [ media band 16:9, max-height 320px — ONLY if image exists ]  │   │
│ └────────────────────────────────────────────────────────────────┘   │
│ ▌ [Verkefni]  Kaðlabrautin                  ♡ 0  Deila  Bæta við    │  hero
│ ▌ eftir Halldór Valberg · 12. september 2026        Breyta  ⋯       │
├───────────────────────────────────────────┬──────────────────────────┤
│ Yfirlit │ Leiðbeiningar │ Búnaður │ Ath.2 │  STUTTAR UPPLÝSINGAR     │
│ ─────────                                 │  ⏱ Lengd    30–45 mín    │
│                                           │  ⏱ Undirb.  15 mín       │
│  Um verkefnið                              │  👥 Aldur   [F][D]       │
│  Flokkarnir leggja kaðalbraut milli …      │  📍 Staðs.  Úti          │
│                                           │  👤 Hópstærð 8–24        │
│  Merkimiðar  [Útivist] [Klifur]            │  💰 Verð    0 kr.        │
│                                           │  ─────────────────────   │
│                                           │  Tilkynna efni           │
└───────────────────────────────────────────┴──────────────────────────┘
    main: 1fr (min 0)                          aside: 320px, sticky top 76px
    gap: var(--sl-spacing-gap-xl)
```

`▌` is the 3 px kind-accent rule down the left of the title block. It is the only place colour alone carries the kind, and it is redundant with the badge.

### `half` 620–1079

One column. The sidebar stops being a sidebar and becomes a **facts strip** directly under the hero and *above* the tabs — the facts are what the reader came for, so they must not sit below a tab panel.

```
┌────────────────────────────────────────────┐
│ Heim / Dagskrárbankinn / Kaðlabrautin      │
│ [ media band, only if image ]              │
│ ▌ [Verkefni] Kaðlabrautin                  │
│ ▌ eftir Halldór Valberg · 12. sept. 2026   │
│ [♡ 0] [Deila] [Bæta við] [Breyta] [⋯]      │  actions wrap, 48px each
├────────────────────────────────────────────┤
│ ⏱ 30–45 mín │ ⏱ 15 mín │ 👥 [F][D]        │  facts strip: 3 cols, wraps
│ 📍 Úti      │ 👤 8–24   │ 💰 0 kr.         │
├────────────────────────────────────────────┤
│ Yfirlit │ Leiðbeiningar │ Búnaður │ Ath. 2 │
│ ───────                                    │
│ Um verkefnið …                             │
└────────────────────────────────────────────┘
```

### `phone` <620

As `half`, with:

- Facts strip becomes **two columns** (`repeat(2, minmax(0,1fr))`), label above value.
- Tab strip scrolls horizontally with `scroll-snap-type: x mandatory` and a fade mask on the overflowing edge. It never wraps to two rows — a wrapped tab strip reads as two separate controls.
- Actions: the primary two (♡, Deila) stay inline; `Bæta við vinnusvæði`, `Breyta` and `Eyða` collapse into the `⋯` overflow menu.

---

## 3. Tokens

No new primitives. Everything below already exists in `frontend/app/slodi-tokens.css`.

**Kind accent** — set once on the page root as `--ef-accent`, `--ef-accent-bg`, `--ef-accent-text`, then consumed by the rule down the title block.

**These follow the TypeBadge card already in the design system** (`components/dagskrarbankinn-type-badge.html`), which settled the mapping deliberately. Do not re-derive it here:

| Kind | accent | why |
|---|---|---|
| Verkefni (`task`) | **neutral** — `--sl-color-border-strong` / `--sl-color-background-tertiary` | It is the default and by far the most common kind, so it must not shout. |
| Viðburður (`event`) | `--sl-color-event` (aðrir, 270°) | Violet, *not* the falkar rose: beside a red-toned glyph a rose badge reads as "careful" about something that is simply an occasion. |
| Dagskrá (`program`) | `--sl-color-cycle` → **superseded**: use `--sl-color-primary` | The badge card gives Dagskrá the primary. Teal already means *draft* elsewhere. |

The `event` triple carries its own dark-theme values, so the page needs **no local dark override** for the accent. Same arrangement as `yfirferd.module.css`.

**Age badges** use the patrol tokens, matching the create modal exactly: `--sl-color-patrol-{falkar,drekar,rekkar,drott,adrir,rover}`, via `getAgeGroupPatrol()` in `lib/format.ts`.

**Surfaces and text:** `--sl-color-surface`, `--sl-color-surface-raised` (the facts panel), `--sl-color-border-subtle` (dividers), `--sl-color-text-{primary,secondary,tertiary}`.

**Type:** `--sl-text-heading-1` for the title on `wide`, `--sl-text-heading-2` below `half`. Facts labels `--sl-text-caption`, values `--sl-text-body` at `--sl-font-weight-semibold`.

**Filled buttons ride the `-text` tier** (`background: hsl(var(--sl-color-primary-text))`, `color: hsl(var(--sl-color-text-inverse))`) — that is what keeps them above AA in both themes. Do not use `--sl-color-primary` as a button fill.

---

## 4. Component inventory

Nine components. **Push each as its own card**, plus one full-page card per layout.

### `EfnissidaPage` — *reshaped* (page view)

The composition itself. Owns the `--ef-accent-*` assignment from `content_type`, the three layouts, and the loading / error / ready switch. **Three cards:** wide, half, phone.

States: `loading` → `EfnissidaSkeleton`; `error` → `EfnissidaError`; `ready`; `editing`.

### `TypeBadge` — ***reuse, already designed***

Says which kind the item is. **Already exists in the design system** as
`components/dagskrarbankinn-type-badge.html` — three kinds, two sizes, a glyph each
(one bar for verkefni, a pennant for viðburður, three lines for dagskrá), border at
45% alpha, AA-safe text, greyscale-tested. The detail page **consumes it unchanged**;
it is not redesigned here and needs no new card.

The one thing this page adds is placement: `md` size, beside the `h1`, inside the
title block. It stays a `span` with visible text and an `aria-hidden` glyph.


### `EfnissidaHero` — *reshaped from* `ProgramDetailHero`

Two variants, and this is the fix for the empty-hero problem:

- **`withImage`** — 16:9 media band, `max-height: 320px`, `object-fit: cover`, `--sl-radius-card`, then the title block beneath it.
- **`bare`** — **no media element at all.** The title block sits directly under the breadcrumb. Not a placeholder, not a grey box, not an icon in a frame: an item without a picture is the normal case and must not be made to look broken.

Title block in both: kind rule `▌`, `TypeBadge`, `h1` title, byline „eftir {höfundur} · {dagsetning}", then the action row.

Actions: `Líkar` (♡ + count), `Deila`, `Bæta við vinnusvæði`, `Breyta` (author/ moderator/workspace-admin only), `⋯` overflow → `Eyða`, `Tilkynna`.

States per action: default / hover / active / focus-visible / disabled-with-reason / pending. `Líkar` when signed out is **disabled with its reason on the control** („Skráðu þig inn til að líka við"), never hidden — same rule as the suspended FAB.

### `EfnissidaFacts` — *reshaped from* `ProgramQuickInfo`

The six facts. Same data, three presentations (sidebar / strip / 2-col grid).

Rows: `Lengd`, `Undirbúningur`, `Aldur`, `Staðsetning`, `Hópstærð`, `Verð`. Below a divider: `Búið til`, `Líkar`, `Athugasemdir`, then `Tilkynna efni`.

- Semantics: a `<dl>`. Each fact is `<dt>` label + `<dd>` value — not a table, not divs.
- **Empty facts are omitted, not shown as „—".** Six rows of dashes tells the reader nothing and pushes the real values down. If *every* fact is empty the whole panel is omitted and the tabs move up.
- `Aldur` renders age badges in patrol colours, each with its label.
- States: default / all-empty (omitted) / `Tilkynna` hover+focus / report-sent.

### `EfnissidaTabs` — *reshaped from* `ProgramDetailTabs`

Tabs: `Yfirlit` · `Leiðbeiningar` · `Búnaður` · `Athugasemdir {n}`.

- Correct ARIA tabs: `role="tablist"`, `aria-selected`, `aria-controls`, arrow-key movement, `Home`/`End`, one tab stop for the strip.
- A tab whose panel is empty is **disabled with a reason**, not hidden — a tab set that changes length between items is harder to learn than a dimmed tab.
- Panel headings are **kind-aware**: „Um verkefnið" / „Um viðburðinn" / „Um dagskrána".
- States: selected / unselected / hover / focus-visible / disabled-empty / count-zero.

### `EfnissidaEdit` — *reuse* `ProgramDetailEdit`

Inline edit of the main column. Out of scope for the redesign except that it must inherit the accent and the kind-aware copy („Breyta verkefni").

### `EfnissidaSkeleton` — *reshaped from* `ProgramDetailSkeleton`

**Must mirror the `bare` hero, not the `withImage` one.** Today the skeleton reserves a media band, so the ready state jumps upward for the majority of items that have no image. Reserve the media band only once the item is known to have one.

`prefers-reduced-motion`: shimmer becomes a static tint.

### `EfnissidaError` — *reshaped from* `ProgramDetailError`

Keeps the house voice, now aligned with the new site-wide `app/not-found.tsx`:

- not-found: „Úps! Fórstu út fyrir slóðann?" + „Þetta efni finnst ekki. Það gæti hafa verið fjarlægt, eða hlekkurinn er úreltur."
- other error: „Úps! Eitthvað fór úrskeiðis" + „Þetta tjald hefur greinilega fokið í burtu?! Við erum að laga málið."
- Actions: „Í dagskrárbankann" (primary) · „Heim á svæðið".
- The raw `error.message` stays, but in `--sl-text-caption` / `--sl-color-text-tertiary` under the actions — it is for us, not for the leader.

### `ReportContentModal`, `DeleteConfirmModal` — *reuse unchanged*

Listed so the design shows them in place. No visual change requested.

---

## 5. Interaction & motion

| Interaction | Motion | `prefers-reduced-motion` |
|---|---|---|
| Tab change | panel cross-fades 120 ms, `--sl-transition-fast` | no fade; instant swap |
| Like toggle | heart scales 1→1.15→1 over 180 ms | no scale; fill colour changes only |
| Overflow menu open | 8 px rise + fade, 140 ms | no transform; instant |
| Facts panel on scroll (`wide`) | sticky at `top: 76px` | unchanged — sticky is not motion |
| Skeleton → ready | 100 ms fade | instant |
| Hover on action buttons | background 150 ms | instant |

No parallax on the media band. Nothing animates on load except the skeleton hand-off.

**Focus management:** opening `Breyta` moves focus to the first field; cancelling returns it to the `Breyta` button. Opening the overflow menu moves focus to its first item; `Escape` closes and returns focus to `⋯`.

---

## 6. Audio

None. This is not a game surface.

---

## 7. Copy (Icelandic, real strings)

Every kind-dependent string resolves from `CONTENT_TYPE_LABEL` — there is no literal „dagskrá" left in the page.

| Slot | Verkefni | Viðburður | Dagskrá |
|---|---|---|---|
| Badge | `Verkefni` | `Viðburður` | `Dagskrá` |
| Overview heading | `Um verkefnið` | `Um viðburðinn` | `Um dagskrána` |
| Edit button | `Breyta verkefni` | `Breyta viðburði` | `Breyta dagskrá` |
| Share button | `Deila verkefni` | `Deila viðburði` | `Deila dagskrá` |
| Delete confirm | `Eyða verkefni?` | `Eyða viðburði?` | `Eyða dagskrá?` |

Kind-independent:

- Breadcrumb: `Heim` / `Dagskrárbankinn` / `{titill}` — note **`Dagskrárbankinn`**, matching the sidebar, not „Dagskrárbanki".
- Byline: `eftir {nafn} · {dagsetning}`
- Facts: `Lengd` · `Undirbúningur` · `Aldur` · `Staðsetning` · `Hópstærð` · `Verð`
- Facts panel heading: `Stuttar upplýsingar`
- Tabs: `Yfirlit` · `Leiðbeiningar` · `Búnaður` · `Athugasemdir`
- Actions: `Líkar við` / `Fjarlægja líkar` · `Bæta við vinnusvæði` · `Tilkynna efni` · `Eyða`
- Disabled-empty tab: `Engar leiðbeiningar fylgja` · `Enginn búnaður tilgreindur`
- Signed-out like: `Skráðu þig inn til að líka við`
- Comments empty: `Engar athugasemdir enn. Vertu fyrst til að segja eitthvað.`
- Report confirmation (`aria-live`): `Takk fyrir. Teymið skoðar þetta.`

Address the reader as **þú**. Gender-neutral throughout — **þau**, never generic hann/hún. Run every string through the `skatalingo` skill before merge.

---

## 8. Data & i18n

Reads `GET /content/{id}` → `ContentOut` (the polymorphic endpoint; `/programs/{id}` only ever matched `content_type = "program"`).

| Field | Format | Helper |
|---|---|---|
| `duration_min/max` | `30–45 mín`, single value `30 mín` | `formatDuration` |
| `prep_time` | `15 mín` | — |
| `participants_min/max` | `8–24` | — |
| `price` | `0 kr.`, thousands with **`.`** → `5.003 kr.` | `formatPrice` / `formatIcelandicNumber` |
| `created_at` | `12. september 2026` | `formatIcelandicDate` |
| `age_groups` | badge per band | `AGE_GROUP_DISPLAY`, `getAgeGroupPatrol` |
| `like_count` / `comment_count` | integer, Icelandic long scale if large | `formatIcelandicNumber` |

`toLocaleString("is-IS")` is **not** used anywhere — it renders `5,003`.

Ranges use an en dash `–` with no spaces. „Lengd" is a *minimum*: where the value is a single number the label reads `Lengd, að lágmarki`.

---

## 9. Accessibility

- One `h1` per page: the item title. The `404`-style display number in the error state is `aria-hidden`; the sentence is the heading.
- Tabs implement the full ARIA tabs pattern; the strip is one tab stop.
- All touch targets ≥ **48 px**, including the overflow trigger and each tab.
- Visible `focus-visible`: `2px solid hsl(var(--sl-color-border-focus))`, `outline-offset: 2px`.
- Kind is **never colour alone** — the badge always carries its label.
- Like count changes announce via `aria-live="polite"`; report confirmation likewise.
- The media band has meaningful `alt` when the author supplied one, `alt=""` when decorative. Never „mynd".
- AA contrast in both themes, verified on the dimmed byline and facts labels — the tertiary text tier is the likeliest failure.
- Operable at 200 % zoom: at that size `wide` collapses to the `half` layout rather than keeping a 320 px sidebar.
- `dvh`, never `vh`.

---

## 10. Acceptance criteria

1. An item with **no image** puts its title within the first 200 px below the header, on a phone.
2. A Verkefni shows the word „Verkefni" and the string „dagskrá" appears nowhere on the page.
3. The kind is identifiable in greyscale.
4. Every empty fact is absent; no row of „—".
5. An empty tab is present, dimmed, and states why.
6. Skeleton → ready causes **no vertical shift** of the title for an item without an image.
7. Full keyboard traversal: breadcrumb → actions → tabs → panel → facts → report.
8. axe-core clean on both themes, in all three layouts.
9. `Breyta` and `Eyða` are absent for a reader who is neither author, moderator, nor workspace admin — and the page does not 403 them, it simply offers less.
10. At 200 % zoom nothing is clipped and nothing scrolls horizontally except the tab strip.

---

## 11. Open questions

1. **`Markmið` and `Þroskasvið`** are designed in the create modal but have no backend field. Should the facts panel reserve space for them now or wait?
2. **Dagskrá / Viðburður children.** A collection's detail page should list what it contains, but there is no child picker yet, so a Dagskrá is currently always empty. Does the design show an empty-collection state, or is that deferred with the B-cluster?
3. **`Bæta við vinnusvæði`** — where does it go? Vinnubekkurinn is not in this release.
4. Should the author see review state („Óyfirfarið") on their own item? It is currently moderator-only, so a leader cannot tell whether their submission was looked at.
