# Vinnubekkurinn — block-assembly design spec

**Stage:** 2 of the idea → spec → claude.ai/design → code pipeline.
**Source of truth for behaviour:** [`docs/frontend/vinnubekkurinn-block-assembly-components.md`](../../frontend/vinnubekkurinn-block-assembly-components.md)
**Tickets:** sc-138 … sc-163, epic 33 *Fasi 2 — Vinnubekkurinn*. Parent: [sc-48 B4](https://app.shortcut.com/sl-6/story/48).
**Design-system project:** Slóði (`467a7e5e-eb7f-44e8-9bd6-2c257fa0cdea`) on claude.ai/design, group **Vinnubekkurinn**.

---

## 0. The principle every component inherits

**Drag-and-drop is an accelerator, never the only path.** Add, remove, reorder and
move-between-slots must each be reachable by keyboard and by an on-screen button,
with no mouse drag required. Two interfaces, one state change — see
`AssemblyProvider` (sc-161), which both the drag layer and the buttons dispatch
intents against. That single reducer is what makes accessibility cheap rather
than a parallel implementation that silently drifts.

---

## 1. Tokens

Every preview links the project's own `tokens.css` and `preview.css` (matching the
house style of the existing cards) plus one shared kit stylesheet,
`components/vinnubekkur.css`. **No hard-coded colour values anywhere** — colour,
space, radius, shadow and duration all resolve through `--sl-*`.

Kit-local aliases (defined in `vinnubekkur.css`, all resolving to `--sl-*`):

| Alias | Resolves to | Used for |
|---|---|---|
| `--vb-slot-gap` | `--sl-spacing-stack-sm` | vertical rhythm between slots |
| `--vb-block-radius` | `--sl-radius-card` | block + slot corners |
| `--vb-focus` | `--sl-shadow-focus` | drop-target and selection glow |
| `--vb-motion` | `--sl-transition-fast` | all transitions; collapses to `1ms` under `prefers-reduced-motion` |
| `--vb-kind` | per slot-kind semantic colour | the 3px left accent on every block |

Slot-kind accents map ADR-002's kinds onto existing ramps, so the assembler adds
**no new colours** to the system:

`setning` → patrol-drekar · `dagskra` → primary · `leikur` → patrol-rekkar ·
`slit` → secondary · `endurmat` → patrol-falkar · `custom` → border-strong

Status colours reuse the semantic states: `confirmed` → success, `draft` → info,
`tentative` → warning, `undecided` → neutral **with a dashed border and a literal
"?"**, because ADR-002 §3 makes the question mark a first-class state rather than
an error.

---

## 2. Component inventory → preview cards

Every card shows the component's full state set side by side, each state labelled.

### A. The assembly canvas

| Ticket | Component | Preview | States shown |
|---|---|---|---|
| sc-138 | `AssemblyCanvas` | `components/vinnubekkur-assembly-canvas.html` | resting skeleton, sensor/announcement responsibilities |
| sc-139 | `SlotFrame` | `…-slot-frame.html` | resting, required-empty, drop-over, invalid drop, collapsed, multi-block |
| sc-140 | `BlockCard` | `…-block-card.html` | default, hover, selected, focus, keyboard-grabbed, dragging, with endurmat + provenance, multi-week |
| sc-141 | `BlankSlot` | `…-blank-slot.html` | optional, required, hover, drop-over, focus, disabled |
| sc-142 | `InsertAffordance` | `…-insert-affordance.html` | hidden, hover, focus, drop-line |
| sc-143 | `DragOverlay` / `BlockGhost` | `…-drag-overlay.html` | move ghost, copy ghost, invalid ghost, multi-select, full drag scene |
| sc-144 | `RequiredSlotWarning` | `…-required-slot-warning.html` | inline marker, canvas summary, publish blocker, resolved |

### B. The block library

| Ticket | Component | Preview | States shown |
|---|---|---|---|
| sc-145 | `BlockPalette` | `…-block-palette.html` | full rail: search, tabs, grouped list, create footer |
| sc-146 | `PaletteSearch` | `…-palette-search.html` | empty, hover, focus-with-results, debouncing, no results, disabled |
| sc-147 | `BlockLibraryItem` | `…-block-library-item.html` | default, hover with "Bæta við", focus, carries context, badge spanning, dragging, already-used |
| sc-148 | `TypeAwareCreateLauncher` | `…-type-aware-create-launcher.html` | closed, open (slot-aware ordering), resulting create form |
| sc-149 | `PaletteEmptyState` | `…-palette-empty-state.html` | first-run empty, no search hits, no filter hits, loading, error |

### C. Editing / inspector

| Ticket | Component | Preview | States shown |
|---|---|---|---|
| sc-150 | `BlockInspector` | `…-block-inspector.html` | full editor, kind-adapted fields, field error, nothing selected |
| sc-151 | `ThemeParamField` | `…-theme-param-field.html` | empty, chosen, open combobox, before/after re-skin, not applicable |
| sc-152 | `TimingField` | `…-timing-field.html` | presets, slider+focus, unset, error, meeting time budget, over budget |
| sc-153 | `StatusPill` / `StatusSelect` | `…-status-pill.html` | all four statuses, on a card, closed/focus/open menu |
| sc-154 | `VenueField` | `…-venue-field.html` | inherited, overridden, autocomplete, indoor/outdoor toggle, on card |
| sc-155 | `EndurmatNote` | `…-endurmat-note.html` | corrective, positive, multiple collapsed, none, compose-after-meeting |

### D. Controls & accessibility backbone

