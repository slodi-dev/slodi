# Design Spec — Yfirferð

> Slóði design pipeline · Stage 1 output · consumed by design-handoff → design-implement
> Slug: `yfirferd` · Date: 2026-09-07
> **Code:** branch `feature/skammarkrokur` · tickets sc-430, sc-445, sc-446, sc-447, sc-431

## 1. Overview

- **What it is:** the screen Dagskrárstjórnarteymið works from — everything submitted to the dagskrárbanki that nobody has looked at yet, everything someone has objected to, and the record of what was decided.
- **Audience:** three volunteers, sweeping a backlog in a sitting. Not power users of this app; power users of *scouting*.
- **Single job of the screen:** let one reviewer decide about one submission quickly, and leave a record of why.
- **Platforms:** desktop and mobile — **different layouts, not one reflow**.
- **Routes:** `app/yfirferd/page.tsx`, `app/yfirferd/ReviewDetailPane.tsx`, `app/yfirferd/AuthorStandingPanel.tsx`.

### Why this is being reshaped

It was built working-backwards from the API and it shows. The shape is right — a rail you scan, a pane you read — but it was assembled from local CSS rather than from the design system, and it has accumulated the things a screen accumulates when nobody has drawn it:

- **Eleven bespoke button styles.** `.approve`, `.reject`, `.hide`, `.sendBtn`, `.permanentBtn`, `.shareBtn`, `.undoBtn`, `.linkBtn`, `.segment`, `.tab`, `.standingToggle` — all hand-rolled, none from `components/Button`.
- **Chips invented three times** (`.type`, `.reportFlag`, `.strikes`, `.rowFlag`, `.internalBadge`, `.sentBadge`) while `components/ui/ActiveChip.tsx` exists.
- **A disclosure invented once** (`.standingToggle`) while `components/ui/CollapsibleSection.tsx` exists.
- **Two `window.prompt()` calls and one `window.confirm()`** carrying decisions that a leader is told are permanent. A browser prompt cannot be styled, cannot show the item it is about, and is the single least trustworthy surface in the app to put an irreversible act behind.
- **The toolbar wraps to two rows** at common widths, putting "til [date]" on a line of its own.

The redesign is not about new capability. Everything below already works; this is about making it look and behave like Slóði.

## 2. Layout

**Frame:** the board fills the dashboard content area. The rail scrolls independently of the pane; the page itself does not.

**Breakpoints:** mobile `<768px` · tablet `768–1023px` · desktop `≥1024px`.

### Desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Yfirferð                        j/k hreyfa · s samþykkja · h hafna · f fela│
├──────────────────────────────────────────────────────────────────────────┤
│ [ Efni 5002 ] [ Tilkynningar 783 ]                                       │
│ (Óyfirfarið)(Samþykkt)(Hafnað)(Allt)  [Leita…] [Höfundur…] [dags]–[dags] │
│                                                        ☐ Aðeins tilkynnt │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌── rail 22rem ──────┐ ┌── reading pane ─────────────────────────────────┐│
│ │▎Kötturinn og músin │ │ VERKEFNI · eftir Signý · 7. september 2026      ││
│ │  Verkefni · Signý  │ │ ┌──────────────────────────────────────────────┐││
│ │  2 tilkynningar  ⚑ │ │ │ ⚑ TILKYNNINGAR (2)                          │││
│ ├────────────────────┤ │ │ Getur verið hættulegt · „…"                  │││
│ │ Ratleikur um hv.   │ │ └──────────────────────────────────────────────┘││
│ │  Verkefni · Jón    │ │ Kötturinn og músin                              ││
│ ├────────────────────┤ │ UM EFNIÐ / LEIÐBEININGAR / MYND / SKJÖL         ││
│ │        …           │ │ LENGD · BÚNAÐUR · ALDUR · FJÖLDI                ││
│ ├────────────────────┤ │ ▸ Saga höfundar — Signý                         ││
│ │ 50 af 5002  [Meira]│ │ ATHUGASEMDIR   [note thread + composer]         ││
│ └────────────────────┘ │ ─────────────────────────────────────────────── ││
│                        │ EFNIÐ  [Samþykkja][Hafna][Fela]  Afrita hlekk → ││
│                        └─────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

The rail is a **fixed 22rem** so the pane never reflows as titles change length. The action bar is **sticky to the bottom of the pane**: a long item must not put the decision below the fold, which is the whole reason to have a pane.

### Mobile (<768px)

