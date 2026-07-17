# Feature Spec: Tag Management

**Status:** Draft
**Date:** 2026-03-15
**Target users:** Users with workspace `editor` role (or higher)

---

## Overview

A dedicated Tag Management page where editors can create, rename, and delete tags. Tags are simple name-only entities that apply to content (programs, events). All interactions happen inline — no modals.

---

## 1. Permissions Model

### Backend

Tags already have CRUD endpoints in `backend/app/routers/tags.py` gated by `require_permission(Permissions.member)` (platform-level). For tag management, we tighten this to **workspace editors**:

| Action     | Current guard        | Proposed guard                      |
| ---------- | -------------------- | ----------------------------------- |
| List tags  | Public (cached)      | No change — all users can read tags |
| Create tag | `Permissions.member` | Keep as-is (any member can create)  |
| Rename tag | `Permissions.member` | Keep as-is                          |
| Delete tag | `Permissions.member` | Keep as-is                          |

The backend already enforces `Permissions.member` for mutations. No backend changes are needed.

### Frontend

The tag management **page** is gated on the frontend by workspace role. Following the pattern in `DashboardSidebar.tsx` where `roleRequired` controls nav visibility:

```typescript
// Only users with editor+ workspace role see the nav item and can access the page
if (!hasWorkspaceRole(role, "editor")) → redirect or show "no access" message
```

This mirrors how the programs page uses `canCreateProgram(workspaceRole)` which checks `hasWorkspaceRole(role, "editor")`.

---

## 2. Data Model

### Existing — no changes needed

The `Tag` model and `ContentTag` join table already exist:

**`backend/app/models/tag.py`**

```
Tag
├── id: UUID (PK, default uuid4)
├── name: str (String(50), unique, min 1 char)
├── deleted_at: datetime | None (SoftDeleteMixin)
└── content_tags → list[ContentTag]

ContentTag (composite PK: content_id + tag_id)
├── content_id: UUID (FK → content.id, CASCADE)
├── tag_id: UUID (FK → tags.id, CASCADE)
├── content → Content
└── tag → Tag
```

**Domain constraints** (`backend/app/domain/tag_constraints.py`):

- `NAME_MIN = 1`
- `NAME_MAX = 50`

Tags relate to `Content` (the polymorphic base for Program, Event, Task) via the `ContentTag` join table. This means tags already apply to events/activities — no schema migration required.

---

## 3. API Endpoints

All endpoints already exist in `backend/app/routers/tags.py`. The tag management page consumes them as-is:

| Method   | Path                      | Purpose                   | Auth                   | Status |
| -------- | ------------------------- | ------------------------- | ---------------------- | ------ |
| `GET`    | `/tags?q=&limit=&offset=` | List/search tags (cached) | Any authenticated user | Exists |
| `POST`   | `/tags`                   | Create tag                | `Permissions.member`   | Exists |
| `PATCH`  | `/tags/{tag_id}`          | Rename tag                | `Permissions.member`   | Exists |
| `DELETE` | `/tags/{tag_id}`          | Soft-delete tag           | `Permissions.member`   | Exists |

### Existing error handling

- **409 Conflict** on duplicate name (create or rename) — service catches `IntegrityError`
- **404 Not Found** if tag doesn't exist (get, rename, delete)
- **422 Unprocessable Entity** on validation failure (Pydantic)

### Frontend service

`frontend/services/tags.service.ts` already has all the functions:

```typescript
fetchTags(query?, token?)    // GET /tags
createTag(input)             // POST /tags
updateTag(id, name)          // PATCH /tags/{id}
deleteTag(id)                // DELETE /tags/{id}
```

No new API work or service functions are needed.

---

## 4. SideNav Integration

**File:** `frontend/components/DashboardSidebar/DashboardSidebar.tsx`

Add a new nav item in the **secondary** group (alongside "Greining" and "Stjórnun"):

```typescript
{
  label: "Merkimiðar",        // Icelandic for "Tags"
  path: "/tags",
  icon: Tags,                 // from lucide-react (already used in codebase)
  roleRequired: "editor",     // Hidden from viewers
  group: "secondary",
}
```

**Placement:** After "Greining" (Analytics), before "Stjórnun" (Admin). This groups management tools together.

**Visibility rules** (existing DashboardSidebar logic):

