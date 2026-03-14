# Dagskrárbankinn — Program Catalog (`/program`)

Implementation spec for the program catalog view. A developer should be able to build this page from this document.

## Purpose

Provide a browsable, filterable catalog of programs displayed as a responsive grid of cards. Users discover programs, filter by criteria, search by name/description, and click through to program details.

## Route

`/program` — Program catalog listing  
`/program/{id}` — Program detail view (separate spec)

---

## Data Model

Programs inherit from the shared `Content` base table. The full shape of a program record is:

### Content (base — all programs inherit these fields)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID | no | PK |
| `content_type` | enum | no | always `program` here |
| `name` | str (500) | no | min 1 char |
| `description` | str (2000) | yes | |
| `equipment` | JSONB (list) | yes | list of equipment strings |
| `instructions` | str (5000) | yes | |
| `duration` | str (50) | yes | e.g. "45 mín", "2 klst" |
| `prep_time` | str (50) | yes | |
| `age` | AgeGroup[] | yes | enum array — see values below |
| `location` | str (255) | yes | |
| `count` | int | yes | ≥ 0, number of participants |
| `price` | int | yes | ≥ 0 |
| `created_at` | datetime (tz) | no | auto |
| `author_id` | UUID → users.id | no | FK |
| `deleted_at` | datetime (tz) | yes | soft-delete |

### Program (extends Content)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID → content.id | no | PK + FK CASCADE |
| `image` | str (500) | yes | image URL |
| `workspace_id` | UUID → workspaces.id | no | FK CASCADE |

### Relationships
- `author` — user who created the program
- `comments`
- `content_tags` / `tags` — array of tag objects `{ id, name, color? }`

### AgeGroup enum values

| Value | Display |
|-------|---------|
| `Hrefnuskátar` | Hrefnuskátar |
| `Drekaskátar` | Drekaskátar |
| `Fálkaskátar` | Fálkaskátar |
| `Dróttskátar` | Dróttskátar |
| `Rekkaskátar` | Rekkaskátar |
| `Róverskátar` | Róverskátar |
| `Vættaskátar` | Vættaskátar |

---

## Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│  🔍 Search...                                              [42 dagskrár] │
├─────────────────┬────────────────────────────────────────────────┤
│                 │                                                │
│  FILTERS        │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  ─────────────  │  │  Card   │  │  Card   │  │  Card   │     │
│                 │  └──────────┘  └──────────┘  └──────────┘     │
│  Aldurshópur    │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  □ Hrefnuskátar │  │  Card   │  │  Card   │  │  Card   │     │
│  □ Drekaskátar  │  └──────────┘  └──────────┘  └──────────┘     │
│  □ Fálkaskátar  │                                                │
│  □ Dróttskátar  │                                                │
│  □ Rekkaskátar  │                [ Load More ]                  │
│  □ Róverskátar  │                                                │
│  □ Vættaskátar  │                                                │
│                 │                                                │
│  Merki          │                                                │
│  □ Útivist      │                                                │
│  □ Föndur       │                                                │
│  □ Hópefli      │                                                │
│  ...            │                                                │
│                 │                                                │
│  Tímalengd      │                                                │
│  □ < 30 mín     │                                                │
│  □ 30–60 mín    │                                                │
│  □ 1–2 klst     │                                                │
│  □ > 2 klst     │                                                │
│                 │                                                │
│  Undirbúningur  │                                                │
│  □ < 15 mín     │                                                │
│  □ 15–30 mín    │                                                │
│  □ > 30 mín     │                                                │
│                 │                                                │
│  Staðsetning    │                                                │
│  [ text input ] │                                                │
│                 │                                                │
│  Þátttakendur   │                                                │
│  Min: [____]    │                                                │
│  Max: [____]    │                                                │
│                 │                                                │
│  Verð           │                                                │
│  □ Frítt        │                                                │
│  □ Með kostnað  │                                                │
│                 │                                                │
│  [Hreinsa síur] │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