One column, and the rail and pane are **two views, not two stacked panels**. Choosing a row replaces the list with the item; a back affordance returns.

```
┌────────────────────────┐      ┌────────────────────────┐
│ Yfirferð            ⚙  │      │ ← Til baka             │
│ [Efni 5002][Tilk. 783] │      │ VERKEFNI · Signý       │
├────────────────────────┤ tap  │ Kötturinn og músin     │
│▎Kötturinn og músin     │ ───▶ │ ⚑ 2 tilkynningar       │
│  Verkefni · Signý  ⚑2  │      │ …                      │
├────────────────────────┤      ├────────────────────────┤
│ Ratleikur um hverfið   │      │ [Samþykkja]            │
│  Verkefni · Jón        │      │ [Hafna]     [Fela]     │
└────────────────────────┘      └────────────────────────┘
                                  sticky, full width
```

Filters collapse behind the ⚙ into a drawer — reuse `FilterDrawer` from `components/filters/FilterSidebar.tsx`, which the bank already uses. The keyboard hint row is hidden: there is no keyboard to hint at.

## 3. Tokens

- **Accent:** `--sl-color-primary` (green `142 50% 42%`). Yfirferð belongs to no patrol — it is the whole bank's screen, and giving it a patrol identity would imply otherwise.
- **Semantic, and never the accent:**
  - `--sl-color-error-*` — objections and hiding. Something reported is a problem, not a status.
  - `--sl-color-warning-*` — an author's history and an active skammarkrókur. **Context for a judgement, not a verdict.** Anyone can be reported; having been reported before is not the same as being wrong now. This distinction is the reason it is warning and not error.
  - `--sl-color-info-*` — a note that was sent to the author. Not green: sending a suggestion is not an approval, and the two must not read as the same act.
- **Surface / text / border:** `--sl-color-surface`, `--sl-color-surface-sunken`, `--sl-color-text-{primary,secondary,tertiary,inverse}`, `--sl-color-border`, `--sl-color-border-subtle`, `--sl-color-focus-ring`.
- **Radius / spacing:** `--sl-radius-{card,button,chip,input,pill,sm,xs}`, `--sl-spacing-{xs,sm,md,lg,xl}`.
- Light ✅ / dark ✅. The rail's selected row is a tinted fill **plus** a left bar — a tint alone does not survive dark mode or a dimmed screen in a scout hut.

## 4. Component inventory

| Component | Reuse? | Purpose | Variants | States | Data / props |
|---|---|---|---|---|---|
| `ReviewLayout` | **new** | rail + pane frame, and the mobile two-view swap | desktop · mobile | — | `rail`, `pane`, `selected` |
| `ReviewRail` | **new** | the scannable list | content · reports | loading · empty · filtered-empty · has-more | `items`, `cursor`, `onPick` |
| `ReviewRailRow` | **new** | one row | default · selected · urgent | default·hover·focus·selected | title, type, author, date, flags |
| `ReviewToolbar` | **new** | tabs + filters on one line | — | — | filters, counts, `onChange` |
| `StateSegmented` | **new** | Óyfirfarið / Samþykkt / Hafnað / Allt | — | default·hover·focus·selected | `value`, `onChange` |
| `ReviewPane` | **new** | the item, in full | content · report · empty | loading · empty · error | `detail` |
| `ReportCallout` | **new** | why it was flagged | — | — | `reports[]` |
| `FactGrid` | **new** | lengd, búnaður, aldur… | — | — | label/value pairs |
| `AuthorStanding` | **reuse** `components/ui/CollapsibleSection.tsx` | the person, not the item | collapsed · expanded | auto-expanded when history exists | counts, spells |
| `SuspensionControls` | **new** | 7 / 30 / 90 / custom / ótímabundið | — | default·busy·active-suspension | `onSuspend`, `onLift` |
| `NoteThread` | **new** | the team's notes | internal · sent | empty · has-notes | `comments[]` |
| `NoteComposer` | **new** | write one | — | idle·dirty·sending·error | `onSave`, `onSend` |
| `ConfirmDialog` | **reuse** `components/Modal/Modal.tsx` | replaces every `window.prompt`/`confirm` | send-to-author · reject · hide · suspend · permanent | idle·submitting·error | title, body, reason field, destructive? |
| Chips | **reuse** `components/ui/ActiveChip.tsx` | type, flags, badges | neutral · error · warning · info | — | `label`, `tone` |
| Buttons | **reuse** `components/Button` | every action | primary · secondary · destructive · quiet | default·hover·focus·disabled·busy | — |