- `roleRequired: "editor"` → visible to users with workspace role `editor`, `admin`, or `owner`
- Platform admins see everything (synthetic `owner` role from backend)
- `viewer` users do not see the nav item

---

## 5. Page Layout and Behaviour

**Route:** `/tags` → `frontend/app/tags/page.tsx`

### Layout

```
┌─────────────────────────────────────────────┐
│  Merkimiðar                    [+ Nýr merki]│  ← Page header + create input
│  ┌─────────────────────────────────────────┐│
│  │ 🔍 Leita að merkimiðum...               ││  ← Search (debounced)
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ merkimiði-1              [Breyta][Eyða] ││  ← Tag row (view mode)
│  │ [____________________]   [Vista][Hætta] ││  ← Tag row (edit mode)
│  │ merkimiði-2              [Breyta][Eyða] ││
│  │ merkimiði-3              [Breyta][Eyða] ││
│  │ ...                                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Sýni 1–20 af 47           [< Fyrri][Næsta>]│  ← Pagination
└─────────────────────────────────────────────┘
```

### Interactions

#### Create

1. User types tag name into the create input field at the top.
2. Submits via Enter key or clicking the "Bæta við" (Add) button.
3. On success: input clears, new tag appears in list, success feedback shown.
4. On 409 (duplicate): inline error message below input — "Merkimiði með þessu nafni er þegar til" (Tag with this name already exists).
5. On validation error: inline error — "Nafn verður að vera 1–50 stafir" (Name must be 1–50 characters).

#### Rename (inline edit)

1. User clicks "Breyta" (Edit) button on a tag row.
2. Tag name becomes an editable input field, pre-filled with current name.
3. "Breyta"/"Eyða" buttons become "Vista" (Save) / "Hætta" (Cancel).
4. Submit via Enter or "Vista" button.
5. Cancel via Escape or "Hætta" button.
6. On 409 (duplicate): inline error next to input.
7. Only one tag can be in edit mode at a time. Starting an edit on another tag cancels the current one.

#### Delete

1. User clicks "Eyða" (Delete) button.
2. Row changes to confirmation state: "Ertu viss?" (Are you sure?) with "Já, eyða" (Yes, delete) / "Hætta við" (Cancel) buttons. This follows the pattern from `UserManagement.tsx` (inline confirmation, no modal).
3. If tag is in use (associated with content), show count: "Þessi merkimiði er á X dagskrám. Ertu viss?" (This tag is on X programs. Are you sure?).
4. On confirm: soft-deletes tag, row removed from list.
5. Deletion is soft (sets `deleted_at`), so tags can be recovered.

#### Search

1. Debounced text input (300ms, matching `SearchInput` pattern).
2. Sends `q` parameter to `GET /tags?q=...` (backend already supports `ilike` search, min 2 chars).
3. Shows result count with `aria-live="polite"` region.
4. Clear button appears when input has value.

#### Pagination

1. Uses existing `GET /tags` `limit`/`offset` query params.
2. Backend returns `X-Total-Count` and `X-Total-Pages` headers (existing `add_pagination_headers` pattern).
3. Page size: 20 tags per page.

---

## 6. Component Breakdown

```
frontend/
├── app/tags/
│   ├── page.tsx                    # Page component (server → client boundary)
│   └── components/
│       ├── TagManagement.tsx       # Main client component ("use client")
│       ├── TagManagement.module.css
│       ├── TagRow.tsx              # Single tag row (view/edit/delete states)
│       ├── TagRow.module.css
│       ├── TagCreateInput.tsx      # Create input with validation
│       └── TagCreateInput.module.css
├── hooks/
│   └── useTags.ts                  # Already exists — extend if needed
└── services/
    └── tags.service.ts             # Already exists — no changes
```

### Component responsibilities

**`page.tsx`**

- Server component shell.
- Renders `<TagManagement />`.

**`TagManagement.tsx`** (~150–200 lines)

- Client component. Owns state: `tags[]`, `search`, `editingId`, `deletingId`, `isLoading`, `error`.
- Fetches tags via `useTags()` hook or direct service calls.
- Checks workspace role via `useWorkspaceRole()` — redirects viewers.
- Renders search input, create input, tag list, pagination.
- Pattern reference: `UserManagement.tsx` (328 lines, similar structure).

**`TagRow.tsx`** (~80–100 lines)

