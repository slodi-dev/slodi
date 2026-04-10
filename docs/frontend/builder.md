# Builder Module Specification

## 1. Purpose

The `/builder` area enables empowered users (admins, coordinators, advanced editors) to compose, configure, and evolve structured entities in the system (workspaces, programs, events, tasks, content blocks) through an interactive UI that blends hierarchical navigation, drag‑and‑drop layout, metadata editing, and publishing/version control.

## 2. User Personas & Core Intentions

| Persona | Primary Goals | Secondary Needs | Access Level |
|---------|---------------|-----------------|--------------|
| Admin | Shape global taxonomy, manage permissions, enforce standards | Audit history, rollback mistakes | Full |
| Program Coordinator | Build/update programs, schedule events, organize tasks | Reuse templates, monitor progress | Scoped to assigned programs |
| Content Editor | Create/edit content blocks (text, media), tag & attach to events/programs | Preview formatting, asset management | Scoped content editing |
| Analyst (Read/Configure) | View structure & dependencies, propose changes (draft mode) | Diff revisions, comment | Read + Draft |

Key Intent Vocabulary (expressed in UI copy & actions):

- "I want to create a new program from an existing template"
- "I need to attach tasks and deadlines to this event"
- "I want to reorganize the layout of dashboard widgets for this workspace"
- "I need to tag this content so it appears in upcoming event materials"
- "I want to preview and then publish my changes"
- "I need to revert to a prior version"

## 3. Primary Use Cases (Epic → Feature → Atomic Action)

1. Workspace Structuring
   - Define workspace metadata (name, visibility, default dashboards)
   - Assign user & troop access levels
2. Program Composition
   - Create program → phases → events
   - Drag/drop to reorder phases/events
   - Associate tags & content bundles
3. Event Configuration
   - Set scheduling info & constraints
   - Attach tasks & responsible users
   - Link related content (documents, briefs, media)
4. Task & Dependency Management
   - Inline creation of tasks within program/event context
   - Set status, priority, due date
   - Visual dependency chain (simple graph or list)
5. Content Block Assembly
   - Create reusable content blocks (markdown, checklist, media reference)
   - Tagging & linking to program/event
6. Versioning & Publishing
   - Draft vs Published states per entity
   - Compare revisions (diff panels)
   - Rollback / restore previous version
7. Permissions & Roles Matrix
   - Adjust per‑entity granular permissions (view/edit/publish)
   - Inheritance overrides & explicit grants
8. Template System
   - Save configured program or event as template
   - Instantiate new entities from template (with selective overrides)
9. Audit & Activity
   - Timeline of changes per entity
   - Filter by user or action type

## 4. Information Architecture & Route Structure (Next.js App Router)

```txt
/builder                      → Overview dashboard (recent drafts, activity)
/builder/workspaces           → List user-accessible workspaces
/builder/workspaces/[id]      → Workspace editor (tabs: Structure | Permissions | Activity)
/builder/programs             → Program index (filters: status, owner, tags)
/builder/programs/[id]        → Program builder (panels: Tree | Canvas | Inspector | Versions)
/builder/events/[id]          → Event editor (details + tasks + content)
/builder/content               → Content library (search, filter by tag/type)
/builder/content/[id]          → Content block editor (markdown + metadata)
/builder/templates            → Template repository
/builder/templates/[id]       → Template detail & instantiate wizard
```

Supporting modal routes (optional):

- `/builder/programs/[id]/new-event`
- `/builder/events/[id]/add-task`
- `/builder/content/new`

## 5. Component Inventory

Core Layout:

- `BuilderShell` – Top bar (breadcrumbs, search, user context), left rail navigation, main work area.
- `EntityTree` – Hierarchical view of program phases/events with drag/drop.
- `Canvas` – Visual arrangement area (for dashboard layouts or composite views).
- `Palette` – Available element types (task, content block, tag, widget).
- `InspectorPanel` – Context-aware property editor (fields adapt to selected entity type).
- `VersionTimeline` – Scrollable chronological version cards (select to diff/restore).
- `DiffView` – Side-by-side JSON / formatted comparison for versions.
- `PermissionsMatrix` – Grid of roles × actions with toggles.
- `TagSelector` – Multi-select with typeahead + color badges.
- `ContentLibraryPanel` – Searchable list with preview hover.
- `TaskListInline` – Embedded task list with quick add & inline status update.
- `DependencyBadge` – Shows blocked/depends_on indicators.
- `PublishBar` – Draft state indicator, validation warnings, publish action.
- `ActivityFeed` – Chronological events (created, updated, published, reverted).
- `TemplateCard` – Preview of template metadata with instantiate CTA.

Utilities:

- `AutosaveIndicator`
- `ValidationToast` / inline warnings
- `Breadcrumbs`
- `RoleBadge`
- `LoadingSkeletons` for panels

## 6. State Management & Data Layer

Recommended:

