# Design Spec — Að stofna efni í dagskrárbankann

> Slóði design pipeline · Stage 1 output · consumed by design-handoff → design-implement
> Slug: `dagskrarbankinn` · Date: 2026-08-24
> **Code:** branch `feat/reclassify-programs-as-tasks` · tickets sc-129 (#134), sc-46 (B2)

## 1. Overview

- **What it is:** the flow for putting something _into_ the dagskrárbanki — choosing what kind of thing it is, filling one long form, and finding it again by type.
- **Audience:** a foringi adding an idea between other tasks, often on a phone, often interrupted.
- **Single job of the screen:** get one idea out of a leader's head and into the bank, correctly typed, without losing it if they are interrupted.
- **Platforms:** desktop and mobile — different layouts, not one reflow.
- **Routes:** `app/content/page.tsx` (list + modal), `app/content/components/`, `components/filters/`.

### Why this exists now

The bank used to store everything as a `Program`. That was a mis-classification: a single item — a leikur, a setning, one activity — is a **Verkefni** (`Task`), the smallest unit. A **Dagskrá** (`Program`) is a _collection_. A **Viðburður** (`Event`) is an occasion.

So the bank now holds three kinds of thing, and two questions became unavoidable: _what am I making?_ at creation, and _what am I looking at?_ in the list. Everything below serves those two.

**The distinction is not obvious from the names.** A leikur is a Verkefni, not a Dagskrá. Teaching it at the moment of choosing is the cheapest place to do it, and the design has to carry that weight.

## 2. Layout

**Frame:** the bank list fills the dashboard content area. The modal is an overlay; the chooser is anchored to the FAB.

**Breakpoints:** mobile `<600px` · tablet `600–1023px` · desktop `≥1024px`.

### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│  [ Leita í dagskrárbanka          ]        Raða eftir: [Nýjast ▾]│
├───────────────┬──────────────────────────────────────────────────┤
│ Tegund      ▴ │  52 einingar                                     │
│  ☐ Verkefni   │  ┌────────┐ ┌────────┐ ┌────────┐                │
│  ☐ Viðburður  │  │ [mynd] │ │ [mynd] │ │ [mynd] │                │
│  ☐ Dagskrá    │  │ Heiti  │ │ Heiti  │ │ Heiti  │                │
│               │  │VERKEFNI│ │VIÐBURÐ.│ │DAGSKRÁ │  ← type badge  │
│ Aldurshópur ▴ │  │ #tags  │ │ #tags  │ │ #tags  │                │
│  ☐ …          │  └────────┘ └────────┘ └────────┘                │
│ Flokkar     ▾ │                                                  │
│ Búnaður     ▾ │                          ┌──────────────────────┐│
│ …             │                          │ Verkefni             ││
│               │                          │ Einn dagskrárliður…  ││
│               │                          │ Viðburður            ││
│               │                          │ Eitthvað sem gerist… ││
│               │                          │ Dagskrá              ││
│               │                          │ Safn af liðum…       ││
│               │                          └──────────────────────┘│
│               │                                   (+ Bæta við)   │
└───────────────┴──────────────────────────────────────────────────┘
```

The chooser opens **upward from the FAB**, bottom-right. It is a menu, not a modal — one decision, three options, no chrome.

### Mobile

```
┌────────────────────────┐   chooser:      ┌────────────────────────┐
│ [ Leita…        ] [⚙]  │                 │ Verkefni               │
├────────────────────────┤                 │ Einn dagskrárliður…    │
│ 52 einingar            │                 ├────────────────────────┤
│ ┌────────────────────┐ │                 │ Viðburður              │
│ │      [mynd]        │ │                 │ Eitthvað sem gerist…   │
│ │ Heiti              │ │                 ├────────────────────────┤
│ │ VERKEFNI           │ │                 │ Dagskrá                │
│ │ #tags              │ │                 │ Safn af liðum…         │
│ └────────────────────┘ │                 └────────────────────────┘
│          …             │                 full-width, above the FAB
│                    (+) │
└────────────────────────┘
```

Filters live behind a drawer on mobile (`FilterDrawer`, already built). **Tegund is the first section in both.**

### The modal

```
┌─────────────────────────────────────────┐
│ Bæta við — verkefni                 [×] │  ← title names the type
├─────────────────────────────────────────┤
│ ⓘ Þú áttir ósent drög. [Halda áfram] [Byrja upp á nýtt]
│                                         │  ← draft banner, above the form
│ ● GRUNNUPPLÝSINGAR *                  ▴ │
│    Heiti hugmyndar *  [___________]     │
│    Lýsing             [___________]     │
│                                         │
│ ○ UPPLÝSINGAR                         ▾ │  ← Lengd (mínútur) lives here
│ ○ GÖGN OG BÚNAÐUR                     ▾ │
│ ○ LEIÐBEININGAR                       ▾ │
│ ○ MERKIMIÐAR OG MYND                  ▾ │
├─────────────────────────────────────────┤
│ ⚠ villuskilaboð birtast hér             │  ← sticky, above the actions
│              [Hreinsa]  [Bæta í bankann]│  ← sticky footer
└─────────────────────────────────────────┘
```

**The footer and the error region are sticky.** Today both sit at the bottom of a scrolling modal, so on a phone a validation error appears off-screen and the form looks like it did nothing.

## 3. Tokens

- **Accent:** `--sl-color-primary` (green `142 50% 42%`). The bank has no patrol identity — it belongs to everyone.
- **Type accents:** Dagskrá `--sl-color-primary`; Viðburður `--sl-color-patrol-falkar`; Verkefni neutral (`--sl-color-border` + `--sl-color-text-secondary`). Verkefni is the default and the most common, so it does not need to shout.
- **Surface / text / border:** `--sl-color-surface`, `--sl-color-text-primary`, `--sl-color-text-secondary`, `--sl-color-border`, `--sl-color-border-subtle`.
- **Radius / spacing:** `--sl-radius-card`, `--sl-radius-chip`, `--sl-radius-input`, `--sl-spacing-*`.
- **Semantic:** `--sl-color-error-text` for validation, `--sl-color-warning-*` for the draft banner, `--sl-color-success-text` for the saved confirmation. **Never the accent** — a green error is unreadable as an error.
- Light ✅ / dark ✅. The type badge must not rely on the tint alone; see §9.

## 4. Component inventory

| Component            | Reuse?                                           | Purpose                 | Variants               | States                                             | Data / props                              |
| -------------------- | ------------------------------------------------ | ----------------------- | ---------------------- | -------------------------------------------------- | ----------------------------------------- |
| `ContentTypeChooser` | **new** (extract from `ProgramsHeader`)          | pick what to create     | —                      | closed · open · hover · focus · keyboard-open      | `onChoose(type)`                          |
| `Modal`              | reuse `components/Modal/Modal.tsx`               | shell                   | —                      | open · closed                                      | `open`, `onClose`, `title`                |
| `ContentForm`        | reuse `NewProgramForm.tsx`                       | one form, three types   | task · event · program | idle · dirty · submitting · error · draft-restored | `workspaceId`, `contentType`, `onCreated` |
| `FormSection`        | **new** (extract from the accordion)             | one collapsible section | —                      | closed · open · complete · has-error               | `id`, `label`, `required`, `complete`     |
| `ContentTypeFilter`  | reuse `components/filters/ContentTypeFilter.tsx` | filter by type          | —                      | none · some selected                               | `selected`, `onChange`                    |
| `TypeBadge`          | **new** (extract from `ProgramCard`)             | say what a card is      | task · event · program | —                                                  | `type`                                    |
| `ImageUpload`        | reuse `components/ImageUpload/ImageUpload.tsx`   | picture                 | —                      | empty · uploading · done · error                   | —                                         |

### Precedent already in the design system

claude.ai/design already holds `components/vinnubekkur-type-aware-create-launcher.html` — the Vinnubekkurinn "+ Búa til…" launcher. **It solved this exact interaction once already**, and its accessibility contract is the house standard: `aria-haspopup="menu"` + `aria-expanded`, arrows between options, `Esc` closes and returns focus, dialog with a focus trap.

Two differences, both deliberate:

- **That launcher is context-aware** — it reorders its options to match the slot you are standing in, and drops the new block straight into that slot. The bank has no slot, so its three options are always in the same order.
- **Different vocabulary.** The launcher offers Leikur / Verkefni / Hróp / Færnimerki, which are _block kinds inside a plan_. The bank offers Verkefni / Viðburður / Dagskrá, which are _content types in the database_. Same widget, different taxonomy — do not merge them.

Also reusable as-is: `components/modal.html`, `components/collapsible.html`, `components/inputs.html`, `components/badges-chips.html`, `components/buttons.html`, `components/card.html`.

### `ContentTypeChooser`

- **Purpose:** answer _what am I making?_ before the form, and teach the distinction while doing it.
- **Each option is two lines:** the name, and one line saying what it is for. The hint is the design — without it the three names are indistinguishable to a new leader.
- **States:** closed (FAB only) · open (menu above FAB, scrim behind) · each option hover/focus.
- **Currently missing and required:** focus moves into the menu on open; `Escape` closes it and returns focus to the FAB; `↑`/`↓` move between options; focus is trapped while open. Today it is a `div` with a click-scrim and none of this.
- **Tokens:** `--sl-color-surface`, `--sl-shadow-modal`, `--sl-radius-card`.

### `FormSection`

- **Purpose:** make a long form navigable, and make it obvious what is left.
- **The problem it solves:** the form has five sections and accordion state is easy to lose — submit an incomplete form and the section holding the error may be collapsed. A section must be able to say _"there is a problem in here"_ while closed.
- **States:** closed · open · **complete** (a filled dot, already present) · **has-error** (error-coloured marker + auto-expand on submit).
- **Only GRUNNUPPLÝSINGAR is required.** That should be visible without opening anything.

### `TypeBadge`

- **Purpose:** answer _what am I looking at?_ on a card, so the Tegund filter is legible.
- **Variants:** Verkefni (neutral) · Viðburður (falkar) · Dagskrá (primary).
- **Never colour alone** — the label is always present.

## 5. Interaction & motion

| Trigger         | Effect                                                                              | Reduced-motion fallback       |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| FAB pressed     | menu scales from 0.96 → 1 and fades in, 120ms, origin bottom-right                  | appears instantly             |
| Option chosen   | menu closes, modal opens                                                            | no transition                 |
| Section toggled | height auto-animates, 160ms                                                         | snaps open                    |
| Submit fails    | offending section expands, error region appears, focus moves to the first bad field | same, no scroll animation     |
| Upload progress | determinate bar                                                                     | bar still updates; no shimmer |
| Item created    | modal closes, new card appears at the top of the grid with a brief highlight        | card appears, no highlight    |

Animate `transform`/`opacity` only.

## 6. Audio

None.

## 7. Copy (Icelandic, real strings)

| Key                 | String                                                        | Context                     |
| ------------------- | ------------------------------------------------------------- | --------------------------- |
| `fab`               | Bæta við í bankann                                            | FAB label                   |
| `chooser.title`     | Hvað viltu búa til?                                           | menu label (screen readers) |
| `type.task`         | Verkefni                                                      |                             |
| `type.task.hint`    | Einn dagskrárliður — leikur, setning, eitt verkefni           |                             |
| `type.event`        | Viðburður                                                     |                             |
| `type.event.hint`   | Eitthvað sem gerist á tilteknum tíma — útilega, mót, dagsferð |                             |
| `type.program`      | Dagskrá                                                       |                             |
| `type.program.hint` | Safn af liðum og viðburðum — dagskrárhringur                  |                             |
| `modal.title`       | Bæta við — {tegund}                                           | names what is being created |
| `field.name`        | Heiti hugmyndar                                               | required                    |
| `field.description` | Lýsing                                                        |                             |
| `field.duration`    | Lengd (mínútur)                                               | the span, for every type    |
| `submit`            | Bæta í bankann                                                |                             |
| `clear`             | Hreinsa                                                       |                             |
| `err.name`          | Heiti hugmyndar er nauðsynlegt                                |                             |
| `err.generic`       | Ekki tókst að vista. Reyndu aftur.                            |                             |
| `draft.banner`      | Þú áttir ósent drög frá því síðast.                           |                             |
| `draft.keep`        | Halda áfram með þau                                           |                             |
| `draft.discard`     | Byrja upp á nýtt                                              |                             |
| `filter.type`       | Tegund                                                        | sidebar section             |
| `empty.filtered`    | Ekkert efni passaði við síurnar. Prófaðu að hreinsa þær.      |                             |
| `created`           | {heiti} er komið í bankann.                                   | `aria-live` confirmation    |

Address the reader as **þú**, active voice. Errors say what happened and what to do.

## 8. Data & i18n

- **A bank entry is a template, not an occurrence.** It has a _length_ (`duration_min`/`duration_max`), never a date. A útilega in the bank is "a whole weekend"; the date only exists once a leader places it in a plan, and belongs to that placement.
- **Counts** take the Icelandic singular for numbers ending in 1 except 11: _1 verkefni_, _21 verkefni_, _11 verkefni_.
- **Persistence:** the draft is in `localStorage`, keyed by workspace **and** type, so a half-written viðburður does not reappear inside a new verkefni.
- **Create endpoints:** `POST /workspaces/{id}/{tasks|events|programs}`. Reading is polymorphic: `GET /workspaces/{id}/content`.

## 9. Accessibility

The floor, and the specific gaps this spec exists to close:

- **The chooser must be a real menu.** `role="menu"`, focus moves in on open, `Escape` returns focus to the FAB, arrows move between options, focus trapped while open. None of this exists today.
- **Errors must be reachable.** The error region is sticky above the actions and announced with `aria-live="polite"`; on submit, focus moves to the first invalid field and its section expands.
- **A collapsed section must be able to report a problem** — an error inside something the leader cannot see is an error they cannot fix.
- **Type is never conveyed by colour alone.** The badge always carries its label.
- Touch targets ≥ 48px; the FAB ≥ 100px wide.
- Visible focus on every interactive element, in both themes.
- Contrast AA+ in both themes, including the dimmed hint lines under each chooser option — those are the most likely thing to fail.
- The modal already sets `role="dialog"`, `aria-modal` and closes on `Escape`; it does **not** trap focus. It should.

## 10. Acceptance criteria

- [ ] The chooser is fully operable by keyboard, traps focus, and returns focus to the FAB on close.
- [ ] The modal title names the type being created.
- [ ] Submitting an incomplete form expands the offending section, shows the error without scrolling, and moves focus to the first bad field.
- [ ] A collapsed section shows that it contains an error.
- [ ] The draft banner is dismissible and does not push the first field out of view.
- [ ] Every card shows its type as text, not only as colour.
- [ ] Tegund is the first filter section on both layouts, and its chips appear in the active-filter bar.
- [ ] No date fields anywhere in the create flow.
- [ ] Light and dark both pass AA, including hint text and disabled states.
- [ ] Works at 200% zoom and in the mobile single-column layout.

## 11. Open questions

1. **`events.start_dt` is NOT NULL**, so creating a bank Viðburður stores a default timestamp nobody chose. Should the column become nullable, or is a "bank event" a different thing from a scheduled one? This is the same distinction the A-cluster planner draws, where the date sits on the plan entry rather than on the content. → sc-129
2. **Should the form be a modal at all on mobile?** Five sections in an overlay on a small screen is a lot; a full route may be kinder. That is a bigger change than this spec assumes.
3. **Is "Dagskrá" creatable from the bank yet?** A Program is a collection, and there is no child picker — creating one produces an empty collection with no way to fill it. Possibly it should not be offered until B-cluster lands.
4. **Type filter and the type chooser use the same three labels.** Should the hint lines also appear in the filter, or is that noise once a leader knows?