### `ConfirmDialog` — the one that matters most

- **Purpose:** replace three `window.prompt()`s and a `window.confirm()` that currently carry the screen's consequential decisions. A browser prompt cannot show which item it is about, cannot show the text being sent, cannot be styled, and cannot be made accessible.
- **Variants and what each must show:**
  - *Hafna* — the item's name, a **required** reason field, and the fact that the author will see it.
  - *Fela* — the item's name and an optional reason.
  - *Senda höfundi* — the recipient's name, the note quoted back, and "ekki er hægt að afturkalla hana".
  - *Skammarkrókur* — the person's name, the duration, and a required reason they will read.
  - *Ótímabundið* — as above, plus that it lasts until lifted and **can be lifted at any time**. Without that last clause it reads as a ban.
- **States:** idle · submitting (action disabled, label changes) · error (inline, dialog stays open — never lose what was typed).
- **Destructive variant** uses `--sl-color-error-*` for the confirm action; the cancel is always the quiet one and always first in DOM order.

### `SuspensionControls`

- **Purpose:** the only action on this screen about a *person* rather than an item.
- **Variants:** durations `7 · 30 · 90`, a typed number, and `Ótímabundið` — set apart, worded rather than numbered, because it is a different kind of decision and not merely the longest.
- **Active state:** when a suspension is running, the durations are replaced by the end date (or "Ótímabundið") and a single `Aflétta`.

## 5. Interaction & motion

| Trigger | Effect | Reduced-motion fallback |
|---|---|---|
| `j`/`k` or ↑/↓ | cursor moves, pane cross-fades 120ms | no fade; pane swaps |
| Row picked | rail row fills, pane loads | same, no transition |
| Decision taken (`s`/`h`/`f`) | row leaves the rail, 160ms collapse | row disappears |
| Undo offered | the status line grows an `Afturkalla` button | appears instantly |
| Dialog opens | scale 0.98 → 1, fade, 120ms | appears instantly |
| Mobile: row → item | slide left 200ms | instant swap |

Animate `transform`/`opacity` only. **Focus follows the cursor** so a screen reader tracks the sweep; every decision is announced through `aria-live="polite"`.

## 6. Audio

None. This is a work surface, not a game.

## 7. Copy (Icelandic, real strings)

| Key | String | Context |
|---|---|---|
| `title` | Yfirferð | h1. No subtitle — a working surface should not spend a row explaining what a queue is |
| `tab.content` | Efni | |
| `tab.reports` | Tilkynningar | |
| `state.unreviewed` | Óyfirfarið | |
| `state.approved` | Samþykkt | |
| `state.rejected` | Hafnað | |
| `state.all` | Allt | |
| `filter.search` | Leita eftir heiti… | |
| `filter.author` | Höfundur… | |
| `filter.from.new` | Sent inn frá | when viewing Óyfirfarið |
| `filter.from.decided` | Afgreitt frá | every other view — the label names the date being filtered |
| `filter.reported` | Aðeins tilkynnt | |
| `empty.queue` | Ekkert bíður yfirferðar. | |
| `empty.filtered` | Ekkert efni passar við þessa síu. | different from the queue being clear, because it is |
| `empty.reports` | Engar opnar tilkynningar. | |
| `empty.pane` | Veldu efni til vinstri til að lesa það í heild. | |
| `pane.about` | Um efnið | |
| `pane.instructions` | Leiðbeiningar | labelled, or it reads as more description |
| `pane.image` | Mynd | |
| `pane.documents` | Skjöl | |
| `pane.reports` | Tilkynningar ({n}) | |
| `pane.notes` | Athugasemdir yfirferðar | |
| `pane.author` | Saga höfundar — {nafn} | |
| `act.approve` | Samþykkja | |
| `act.reject` | Hafna | |
| `act.hide` | Fela | |
| `act.unhide` | Sýna aftur | |
| `act.share` | Afrita hlekk | |
| `act.shared` | Hlekkur afritaður | |
| `act.undo` | Afturkalla | |
| `note.placeholder` | Athugasemd eða ábending… | |
| `note.internal` | Vista innanhúss | |
| `note.send` | Senda höfundi | |
| `note.badge.internal` | Innanhúss | |
| `note.badge.sent` | Sent höfundi | |
| `confirm.send.title` | Senda ábendingu til höfundar? | |
| `confirm.send.body` | {nafn} fær tölvupóst með þessari athugasemd. Ekki er hægt að afturkalla hana. | |
| `confirm.reject.reason` | Af hverju er „{heiti}“ hafnað? Höfundur sér þessa ástæðu. | required |
| `confirm.suspend.title` | Setja {nafn} í skammarkrók? | |
| `confirm.suspend.permanent` | Það gildir þar til einhver afléttir því. Hægt er að aflétta hvenær sem er. | |
| `standing.reports` | Tilkynningar alls | |
| `standing.strikes` | Áminningar | |
| `standing.spells` | Skammarkrókur | |
| `suspended.dated` | Í skammarkrók til {dags} | |
| `suspended.open` | Ótímabundið í skammarkrók | |
| `loadMore` | Sýna fleiri | |
| `loadMoreCount` | {n} af {alls} | without the total, a short queue and the top of a long one look identical |
| `error.load` | Ekki tókst að sækja yfirferðina. Reyndu aftur. | |