- Store: Zustand (lightweight, co-located slices per domain) OR Redux Toolkit if forecasting complex middleware; preference: Zustand for initial iteration.
- Server Calls: React Query (caching, optimistic updates for entity edits, invalidation on publish).
- Version Diffing: Use backend-provided snapshots; compute structural diff client-side (e.g., `jsondiffpatch`).
- Drag/Drop: `@dnd-kit/core` (accessible & flexible) or `react-beautiful-dnd` (legacy). Prefer `dnd-kit`.
- Form handling: `react-hook-form` with Zod schema alignment (mirror backend Pydantic models).

Global Store Domains:

- `workspaceStore`
- `programStore` (tree, selected node, unsaved changes)
- `eventStore` (tasks, scheduling)
- `contentStore` (library cache, current block draft)
- `uiStore` (panels open, selection, modals)
- `versionStore` (loaded versions, current diff)

## 7. Data Contracts (Mapping to Backend Schemas)

Minimal shape (subset for builder context – to refine):

```ts
type Workspace = { id: string; name: string; visibility: 'private'|'org'|'public'; tags: string[]; dashboards: string[]; permissions: PermissionEntry[] };
type Program = { id: string; name: string; status: 'draft'|'published'; phases: Phase[]; tags: string[]; version: number };
type Phase = { id: string; name: string; order: number; events: EventRef[] };
type Event = { id: string; name: string; start: string; end: string; tasks: Task[]; contentIds: string[]; tags: string[]; constraints?: any };
type Task = { id: string; title: string; status: 'todo'|'in_progress'|'done'; due?: string; assignee?: string; dependencies?: string[] };
type ContentBlock = { id: string; type: 'markdown'|'media'|'checklist'; body: string; tags: string[]; version: number; status: 'draft'|'published' };
type VersionMeta = { entityId: string; entityType: string; version: number; createdAt: string; author: string; diffSummary?: string };
```

Align each with backend Pydantic schemas (see existing `schemas/*.py`).

## 8. Interaction Flows (Narrative + Key Steps)

Flow: Create Program from Template

1. User opens `/builder/templates` → selects template.
2. Wizard prompts: name, visibility, initial tags.
3. Instantiation API call → returns new program structure.
4. Auto-open program builder with tree & draft status.
5. User edits phases/events → autosave local, manual save triggers PUT & invalidates query.
6. Publish: validation (no empty required fields) → POST publish endpoint → version increment.

Flow: Add Event & Tasks

1. Select phase in tree → click "Add Event".
2. Modal collects basic metadata (name, start/end).
3. Event appears; user opens Task inline list → quick add tasks.
4. Dependencies set via task row menu.
5. Save updates program structure + tasks in backend.

Flow: Version Rollback

1. Open VersionTimeline → select previous version.
2. DiffView displays changes.
3. Click "Restore" → POST rollback → new version created referencing prior snapshot.
4. Invalidate caches; UI refreshes.

Flow: Content Tagging

1. In content editor, user selects tags (TagSelector with typeahead).
2. Save content block → triggers reindex; associated events/program views show updated tags.

## 9. Validation & Publishing Rules (Initial Set)

- Program must have ≥1 phase and each phase ≥1 event before publish.
- Events must have start ≤ end.
- Tasks in `done` state cannot depend on tasks not `done`.
- Content blocks published must have non-empty body.
- Tag constraints: use existing domain constraints modules to validate (mirror backend logic where feasible client-side for fast feedback).

## 10. Permissions Model (Simplified)

Actions: `view`, `edit`, `structure`, `publish`, `permissions_manage`.

Hierarchy: Workspace → Program → Event → Content (inherit unless overridden).

Matrix UI shows effective & explicit states; saving posts differential changes only.

## 11. Non-Functional Considerations

- Performance: Lazy load versions, virtualize large trees (phases/events > 200).
- Accessibility: Keyboard drag/drop (dnd-kit supports sensors), ARIA labels on inspector fields.
- Internationalization: Prepare strings via central i18n util (future-proof).
- Offline resilience: Local buffer for unsaved edits (Zustand persist middleware).

## 12. Initial Milestone Plan

M1: Spec + route scaffolding + shell + program tree read-only.
M2: Editable program phases/events + autosave + basic validation.
M3: Tasks integration + content linking + tags.
M4: Version timeline + diff + publish workflow.
M5: Permissions matrix + templates.
M6: Rollback + audit stream + performance refinements.

## 13. Open Questions / Risks

- Do we need real-time collaboration (websocket presence)? (Defer.)
- Large diff performance on deep nested structures – may need server-side summarized diffs.
- Concurrency: locking vs merge strategies for simultaneous editors.
- Template evolution versioning – immediate or separate template version domain.

## 14. Immediate Next Actions

1. Confirm data contract subset against backend schemas.
2. Choose state stack (proceed with Zustand + React Query).
3. Scaffold `/builder` page & shell.
4. Implement read-only program tree via existing API endpoints.

---

This document is a living specification; update alongside implementation milestones.
