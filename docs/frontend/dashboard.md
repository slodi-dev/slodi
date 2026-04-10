# Dashboard Implementation Spec

This spec defines the `/dashboard` view and left navigation so a developer can implement it directly. It aligns with the global header, uses the global color system for theme support, and prioritizes calendar, feed (Veggurinn), quick actions, and notifications. KPI panels are out of scope for now.

## Objectives

- Deliver a clear, scout-themed workspace dashboard optimized for daily action.
- Use global color tokens and CSS variables for dynamic theming.
- Provide accessible navigation and components (WCAG AA).
- Ship in phases: Calendar + Feed → Quick Actions → Notifications.

## Navigation (Left Sidebar)

- Dagskrárbankinn → path `/program` (icon: `calendar`)
- Vinnubekkurinn → path `/builder` (icon: `hammer`; role: admin/editor)
- Veggurinn → path `/social` (icon: `message-square`)
- Separator
- [Avatar] {UserName} → path `/user` (icon: `user-circle`)
- Stillingar → path `/settings` (icon: `settings`)
- Merkin mín → path `/badges` (icon: `award`; shows count badge)

Behavior

- Collapsible nav; icon-only on narrow widths.
- `aria-current="page"` set on active item.
- Avatar shows current user picture and name.

## Routes

- `/dashboard` main view (this spec)
- `/program` Dagskrárbankinn
- `/builder` Vinnubekkurinn (role-gated)
- `/social` Veggurinn
- `/user` User profile
- `/settings` Settings
- `/badges` User badges

## Layout

- Header: Global header unchanged.
- Sidebar: Left nav per above. Visual separator between primary and personal groups.
- Content area (desktop ≥1200px):
  - Row A: Calendar (left), Quick Actions (right)
  - Row B: Veggurinn (feed) full width
  - Notifications: tray via header bell; optional right-side drawer on wide screens
- Content area (tablet ≥768px):
  - Icon-only sidebar; Calendar → Quick Actions stacked; Feed below
- Content area (mobile <768px):
  - Hamburger/drawer nav; modules stacked vertically

## Theme & Color System

