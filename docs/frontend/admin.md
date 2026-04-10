# Admin Module Specification

## 1. Purpose

The `/admin` area provides privileged users a centralized control surface for governance: managing users and roles, configuring permissions & constraints, adjusting system settings, reviewing audit trails, curating taxonomies & templates, and accessing operational analytics. It should be reliable, auditable, performance-conscious, and minimally disruptive to end-user workflows.

## 2. Personas & Intentions

| Persona | Goals | Secondary Intentions | Notes |
|---------|-------|----------------------|-------|
| Super Admin | Full platform oversight; manage global settings & critical roles | Respond to escalations quickly | Highest privilege |
| Security Admin | Enforce permission model, review audit anomalies | Rotate secrets / revoke access | Focused on integrity |
| Content Admin | Curate taxonomies, templates, default dashboards | Ensure consistency across workspaces | Limited security scope |
| Analytics Admin | Monitor usage, performance KPIs, adoption metrics | Identify optimization opportunities | Read-heavy + export |

Key intent phrasing:

- "I need to grant a new role with limited publish rights"
- "I want to review all permission changes this week"
- "I must adjust a system setting and log the reason"
- "I need to bulk import users into a workspace"
- "I want to see adoption stats for the builder module"

## 3. Primary Use Cases

1. User Management
   - List, filter, search users; view status (active/inactive/pending)
   - Bulk invite/import (CSV) with validation preview
   - Deactivate / force password reset (future security integration)
2. Role & Permission Administration
   - Create/edit roles (grouped capabilities)
   - Assign roles to users (workspace or global scope)
   - Visual permissions matrix (capabilities vs roles) with diff preview before save
3. Permission Overrides
   - Apply entity-specific overrides (e.g., program-level publish rights)
   - Audit diff of effective vs assigned permissions
4. Taxonomy & Template Curation
   - Manage tags/categories (merge, rename, deprecate)
   - Approve or update program/event templates
5. System Settings
   - Feature flags & rollout phases
   - Retention policies (content, audit logs)
   - Performance thresholds / limits (max tasks per program, etc.)
6. Audit & Compliance
   - Filterable audit log (actor, action, entity, timestamp)
   - Export selected range (CSV/JSON)
   - Highlight anomaly indicators (spikes in permission changes)
7. Analytics & Observability
   - Dashboard panels: user growth, active programs, task completion rates
   - Drill-down filters (time ranges, workspace, program type)
8. Operational Actions
   - Reindex content (queued background task)
   - Clear caches / trigger sync jobs

## 4. Information Architecture & Routes (Next.js App Router)

```txt
/admin                     → Overview dashboard (quick stats + recent audit items)
/admin/users               → User list & bulk operations
/admin/users/[id]          → User detail (roles, recent activity)
/admin/roles               → Role list
/admin/roles/[id]          → Role editor (permissions, members)
/admin/permissions         → Matrix / override explorer
/admin/taxonomy            → Tag/category management
/admin/templates           → Template list & lifecycle
/admin/settings            → System settings forms
/admin/audit               → Audit log viewer
/admin/analytics           → Analytics panels
/admin/operations          → Reindex / maintenance actions
```

Modal routes:

- `/admin/users/import`
- `/admin/roles/new`
- `/admin/settings/feature-flags`
- `/admin/audit/export`

## 5. Component Inventory

- `AdminShell` – Layout with side navigation, top breadcrumbs, context actions
- `UserTable` – Paginated, searchable, selectable rows
- `UserDetailPanel`
- `RoleList` / `RoleCard`
- `RoleEditorForm`
- `PermissionMatrix` – Grid with action toggles and summary diff
- `PermissionDiffSidebar`
- `TaxonomyManager` – Tag CRUD + merge/rename flows
- `TemplateList` / `TemplateEditor`
- `SettingsForm` (segmented sections)
- `AuditLogViewer` – Virtualized log with filters + export
- `AnalyticsPanels` – Collection of charts (lazy-loaded)
- `OperationsPanel` – Buttons / status indicators for maintenance tasks
- `FeatureFlagToggle`
- `BulkImportWizard`

Utilities:

- `SearchBar`
- `FilterChips`
- `RoleBadge`
- `LoadingSkeletonRow`
- `PaginationControls`
- `DateRangePicker`
- `ExportButton`
- `ChartWrapper`

## 6. State Management & Data Layer

React Query for server synchronization (users, roles, audit, analytics snapshots). Zustand slices for ephemeral UI states (selection, import wizard steps, matrix editing buffer).

Stores:

- `adminUserStore` – selected users, bulk actions state
- `roleStore` – active role being edited, unsaved permission changes
- `permissionStore` – matrix filters, diff state
- `auditStore` – current filter set & highlight rules
- `analyticsStore` – selected time range, dashboard layout preferences
- `operationsStore` – task statuses (reindexing, cache clear)

React Query Keys (examples):

- `['admin','users',filters]`
- `['admin','user',userId]`
- `['admin','roles']`
- `['admin','role',roleId]`
- `['admin','permissions','matrix']`
- `['admin','audit',auditFilters]`
- `['admin','analytics','summary',dateRange]`
- `['admin','settings']`