Address the reader as **þú**; gender-neutral throughout (**þau**, never generic hann/hún).

## 8. Data & i18n

- **Dates:** `14. september 2026` — month spelled out and **lowercase**; Icelandic does not capitalise month names. Rail rows use the short form `14. sept.`. Use `formatIcelandicDate` / `formatIcelandicDateShort` from `frontend/lib/format.ts`; never `toLocaleDateString`.
- **Counts:** Icelandic singular for numbers ending in 1 except 11 — *1 tilkynning*, *21 tilkynning*, *11 tilkynningar*.
- **Paging:** 50 at a time; the total comes from `X-Total-Count`, which the API must name in its CORS `expose_headers` or the browser refuses to let JavaScript read it.
- **Ordering:** Óyfirfarið is oldest-first because it is a backlog; every other view is most-recently-decided first, because that is how "what happened lately?" is asked.
- **Persistence:** the selected item lives in the URL as `?efni=<id>`, so copying the address bar shares what is on screen. A link resolves whether or not the item is on the loaded page.

## 9. Accessibility

- Touch targets ≥ 48px; the mobile action bar is full-width.
- Visible focus on every interactive element, in both themes.
- **Focus follows the cursor** through the rail, and every decision is announced via `aria-live="polite"`.
- Keyboard-first is not keyboard-only: every shortcut has a visible button.
- Keys are ignored while focus is in an input or textarea.
- **Colour is never the only signal** — every chip carries its label; the urgent rail row has a bar as well as a tint.
- `Modal` currently sets `role="dialog"` and `aria-modal` and closes on Escape but **does not trap focus**. The redesign must fix that in the shared component, not work around it here.
- Contrast AA+ in both themes including the dimmed hint text, which is the most likely thing to fail.

## 10. Acceptance criteria

- [ ] No `window.prompt` or `window.confirm` remains; every decision goes through `ConfirmDialog`.
- [ ] Every button comes from `components/Button`; no bespoke button CSS in `yfirferd.module.css`.
- [ ] Every chip comes from `ActiveChip`; the author disclosure uses `CollapsibleSection`.
- [ ] The toolbar holds one row at ≥1024px and collapses to a drawer below 768px.
- [ ] The pane's action bar is reachable without scrolling on an item with 5000 characters of instructions.
- [ ] Mobile shows rail *or* item, never both, with a working back affordance.
- [ ] A sweep of 50 is possible from the keyboard alone, with focus and announcements following.
- [ ] Sending to an author, rejecting, hiding and suspending each show the subject and, where required, refuse to proceed without a reason.
- [ ] Light and dark both pass AA, including disabled and dimmed states.
- [ ] Works at 200% zoom.

## 11. Open questions

1. **Should the reports tab be a tab at all?** An item can be both unreviewed and reported, and today it appears in both lists with different actions. A single list with a "tilkynnt" filter may be one concept instead of two.
2. **Does the rail need bulk selection?** At 5,002 unreviewed, approving one at a time is 5,002 keystrokes. A "samþykkja allt sem passar við þessa síu" is powerful and dangerous in equal measure — and is arguably how a backlog that size actually gets cleared.
3. **Where does an author see a note left for them?** They get an email; there is no screen. If Dagskrárstjórnarteymið want a conversation rather than a broadcast, that is its own surface.
4. **Should `Fela` and `Hafna` be one control?** They are genuinely different (hiding removes it from the bank; rejecting says it is not right) but a reviewer sweeping fifty items may not want to make that distinction fifty times.