- Three visual states: **view**, **edit**, **delete-confirm**.
- Props: `tag`, `isEditing`, `isDeleting`, `onEdit`, `onSave`, `onDelete`, `onCancel`.
- Edit state: controlled input with local `editName` state.
- Delete state: inline confirmation with content count.

**`TagCreateInput.tsx`** (~50–60 lines)

- Controlled input + submit button.
- Local validation (empty, length).
- Shows inline error on failure.
- Clears on success.

---

## 7. Validation Rules

### Frontend (immediate feedback)

| Rule            | Validation                 | Error message (Icelandic)     |
| --------------- | -------------------------- | ----------------------------- |
| Empty name      | `name.trim().length === 0` | "Nafn má ekki vera tómt"      |
| Too long        | `name.length > 50`         | "Nafn má mest vera 50 stafir" |
| Whitespace-only | `name.trim().length === 0` | "Nafn má ekki vera tómt"      |

### Backend (authoritative)

| Rule             | Layer                                       | Response     |
| ---------------- | ------------------------------------------- | ------------ |
| Min length 1     | Pydantic `StringConstraints(min_length=1)`  | 422          |
| Max length 50    | Pydantic `StringConstraints(max_length=50)` | 422          |
| Strip whitespace | Pydantic `str_strip_whitespace=True`        | Auto-trimmed |
| Unique name      | DB unique constraint → `IntegrityError`     | 409          |
| Exists           | Repository `.get()` check                   | 404          |

Frontend trims whitespace before submission to match backend behaviour (`str_strip_whitespace`).

---

## 8. Edge Cases

| Scenario                      | Handling                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Duplicate name on create**  | Backend returns 409. Frontend shows inline error: "Merkimiði með þessu nafni er þegar til".                                                                                                        |
| **Duplicate name on rename**  | Same 409 handling. Show error next to the edit input.                                                                                                                                              |
| **Rename to same name**       | Frontend skips API call if trimmed name is unchanged.                                                                                                                                              |
| **Delete tag in use**         | Allowed. Soft-delete removes it from future queries. Existing `ContentTag` rows remain but the tag won't appear in listings (soft-delete filter). Optionally show usage count before confirmation. |
| **Empty input**               | Submit button disabled. No API call.                                                                                                                                                               |
| **Whitespace-only input**     | Treated as empty after trim.                                                                                                                                                                       |
| **Rapid double-click create** | Disable button and input during API call (loading state).                                                                                                                                          |
| **Concurrent edits**          | Last write wins (standard for this codebase). If a 404 is returned on rename/delete, show "Merkimiði fannst ekki" and refresh the list.                                                            |
| **Search with < 2 chars**     | Backend requires `q` to be at least 2 chars. Frontend can show all tags for empty/1-char queries (unfiltered fetch).                                                                               |
| **Tag cache invalidation**    | Backend already invalidates `tags_cache` on create/update/delete. Frontend refetches after mutations.                                                                                              |
| **Pagination during search**  | Reset to page 1 when search query changes.                                                                                                                                                         |
| **No tags exist**             | Show empty state: "Engir merkimiðar fundust. Búðu til fyrsta merkimiðann!" with the create input still visible.                                                                                    |

---

## 9. Accessibility

Following existing patterns from `SearchInput`, `UserManagement`, and `CollapsibleSection`:

- Tag list rendered as `<table>` or `<ul>` with semantic markup.
- Edit/delete buttons have `aria-label` including tag name (e.g., `aria-label="Breyta merkimiða: Útivera"`).
- Edit input gets `aria-label="Nýtt nafn merkimiða"`.
- Search input uses `role="searchbox"` with debounced `aria-live="polite"` result count.
- Delete confirmation announced via `role="alert"`.
- Keyboard: Enter submits, Escape cancels edit, Tab navigates between rows.
- Focus management: after create, focus returns to create input. After edit/delete, focus moves to next logical element.

---

## 10. Implementation Order

1. **`app/tags/page.tsx`** — Page shell with role gate.
2. **`TagCreateInput.tsx`** — Create flow (simplest interaction).
3. **`TagRow.tsx`** — View + edit + delete states.
4. **`TagManagement.tsx`** — Compose everything with search, list, pagination.
5. **DashboardSidebar update** — Add "Merkimiðar" nav item.
6. **Test manually** — Create, rename, delete, search, edge cases.

No backend work, no migrations, no new API endpoints. This is a frontend-only feature consuming existing API.