- Search bar spans full width at the top, results count aligned to the right.
- Sidebar filters fixed on the left, scrollable independently if content is long.
- Program grid fills the remaining right-hand space.
- Sidebar width: ~260–280px fixed; grid takes the rest.
- "Load More" button or infinite scroll at the bottom of the grid.

### Responsive behavior

| Breakpoint | Layout |
|------------|--------|
| ≥1200px | Sidebar + 3-column grid |
| ≥900px | Sidebar + 2-column grid |
| ≥600px | Sidebar collapses to "Síur" button → drawer/sheet; 2-column grid |
| <600px | Sidebar drawer; 1-column grid |

On mobile (<600px):
- Search bar remains visible at the top.
- Sidebar collapses — "Síur" button opens a full-height drawer with all filters.
- Active filter count shown on the button: "Síur (3)".

---

## Filter Panel

All filters are multi-select checkboxes unless noted otherwise. Filters are additive within a group (OR) and restrictive across groups (AND). Filters sync to URL query params for shareability.

### Filters

| Filter | Field | Type | Behavior |
|--------|-------|------|----------|
| Search | `name`, `description` | Text input | Debounced 300ms; full-width above grid; URL param: `q` |
| Aldurshópur | `age` | Multi-select checkboxes | All 7 AgeGroup enum values; URL param: `age` (comma-separated) |
| Merki | `tags` | Multi-select checkboxes | Dynamic list from API; URL param: `tags` (comma-separated IDs) |
| Tímalengd | `duration` | Multi-select bucketed ranges | < 30 mín / 30–60 mín / 1–2 klst / > 2 klst; URL param: `duration` |
| Undirbúningstími | `prep_time` | Multi-select bucketed ranges | < 15 mín / 15–30 mín / > 30 mín; URL param: `prep_time` |
| Höfundur | `author_name` | Inline autocomplete text input | startsWith match against known author names; filter only applied on explicit accept (Tab/ArrowRight/Enter) or clear — never on partial input; URL param: `author` |
| Búnaður | `equipment` | Multi-select inline autocomplete | startsWith match; Tab/ArrowRight/Enter toggles item and clears input; active count shown in section header; URL param: `equipment` (comma-separated) |
| Staðsetning | `location` | Text input | Partial match; URL param: `location` |
| Þátttakendur | `count` | Min/max number inputs | URL params: `count_min`, `count_max` |
| Verð | `price` | Multi-select | Frítt (price = 0) / Með kostnað (price > 0); URL param: `price` |

### Filter State

- Persist all filter state in URL query params — shareable and bookmarkable.
- On page load, read from URL and apply immediately.
- On filter change, replace URL state (not push) to avoid polluting history.
- "Hreinsa síur" button visible only when at least one filter is active; resets everything.
- Active filter count shown in mobile "Síur" button.

### Results Count

- Display: `"42 dagskrár"` or `"Engar dagskrár fundust"` when empty.
- Shown top-right of the grid area, next to the search bar.
- Wrapped in `aria-live="polite"` region — updates announced to screen readers.

---

## Program Card Component

### Structure

```text
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │                       │  │
│  │       [Image]         │  │
│  │                       │  │
│  └───────────────────────┘  │
│  Title of Program           │
│  Short description text...  │
│  ┌─────┐ ┌─────┐ ┌─────┐    │
│  │ Tag │ │ Tag │ │ Tag │    │
│  └─────┘ └─────┘ └─────┘    │
│  🧒 Dróttskátar · 45 mín   │
└─────────────────────────────┘
```

### Card Data Fields (from model)

| Field | Source | Display |
|-------|--------|---------|
| `name` | content.name | Title — max ~60 chars, truncate with ellipsis |
| `description` | content.description | Max 2 lines (~120 chars), truncate |
| `image` | programs.image | Cover image; placeholder if null |
| `tags` | content_tags | Small chips with tag color or `--color-tag-bg` |
| `age` | content.age | AgeGroup enum array — show all values, comma separated or as chips |
| `duration` | content.duration | Shown in footer row |
| `prep_time` | content.prep_time | Shown in footer row if present |
| `count` | content.count | Shown if present, e.g. "8–24 þátttakendur" |
| `price` | content.price | "Frítt" if 0, "X kr." if > 0; hidden if null |
| `location` | content.location | Shown if present |