Optimistic Patterns:

- Role permission toggles buffered locally; commit triggers PUT; optimistic diff preview
- Tag rename optimistic; rollback if conflict
- Feature flag toggle immediate UI reflection; revert on failure with toast

## 7. Data Contracts (Draft Types)

```ts
type AdminUser = { id: string; displayName: string; email: string; status: 'active'|'inactive'|'pending'; roles: RoleRef[]; lastActiveAt?: string };
type RoleRef = { id: string; name: string };
type Role = { id: string; name: string; description?: string; permissions: PermissionAssignment[]; userCount: number };
type PermissionAssignment = { capability: string; scope: 'global'|'workspace'|'program'; allowed: boolean };
type PermissionOverride = { entityType: string; entityId: string; capability: string; userId?: string; roleId?: string; allowed: boolean };
type AuditEvent = { id: string; actorId: string; actorDisplay?: string; action: string; entityType?: string; entityId?: string; timestamp: string; diff?: any; severity?: 'info'|'warn'|'critical' };
type SystemSetting = { key: string; value: string|number|boolean; updatedAt: string; updatedBy: string };
type FeatureFlag = { key: string; enabled: boolean; description?: string; rollout?: { percentage?: number; segments?: string[] } };
type AnalyticsSnapshot = { rangeStart: string; rangeEnd: string; metrics: Record<string, number>; breakdowns?: Record<string, any> };
type MaintenanceTaskStatus = { task: string; startedAt?: string; completedAt?: string; status: 'idle'|'running'|'success'|'error'; message?: string };
```

## 8. Interaction Flows

Flow: Create Role & Assign Permissions

1. Admin opens `/admin/roles` → clicks new role.
2. Fills basic metadata (name, description).
3. PermissionMatrix loads capabilities grouped by domain.
4. Toggles permissions (local buffer); diff sidebar updates.
5. Saves role → POST; invalidates roles list; audit event recorded.
6. Assign role to users via UserTable bulk selection.

Flow: Bulk User Import

1. Opens import modal → uploads CSV (validated client-side).
2. Preview table showing parsed rows & issues.
3. Confirms → POST batch create; progress feedback.
4. Results summary; failed rows downloadable; audit events generated per create.

Flow: Permission Override

1. Navigates to `/admin/permissions` → selects entity & capability filter.
2. Adds override (user or role) → local diff.
3. Commits changes; backend stores override entries; audit records diffs.

Flow: Audit Review

1. Opens `/admin/audit`; applies date range + action filter.
2. Scrolls virtualized list; selects an event to view diff.
3. Exports selected events (CSV) → triggers file download.

Flow: Settings Change

1. Opens `/admin/settings`; edits retention days value.
2. Save → PUT setting; optimistic UI update with rollback on failure.
3. Audit entry created with previous & new values.

Flow: Analytics Drill Down

1. Opens `/admin/analytics`; picks last 30 days range.
2. Panels load baseline metrics; selects a program category filter.
3. Charts update; user exports snapshot.

Flow: Maintenance Task (Reindex)

1. Visits `/admin/operations`; clicks "Reindex Content".
2. Task status updates to running; poll or websocket updates progress.
3. Completion transitions status; success toast + audit event.

## 9. Permissions Model (Admin Scope)

- Capabilities grouped: `users.manage`, `roles.manage`, `permissions.override`, `settings.edit`, `audit.read`, `analytics.read`, `operations.run`, `taxonomy.manage`, `templates.manage`.
- Super Admin implicitly has all; Security Admin excludes content/template domains.
- Fine-grained overrides always audited.

## 10. Non-Functional Considerations

- Performance: Virtualize large user lists & audit logs; server-side pagination.
- Accessibility: Keyboard navigation for matrix; descriptive aria-labels on toggles.
- Observability: Frontend error boundaries around analytics charts; log fetch latency for admin endpoints (instrumentation hook later).
- Security: CSRF protection, rate limit bulk operations, strict server-side verification of permission changes.
- Data Integrity: Use ETag or version identifiers on settings to avoid lost updates.

## 11. Milestones

M1: Spec + `/admin` shell + users read-only + roles list.
M2: Role creation + permission matrix editing.
M3: User bulk import + assignment flows.
M4: Overrides explorer + audit viewer.
M5: Settings + feature flags + taxonomy management.
M6: Analytics panels (core metrics) + operations tasks.
M7: Hardening (performance, security, anomaly indicators).

## 12. Open Questions

- Do analytics require real-time streaming or periodic batch?
- Retention period configuration per workspace or global only?
- Should feature flags support gradual rollout by user segment?
- Are permission overrides hierarchical (inherit precedence) or strict last-write wins?

## 13. Immediate Next Actions

1. Confirm capability taxonomy with backend.
2. Scaffold `/admin` route & shell placeholder.
3. Implement read-only user & role listing using existing endpoints (or mock).
4. Define endpoint spec for audit filtering & permission diff operations.

---

Living document – evolve with implementation.