- Use global CSS variables from `frontend/app/globals.css` and design tokens from the theme system.
- Example tokens: `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, `--color-muted`.
- Components must reference tokens (not hard-coded colors) and react to theme changes.
- Respect `prefers-color-scheme` where applicable and support runtime theme toggling.

## Components

1. Calendar (Mini Agenda)

- Purpose: show upcoming events (7–30 days) and allow quick creation.
- Inputs: `events[]`, `range`, `selectedDate`.
- Interactions: day click opens agenda drawer; create inline event.
- Accessibility: day cells are buttons with `aria-label` including weekday + date; focus ring visible.

2. Quick Actions

- Purpose: reduce friction for common tasks.
- Buttons: New Task, New Event, New Content, Go to Builder, Go to Program.
- Defaults: current workspace; inferred program/sprint if available.
- Accessibility: buttons are focusable, have text labels and descriptive `aria-label`s.

3. Veggurinn (Feed)

- Purpose: stream of recent updates (tasks, comments, status transitions, content, mentions).
- Inputs: `filters`, `pagination` (`limit`, `cursor`), `workspaceId`.
- Interactions: filter by type; search; open item in drawer; mark comment resolved.
- Accessibility: `aria-live="polite"` for new items; avoid auto-focus shifts.

4. Notifications Tray

- Purpose: actionable alerts (assignments, mentions, due warnings).
- Actions: mark read/unread, mute thread, navigate to resource.
- Accessibility: dialog has focus trap, escape closes, labeled title.

5. Dagskrárbankinn (Program Feed) — `/program`

- Purpose: browsable catalog of programs displayed as a grid/feed of cards; users discover, filter, and select programs.
- Layout: responsive grid of program cards; filter bar at top; search input.

Card Structure:

- Image: program thumbnail/cover image (fallback to placeholder).
- Title: program name (truncated if long).
- Short description: 1–2 lines, truncated with ellipsis.
- Tags: displayed as chips/badges (e.g., "Útivist", "Handverk").
- Age group: target age range (e.g., "9–11 ára").
- Optional: duration, difficulty, season indicator.

Interactions:

- Card click → navigates to program detail view (`/program/{id}`).
- Hover: subtle elevation/shadow; focus ring for keyboard.
- Filter bar: multi-select for tags, age group dropdown, search input.
- Search: filters by name and description (client-side or debounced API).
- Clear filters button to reset.

Filters:

- Age group (dropdown or button group): e.g., 6–8, 9–11, 12–14, 15+.
- Tags (multi-select chips): select one or more tags.
- Search (text input): matches name and description.
- Optional: duration, difficulty, seasonal.

Pagination / Infinite Scroll:

- Load initial batch (e.g., 20 programs).
- Infinite scroll or "Load more" button for additional batches.
- Show skeleton cards while loading.

Accessibility:

- Cards are focusable (`tabindex="0"` or `<a>`/`<button>`).
- Filter controls have visible labels.
- Search input has `aria-label` or associated `<label>`.
- Grid uses `role="list"` or semantic `<ul>` with `<li>` cards.
- Announce filter results count to screen readers (`aria-live`).

## Accessibility Rules (WCAG 2.1 AA)

Reference: [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/) and [A11Y Project Checklist](https://www.a11yproject.com/checklist/)

### Perceivable (Principle 1)

- **Text alternatives (1.1.1)**: All icons have `aria-label` or visually hidden text; images have descriptive `alt`.
- **Color not sole indicator (1.4.1)**: Active/selected states use icons or underlines in addition to color.
- **Contrast minimum (1.4.3)**: Text has at least 4.5:1 contrast ratio; large text 3:1.
- **Non-text contrast (1.4.11)**: Icons and UI controls have at least 3:1 contrast against adjacent colors.
- **Resize text (1.4.4)**: Content remains functional when text is resized up to 200%.
- **Reflow (1.4.10)**: Content reflows without horizontal scrolling at 320px width.
- **Text spacing (1.4.12)**: No content loss when line height, letter spacing, word spacing, or paragraph spacing is increased.

### Operable (Principle 2)

- **Keyboard accessible (2.1.1)**: All functionality operable via keyboard; `Tab` traverses sidebar items; `Enter`/`Space` activates.
- **No keyboard trap (2.1.2)**: Focus can always move away from any component.
- **Skip link (2.4.1)**: Provide "Sleppa í efni" link at top to jump to `main`.
- **Page titled (2.4.2)**: Each route has a descriptive `<title>` (e.g., "Mælaborð — Slóði").
- **Focus order (2.4.3)**: Focus order matches visual layout; skip link → sidebar → main → notifications.
- **Link purpose (2.4.4)**: Link text is descriptive; avoid "click here".
- **Focus visible (2.4.7)**: Visible focus ring on all interactive elements; use `--color-focus-ring` token.
- **Target size (2.5.5)**: Touch targets are at least 44×44 CSS pixels.
- **Pointer cancellation (2.5.2)**: Actions trigger on `mouseup`/`keyup`, not `mousedown`.

### Understandable (Principle 3)

- **Language of page (3.1.1)**: Set `lang="is"` on `<html>` element.
- **On focus (3.2.1)**: Focus does not trigger unexpected context changes.
- **Consistent navigation (3.2.3)**: Sidebar order is consistent across all dashboard views.
- **Error identification (3.3.1)**: Form errors are described in text; not just color.
- **Labels (3.3.2)**: All inputs have visible labels or `aria-label`.

### Robust (Principle 4)

- **Name, role, value (4.1.2)**: Custom components expose correct ARIA roles, states, and properties.
- **Status messages (4.1.3)**: Feed updates and notifications use `aria-live="polite"` or `role="status"` without stealing focus.

### Animation & Motion

- **Reduced motion**: Respect `prefers-reduced-motion` media query; disable or minimize transitions.
- **No flashing (2.3.1)**: Content does not flash more than 3 times per second.

### Landmarks & Structure

- Use `<nav>` or `role="navigation"` for sidebar.
- Use `<main>` for primary content area.
- Use semantic headings (`h1`–`h6`) in logical order.
- Use `<ul>`/`<li>` for sidebar link lists.

## Testing Strategy

- Unit
  - Sidebar routing navigates to correct paths.
  - Feed pagination + filters work and preserve state.
  - Calendar day-click selects date and opens agenda.
- Integration
  - Role-gating hides `Vinnubekkurinn` for non-admins.
  - Notifications mark-as-read updates count.
  - Quick actions prefill workspace defaults.
- Accessibility
  - Keyboard navigation order across sidebar and modules.
  - Axe/Lighthouse audits for labels, landmarks, contrast.
  - Screen reader verification for feed announcements and calendar labels.
- Performance
  - Feed initial load with pagination (e.g., 20 items) under target budget.
  - Calendar prefetch next 30 days within acceptable timing.

## Things to Implement

- Left sidebar navigation (Dagskrárbankinn, Vinnubekkurinn, Veggurinn, User, Stillingar, Merkin mín)
- Mini Calendar component with event display and day selection
- Veggurinn (Feed) component with filtering and pagination
- Quick Actions bar (New Task, New Event, New Content, Go to Builder, Go to Program)
- Notifications tray with mark-read and navigation actions
- Role-gating for Vinnubekkurinn (admin/editor only)
- Responsive layout (desktop, tablet, mobile breakpoints)
- Global color token integration for dynamic theming
- Skip link and focus management
- Skeleton loaders for async content

## Ideas for Nice to Have

- Badge count on Merkin mín (dynamic)
- Saved layout presets / dashboard customization
- Inline event creation from calendar
- Search within feed
- User presence indicators (who is online)
- Drag-to-reorder quick actions
- Notification digest mode (batch alerts)
- Dark mode support (via theme tokens)
- Keyboard shortcuts for power users (e.g., `g d` → go to dashboard)
- Activity heatmap or event density indicator on calendar

## Implementation Notes

- Use existing global header; do not duplicate actions.
- Read workspace context to scope queries (calendar, feed).
- Persist filters in URL query or local storage.
- Use suspense/skeleton loaders with token-based colors.