### Card States

- **Default**: Normal display with subtle border/shadow.
- **Hover**: Elevated shadow, slight scale (1.02), cursor pointer. Respect `prefers-reduced-motion`.
- **Focus**: Visible focus ring using `--color-focus-ring` token.
- **Loading**: Skeleton placeholder — animated shimmer, same dimensions as real card.

### Card Styling

- Tokens: `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-focus-ring`
- Border radius: `--radius-md`
- Image aspect ratio: 16:9, consistent across all cards
- Tags: chips with tag's `color` field if present, else `--color-tag-bg`
- Age groups: if multiple, show all (Dróttskátar, Rekkaskátar)

---

## Data Fetching

### API Endpoint

```http
GET /api/programs
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (name, description) |
| `age` | string | Comma-separated AgeGroup enum values |
| `tags` | string | Comma-separated tag IDs |
| `duration` | string | Comma-separated buckets: `short`, `medium`, `long`, `xlong` |
| `prep_time` | string | Comma-separated buckets: `short`, `medium`, `long` |
| `location` | string | Partial match on location field |
| `count_min` | number | Minimum participant count |
| `count_max` | number | Maximum participant count |
| `price` | string | `free` or `paid` |
| `limit` | number | Page size (default: 20) |
| `cursor` | string | Pagination cursor |

Response:

```json
{
  "programs": [
    {
      "id": "abc123",
      "name": "Skógarganga",
      "description": "Stuttur lýsing...",
      "image": "/images/programs/abc123.jpg",
      "tags": [{ "id": "t1", "name": "Útivist", "color": "#4ade80" }],
      "age": ["Dróttskátar", "Rekkaskátar"],
      "duration": "2 klst",
      "prep_time": "15 mín",
      "count": 16,
      "price": 0,
      "location": "Skógur"
    }
  ],
  "nextCursor": "xyz789",
  "totalCount": 42
}
```

### Loading States

- Initial load: skeleton grid (8–12 skeleton cards matching real card dimensions).
- Loading more: existing cards stay; skeleton cards appended, or spinner in "Load More" button.
- Error: Icelandic error message + retry button.

### Empty State

- No results, filters active: `"Engar dagskrár passa við leitarskilyrði."` + `"Hreinsa síur"` link.
- No programs at all: `"Engar dagskrár til."` (+ "Búa til nýja" if user has permission).

---

## Accessibility (WCAG 2.1 AA)

- **Keyboard accessible**: All filters and cards operable via keyboard.
- **Focus visible**: `--color-focus-ring` on all interactive elements.
- **Filter panel**: wrapped in `<form role="search">` or `<div role="search">` with `aria-label="Sía dagskrár"`.
- **Checkboxes**: real `<input type="checkbox">` elements with associated `<label>`.
- **Search input**: `type="search"`, `aria-label="Leita að dagskrá"`.
- **Participant inputs**: labeled "Lágmark þátttakenda" / "Hámark þátttakenda".
- **Results count**: `aria-live="polite"` + `aria-atomic="true"`.
- **Cards**: each card is a `<li>` inside `<ul role="list">`; entire card wrapped in `<a>` for navigation.
- **Card images**: `alt={program.name}` for real images; `alt=""` + `aria-hidden="true"` for placeholders.
- **Load more**: announces `"{n} fleiri dagskrár hlaðið"` via `aria-live` region.
- **Error state**: `role="alert"` on error message.
- **Color contrast**: all text 4.5:1; tag chips 3:1 for non-text.

---

## Icelandic Strings

| Key | Value |
|-----|-------|
| Search placeholder | "Leita að dagskrá..." |
| Results count | "{n} dagskrár" |
| No results | "Engar dagskrár fundust" |
| No results (filtered) | "Engar dagskrár passa við leitarskilyrði." |
| Clear filters link | "Hreinsa síur" |
| No programs at all | "Engar dagskrár til." |
| Mobile filter button | "Síur" / "Síur ({n})" |
| Load more button | "Sækja fleiri" |
| Load more announcement | "{n} fleiri dagskrár hlaðið" |
| Error message | "Villa við að sækja dagskrár. Reyndu aftur." |
| Retry button | "Reyna aftur" |
| Free price | "Frítt" |
| Filter section: age | "Aldurshópur" |
| Filter section: tags | "Merki" |
| Filter section: duration | "Tímalengd" |
| Filter section: prep time | "Undirbúningstími" |
| Filter section: location | "Staðsetning" |
| Filter section: participants | "Þátttakendur" |
| Filter section: author | "Höfundur" |
| Filter section: equipment | "Búnaður" |
| Filter section: price | "Verð" |
| Author placeholder | "Leita eftir höfundi..." |
| Author clear button | "Hreinsa höfund" |
| Equipment placeholder | "Leita að búnaði..." |
| Duration: short | "< 30 mín" |
| Duration: medium | "30–60 mín" |
| Duration: long | "1–2 klst" |
| Duration: xlong | "> 2 klst" |
| Prep: short | "< 15 mín" |
| Prep: medium | "15–30 mín" |
| Prep: long | "> 30 mín" |
| Price: free | "Frítt" |
| Price: paid | "Með kostnað" |
| Min participants | "Lágmark þátttakenda" |
| Max participants | "Hámark þátttakenda" |

---

## Component File Structure

```text
frontend/
  app/
    program/
      page.tsx                     # Main catalog page (server or client component)
      [id]/
        page.tsx                   # Program detail page (separate spec)
  components/
    Program/
      ProgramCard.tsx
      ProgramCard.module.css
      ProgramGrid.tsx
      ProgramGrid.module.css
      ProgramSkeleton.tsx
      ProgramFilterSidebar.tsx     # renamed from FilterBar — now a sidebar
      ProgramFilterSidebar.module.css
