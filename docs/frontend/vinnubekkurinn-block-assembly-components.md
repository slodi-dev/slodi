# Vinnubekkurinn — block-assembly component brainstorm

**Status:** Brainstorm / component inventory (pre-spec)
**Date:** 2026-07-25
**Scope:** The *assemble-a-dagskrá-from-blocks* surface on `/builder` (Vinnubekkurinn).
**Primary ticket:** [sc-48 B4](https://app.shortcut.com/sl-6/story/48) — *Templates = fixed frame + fill-in blanks (copy-and-edit, never frozen)*.
**Neighbours it must play with:** [sc-44 B1](https://app.shortcut.com/sl-6/story/44) (beinagrind + puzzle-in blocks), [sc-46 B2](https://app.shortcut.com/sl-6/story/46) (type-aware "create…" launcher), [sc-47 B3](https://app.shortcut.com/sl-6/story/47) (blocks carry context), [sc-51 B7](https://app.shortcut.com/sl-6/story/51) (zero-prep handoff).

> **Reading order.** This doc does **not** re-derive the model or the wider builder
> module. Read first: [ADR-002](../tharfagreining2/adr-002-event-typing-and-grid.md)
> (the block model + typed events + slot sets), [planner.md](../features/planner.md)
> (the planning spine), and [builder.md](./builder.md) (the broader `/builder` spec —
> this doc is the *block-assembly slice* of §5 "Component Inventory" there, drilled
> down). Where this disagrees with the old builder.md on the assembly surface, prefer
> this doc; it is written against the confirmed ADR-002 model.

---

## 0. The one principle that shapes every component

**Drag-and-drop is an *accelerator*, never the only path.** Every structural action —
add a block, remove it, reorder it, move it between slots — must be reachable by
keyboard and by an on-screen button, with no mouse drag required. Leaders plan on
laptops, tablets, and phones, and some use keyboards or assistive tech. So each
draggable thing below is specified as **two interfaces over one state change**:

| Action | Pointer (accelerator) | Keyboard / button (source of truth) |
|---|---|---|
| Add a block from the library | drag library item → slot | focus item → **Enter/"Bæta við"** → inserts into focused slot / at cursor |
| Reorder blocks | drag block up/down | **Space to grab → ↑/↓ → Space to drop**, *or* per-block **▲/▼** buttons |
| Move block between slots | drag across slots | grab → **←/→** or "Færa í…" menu |
| Remove a block | drag to trash / hover ✕ | focus block → **Delete/"Fjarlægja"** button |
| Insert between two blocks | drop on the gap | **"+ Setja hér"** affordance that appears on focus/hover of the gap |

This is cheaper than it sounds because **`@dnd-kit`'s keyboard sensor gives us the
grab→move→drop loop for free** (see §5). The work is the button affordances and the
live-region announcements — which we'd want for a good pointer experience anyway.

---

## 1. What the components manipulate (data shapes)

Grounded in ADR-002 §3–§4 and the existing polymorphic `Content` model
(`backend/app/models/content.py`). These are the *builder-context* view types, to be
aligned with the Pydantic schemas as the backend lands (`is_template`, `order_index`,
timing and status are ADR-002 build items, **not yet in the schema**).

```ts
// The frame being assembled — a single fundur/event (or, fractally, a camp/day).
type AssemblyFrame = {
  id: string;
  eventType: 'skipulags' | 'sveitar' | 'flokks' | 'uppskeru' | 'dagsferd'; // ADR-002 amended enum
  scope: 'troop-wide' | 'per-flokkur';
  slots: Slot[];                 // the beinagrind: an ordered set of typed slots
  isTemplate: boolean;           // B4: this frame can be cloned-with-blanks
};

// A slot = one position in the beinagrind. Type-driven defaults (setning/dagskrá/
// leikur/slit/endurmat for meetings) but editable (ADR-002 "editable defaults").
type Slot = {
  id: string;
  kind: 'setning' | 'dagskra' | 'leikur' | 'slit' | 'endurmat' | 'custom';
  label: string;
  required: boolean;             // a required-but-empty slot is a "blank to fill" (B4)
  block: BlockInstance | null;   // null = blank slot
};

// A block placed in a slot = a dagskrárliður (the code's Task, + ADR-002 additions).
type BlockInstance = {
  id: string;
  templateId: string | null;     // provenance: cloned from which library block
  name: string;
  themeParam?: string;           // ADR-002 §4: generic block re-skinned by a theme
  aeska?: string[];              // þroskasvið / ÆSKA envelope tags (latent, low-prio)
  status: 'tentative' | 'draft' | 'confirmed' | 'undecided'; // incl. the "?" marker
  durationMin?: number;          // per-element timing (ADR-002 build gap)
  venue?: string;
  spanWeeks?: number;            // multi-week spanning (badge Part 1/2)
  endurmat?: EndurmatNote | null;// travels with reuse (ADR-002 §4)
  orderIndex: number;            // ADR-002 build gap — real ordering
};

// A reusable library block — legó that carries its context (B3), not a bare activity.
type BlockTemplate = Omit<BlockInstance, 'id' | 'orderIndex' | 'status'> & {
  id: string;
  category: string;              // content_type / tag-derived
  isParametrised: boolean;       // generic block + theme overlay (ADR-002 §4)
};
```

---

## 2. Page anatomy (three panes over one model)

```txt
┌───────────────────────────────────────────────────────────────────────────┐
│  AssemblyHeader   [ fundur name · type · scope ]     [Vista draft] [Afrita] │
├──────────────┬────────────────────────────────────────────┬────────────────┤
│              │                                             │                │
│ BlockPalette │              AssemblyCanvas                 │ BlockInspector │
│ (library)    │              (the beinagrind)               │ (selected block│
│              │                                             │  properties)   │
│ ▸ search     │   ┌─ Slot: Setning ───────────────────┐    │                │
│ ▸ category   │   │  [BlockCard: "Fánahylling"]  ▲▼✕⋯ │    │  name          │
│   tabs       │   └───────────────────────────────────┘    │  theme param   │
│              │        · + Setja hér ·  (InsertAffordance)  │  status ▾      │
│ [drag me] ⇢  │   ┌─ Slot: Leikur (BLANK — fylla út) ──┐   │  timing        │
│ [drag me] ⇢  │   │  ⌷ Slepptu blokk hér / Bæta við ⌷  │   │  venue         │
│              │   └───────────────────────────────────┘    │  endurmat      │
│ [+ Búa til]  │   ┌─ Slot: Slit ──────────────────────┐    │                │
│ (B2 launcher)│   │  [BlockCard: "Kvöldbæn"]     ▲▼✕⋯ │    │                │
│              │   └───────────────────────────────────┘    │                │
└──────────────┴────────────────────────────────────────────┴────────────────┘
                     ↑ LiveRegionAnnouncer (visually hidden) narrates every move
```

On phone/tablet the three panes collapse to tabs or a bottom-sheet palette; the
canvas is the default view (leaders work on meetings there — ADR-002 §2).

---

## 3. Component inventory

Grouped by pane. **Reuse** column = what already exists in the design system
(`components/`, `components/ui/`, `Button`, `Modal`, `Alert`, lucide-react icons,
`sl-*` tokens per [DESIGN-TOKEN-STANDARDS](./DESIGN-TOKEN-STANDARDS.md)) so we build
new things on top rather than from scratch.

### A. The assembly canvas (the beinagrind)

| Component | Responsibility | Reuse / notes |
|---|---|---|
| `AssemblyCanvas` | Owns the `<DndContext>`, renders the ordered `Slot`s as a `SortableContext`, wires sensors + collision + announcements. | new; wraps dnd-kit |
| `SlotFrame` | One slot: header (kind label + required badge), and either a `BlockCard` or a `BlankSlot`. A **droppable**. | `CollapsibleSection` (ui/) for the header pattern |
| `BlockCard` | A placed block. Shows name, `StatusPill`, timing/venue chips, and the block's action controls. A **draggable + sortable** item. | `ActiveChip` (ui/) for chips; `Button variant="ghost"` for actions |
| `BlankSlot` | The *fill-in blank* (B4's whole point). A dashed drop target that doubles as an **"Bæta við…" button** and shows what kind of block belongs here. | `Button variant="secondary"` + dashed token border |
| `InsertAffordance` | The "+ Setja hér" control that appears in the **gap between blocks** on hover/focus — the button-path equivalent of dropping into a gap. | `Button variant="ghost"` + `Plus` icon |
| `DragOverlay` / `BlockGhost` | The floating preview that follows the cursor / keyboard-grab; keeps layout stable during drag. | dnd-kit `<DragOverlay>` |
| `RequiredSlotWarning` | Inline marker when a required slot is still blank (feeds B4 "highlight the blanks" + publish validation). | `Alert` (subtle inline variant) |

### B. The block library / palette

| Component | Responsibility | Reuse / notes |
|---|---|---|
| `BlockPalette` | Left rail: search + category tabs + scrollable list of library blocks. | mirrors `FilterSidebar` / `ProgramFilters` |
| `PaletteSearch` | Typeahead over the block bank. | `filters/SearchInput` |
| `BlockLibraryItem` | A **draggable source**; on keyboard, an **"Bæta við"** button that inserts into the focused/next-blank slot. Shows the block's carried context (theme, ÆSKA) so it's "grabbable" (B3). | `ProgramCard` is the visual ancestor; slim it down |
| `TypeAwareCreateLauncher` | The "+ Búa til…" launcher that offers create options by content type (B2 — sc-46). Opens the right create form. | `Button variant="primary"` + `Modal` |
| `PaletteEmptyState` | "Ekkert fannst" + create CTA. | existing empty-state pattern in `/builder/page.tsx` |

### C. Editing / inspector

| Component | Responsibility | Reuse / notes |
|---|---|---|
| `BlockInspector` | Context-aware property editor for the selected block; fields adapt to block kind. | `react-hook-form` + `zod` (already deps) |
| `ThemeParamField` | Sets the theme parameter that re-skins a generic block (ADR-002 §4 parametrised blocks). | select/typeahead |
| `TimingField` | Per-element duration (ADR-002 build gap). | `ui/RangeInput` |
| `StatusPill` / `StatusSelect` | Renders + edits `tentative/draft/confirmed/undecided`, including the first-class **"?"** marker (ADR-002 §3). | `ActiveChip` for display; small menu for edit |
| `VenueField` | Location per fundur. | plain input |
| `EndurmatNote` | Attach/read the endurmat that travels with reuse (ADR-002 §4; D1/D2). | `Modal` or inline panel |

### D. Controls & accessibility primitives (the a11y backbone)

| Component | Responsibility | Reuse / notes |
|---|---|---|
| `BlockActionsMenu` | Per-block **⋯** menu: Move up/down, Move to slot…, Duplicate, Remove, Insert above/below. The full non-drag path to every structural change. | `Modal`/popover + `Button variant="ghost"` rows |
| `MoveControls` | Always-visible **▲ / ▼** buttons on each `BlockCard` (the cheapest, most discoverable reorder for keyboard + touch). | `Button variant="ghost"` + `ChevronUp/Down` |
| `LiveRegionAnnouncer` | Visually-hidden `aria-live="assertive"` region that narrates grabs/moves/drops ("Fánahylling gripin. Staða 1 af 3. Notaðu örvatakka."). Fed by dnd-kit's `announcements` API + our button actions. | new; small |
| `KeyboardDragHint` | Contextual hint shown when a block gains focus ("Ýttu á bil til að grípa"). | tooltip pattern |
| `DragHandle` | Explicit handle (`GripVertical` icon) so dragging is intentional and the card stays clickable/selectable. | lucide icon + dnd-kit `useSortable` listeners scoped to it |

### E. Shell & state

| Component | Responsibility | Reuse / notes |
|---|---|---|
| `AssemblyProvider` | Holds the frame state, applies structural mutations (one reducer both DnD and buttons call → guarantees parity), exposes `move/insert/remove/duplicate`. | React context or Zustand (builder.md's pick) |
| `AutosaveIndicator` | Draft-save status (B4 = copy-and-edit drafts; A8 progressive detailing). | listed in builder.md §5 |
| `AssemblyHeader` | Frame name/type/scope, **"Afrita sniðmát"** (clone-with-blanks — the B4 backend `POST /programs/{id}/copy` extension), Save. | `Button` variants |

> **View switching (grid · timeline · calendar) is out of scope here** — that's A4
> (sc-39) / the three projections in ADR-002 §2. This doc is only the *inside* of one
> frame's assembly. Design `AssemblyCanvas` so it can be embedded in any of the three
> later.

---

## 4. The single-reducer rule (why parity is cheap)

Both the drag layer and the buttons/menus dispatch the **same** small set of intents
against `AssemblyProvider`:

```ts
type AssemblyIntent =
  | { t: 'insert'; block: BlockTemplate; slotId: string; at: number }
  | { t: 'move';   blockId: string; toSlotId: string; toIndex: number }
  | { t: 'remove'; blockId: string }
  | { t: 'duplicate'; blockId: string }
  | { t: 'setStatus'; blockId: string; status: BlockInstance['status'] };
```

dnd-kit's `onDragEnd` translates a drop into a `move`/`insert`; a **▼** click
translates to the same `move`. There is one code path to test, and accessibility can
never silently diverge from the pointer behaviour — the thing you flagged.

---

## 5. Drag-and-drop: the library and how we use it

**Recommendation: `@dnd-kit`** (`@dnd-kit/core` + `@dnd-kit/sortable` +
`@dnd-kit/accessibility`). builder.md already leans this way, and the deciding factor
is accessibility: dnd-kit ships a **`KeyboardSensor`** and an **`announcements`** API,
so the keyboard grab→move→drop loop and screen-reader narration are first-class, not
bolted on. `react-beautiful-dnd` is effectively unmaintained; native HTML5 DnD has poor
touch + a11y support. It's the **only new runtime dependency** this surface needs.

- **Sensors:** `PointerSensor` (mouse/touch, with an activation distance so taps still
  select), `KeyboardSensor` (arrow-key movement), `TouchSensor` tuning for phones.
- **Draggables:** `BlockLibraryItem` (source, copy semantics) and `BlockCard`
  (sortable within/between slots).
- **Droppables:** every `SlotFrame` and each gap (`InsertAffordance` position).
- **`DragOverlay`** for a stable ghost; keep the underlying card mounted.
- **Custom `announcements`** in Icelandic, routed through `LiveRegionAnnouncer`.

---

## 6. Accessibility checklist (acceptance-level)

- [ ] Every block can be **added, reordered, moved, and removed with keyboard only** —
      no drag required.
- [ ] Every block has **visible ▲/▼ move buttons** and a **⋯ actions menu** (touch +
      keyboard path).
- [ ] Blocks list uses correct semantics (`role="list"`/`listitem`; dnd-kit
      announcements rather than the deprecated `aria-grabbed`).
- [ ] **Focus is preserved** across a move (focus follows the block to its new index).
- [ ] Grab / move / drop / cancel each produce an **`aria-live` announcement**.
- [ ] Drag handle is a **real focusable control** with an `aria-label`; the card stays
      independently selectable.
- [ ] Blank/required slots are conveyed **non-visually** (label + `aria-describedby`),
      not by dashed border alone (B4 "highlight the blanks" must be perceivable).
- [ ] All controls meet contrast + hit-target size via `sl-*` tokens; honour
      `prefers-reduced-motion` for drag animations.
- [ ] Everything works at 200% zoom and in the mobile single-column layout.

---

## 7. New dependency & open questions

**New dependency:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/accessibility`.
(Confirm before adding — it's the one thing here that grows the bundle.)

**Open questions for the team:**
1. **State lib** — plain React context/reducer for v1, or Zustand now (builder.md §6)?
   Lean context/reducer for the first slice; the single-reducer rule makes migration cheap.
2. **Cross-slot vs within-slot moves** — do meeting slots allow arbitrary block types,
   or does each slot kind constrain what can drop in it? (Affects droppable validation.)
3. **Clone-with-blanks UX** — after "Afrita sniðmát", do we land on the copy with
   required-but-empty slots highlighted and focus on the first blank? (B4 core flow.)
4. **Where do backend `is_template` / `order_index` / status / timing land** — these
   are ADR-002 build items the components assume; sequence FE against those migrations.
5. **Does `AssemblyCanvas` need to render inside the grid/timeline (A4) at v1**, or can
   it ship standalone first and be embedded later?

## 8. Suggested smallest-useful slice (for sequencing)

1. `AssemblyProvider` + intents + a static `AssemblyCanvas` rendering slots/blocks
   (no DnD) with **▲/▼ + ✕ + BlankSlot "Bæta við"** — fully keyboard/button usable.
2. `BlockPalette` + `BlockLibraryItem` add-via-button into slots.
3. Layer dnd-kit on top (pointer + keyboard sensor) reusing the same intents.
4. `BlockInspector` (status, timing, theme param).
5. `AssemblyHeader` "Afrita sniðmát" (clone-with-blanks) → closes the B4 loop.

Steps 1–2 already deliver a working, accessible assembler; DnD in step 3 is pure
acceleration over proven state.

---

*Living document — update alongside the B-cluster build. Supersedes the assembly
portion of [builder.md](./builder.md) §5.*