| Ticket | Component | Preview | States shown |
|---|---|---|---|
| sc-156 | `BlockActionsMenu` | `…-block-actions-menu.html` | full menu, edge-of-list disabled, "move to slot…" submenu, phone bottom sheet |
| sc-157 | `MoveControls` | `…-move-controls.html` | default, hover, focus, disabled at edge, with position counter, in context |
| sc-158 | `LiveRegionAnnouncer` | `…-live-region-announcer.html` | the actual Icelandic announcement copy for the full keyboard loop, button path, invalid drop; real DOM shape; wording rules |
| sc-159 | `KeyboardDragHint` | `…-keyboard-drag-hint.html` | on focus, while grabbed, inline variant, persistent shortcut bar |
| sc-160 | `DragHandle` | `…-drag-handle.html` | rest, hover, focus, grabbing, locked; right-vs-wrong comparison |

### E. Shell & state

| Ticket | Component | Preview | States shown |
|---|---|---|---|
| sc-161 | `AssemblyProvider` | `…-assembly-provider.html` | intent flow diagram, the `AssemblyIntent` union, action→intent table, state shape |
| sc-162 | `AutosaveIndicator` | `…-autosave-indicator.html` | idle, saving, saved, offline, error; in-header placement; loud banners |
| sc-163 | `AssemblyHeader` | `…-assembly-header.html` | normal meeting, template, unfilled-blanks, "Afrita sniðmát" dialog, phone |

### The composed page

`pages/vinnubekkur-hifi.html` — the whole surface in one scene: a leader assembling
the 12 February troop meeting, mid-drag with "Kötturinn og músin" hovering over the
required Leikur slot. Annotated with which ticket owns which region, plus the same
moment done keyboard-only and the phone layout.

---

## 3. Accessibility acceptance (carried from the source doc §6)

- [ ] Every block can be added, reordered, moved and removed with keyboard only.
- [ ] Every block has visible ▲/▼ buttons and a ⋯ menu (touch + keyboard path).
- [ ] Correct list semantics (`role="list"` / `listitem`); dnd-kit announcements, never `aria-grabbed`.
- [ ] Focus is preserved across a move — it follows the block to its new index.
- [ ] Grab / move / drop / cancel each produce an `aria-live` announcement.
- [ ] Drag handle is a real focusable control with an `aria-label` naming the block.
- [ ] Blank/required slots conveyed non-visually (label + `aria-describedby`), not by dashed border alone.
- [ ] Contrast and hit targets via `sl-*` tokens; 44px targets under `pointer: coarse`.
- [ ] `prefers-reduced-motion` honoured for every drag animation.
- [ ] Works at 200% zoom and in the mobile single-column layout.

---

## 4. Open questions for the team

Unchanged from the source doc §7 — these are the decisions the design review on
claude.ai/design should settle:

1. **State lib** — React context/reducer for v1, or Zustand now? (Spec assumes context/reducer.)
2. **Cross-slot moves** — do slot kinds constrain what can drop in them? The previews show an *invalid drop* state, so the answer changes `SlotFrame` and `DragOverlay`.
3. **Clone-with-blanks UX** — the `AssemblyHeader` card proposes a three-option dialog (skeleton-with-blanks / everything / everything-with-endurmat). Confirm.
4. **Backend gaps** — `is_template`, `order_index`, status and timing are ADR-002 build items the components assume; sequence FE against those migrations.
5. **Embedding** — must `AssemblyCanvas` render inside the grid/timeline (A4, sc-39) at v1, or ship standalone first?

---

## 5. Build sequencing (source doc §8)

1. `AssemblyProvider` + intents + static `AssemblyCanvas` — ▲/▼ + ✕ + `BlankSlot` "Bæta við". Fully keyboard/button usable, no DnD.
2. `BlockPalette` + `BlockLibraryItem` add-via-button.
3. Layer dnd-kit on top (pointer + keyboard sensor) reusing the same intents.
4. `BlockInspector` (status, timing, theme param).
5. `AssemblyHeader` "Afrita sniðmát" → closes the B4 loop.

Steps 1–2 already deliver a working, accessible assembler. **New dependency:**
`@dnd-kit/core` + `/sortable` + `/accessibility` — confirm before adding.

---

## 6. Files

```
docs/design/vinnubekkurinn/
  SPEC.md                                  ← this file
  bundle/                                  ← exactly what is pushed to claude.ai/design
    components/vinnubekkur.css             ← shared kit styles
    components/vinnubekkur-*.html          ← 26 cards, one per ticket
    pages/vinnubekkur-hifi.html            ← the composed hi-fi page
    docs/vinnubekkur-reference.html        ← reading-order + constraints card (group Docs)
```

### Source docs mirrored into the design project

The reference card is a hub, not a substitute. The prose lives alongside it in the
project under `docs/`, at paths that mirror `slodi/docs/` exactly so every relative
link inside the markdown still resolves:

| Project path | What it is |
|---|---|
| `docs/frontend/vinnubekkurinn-block-assembly-components.md` | behaviour — the source of truth |
| `docs/design/vinnubekkurinn/SPEC.md` | this spec |
| `docs/tharfagreining2/adr-002-event-typing-and-grid.md` | the model underneath |
| `docs/features/planner.md` | the planning spine |
| `docs/frontend/builder.md` | the wider `/builder` spec |
| `docs/frontend/DESIGN-TOKEN-STANDARDS.md` | the three-tier token standard |

These are copies. **The repo is authoritative** — when a doc changes here, re-push it;
don't edit the copy in the design project.