```

> Note: `ProgramFilterBar` is renamed to `ProgramFilterSidebar` throughout to reflect the layout change.

---

## Theming

- All visual values from `frontend/app/slodi-tokens.css`.
- Key tokens: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-accent`, `--color-focus-ring`, `--radius-md`, `--shadow-sm`, `--shadow-md`, `--color-tag-bg`.
- Support `prefers-color-scheme` for dark mode readiness.

---

## Things to Implement

- [ ] `ProgramCard` component with all model fields
- [ ] `ProgramGrid` responsive layout (3/2/1 columns)
- [ ] `ProgramFilterSidebar` with all 8 filter controls
- [ ] Full-width search bar above the grid
- [ ] URL query param sync for all filters
- [ ] API integration with `/api/programs` and all query params
- [ ] Pagination (load more)
- [ ] Skeleton loading states
- [ ] Empty state (filtered vs. truly empty)
- [ ] Error state with retry
- [ ] Mobile: sidebar collapses to drawer
- [ ] Accessibility: all requirements above

---

## Nice to Have

- Favorite/bookmark programs
- Recently viewed programs section
- Sort options (newest, alphabetical)
- Saved filter presets
- Quick preview drawer on hover
- Keyboard shortcut `/` to focus search
- Program comparison feature

---

## Implementation Notes

- Use `next/image` for optimized image loading with fallback.
- Debounce search and location text inputs (300ms).
- Duration and prep_time are free-text strings in the DB — bucket them client-side or server-side for filter matching (e.g. parse "45 mín" → `medium` bucket).
- `age` is an array — a program tagged with multiple age groups appears in all matching filters.
- `count` field represents participant capacity, not number of uses.
- Tags are dynamic — fetch available tags from API on page load; do not hardcode.
- Skeleton cards must match real card dimensions exactly to prevent layout shift.
- Sidebar should be scrollable independently on tall viewports.
- Consider SWR or React Query for data fetching with caching and revalidation.