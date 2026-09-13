/**
 * Permission Utilities
 * Centralized permission checking logic for the application
 */

import type { User } from "@/services/users.service";
import type { Program } from "@/services/programs.service";
import { type WorkspaceRole, hasWorkspaceRole } from "@/services/workspaces.service";

/**
 * Check if the current user is the author/owner of a program
 */
export function isOwner(user: User | null, program: Program): boolean {
  if (!user || !program) return false;
  return user.id === program.author_id;
}

/**
 * Can the current user change this bank item — edit it or delete it?
 *
 * Mirrors `check_content_edit_access` in `backend/app/core/auth.py`. Allowed when
 * the user is a platform admin, a workspace admin (or above), or the item's own
 * author at any workspace role.
 *
 * **The author clause deliberately does not require `editor`.** The bank takes
 * submissions from anyone with an account, so its authors are plain viewers —
 * requiring `editor` would let a leader file an idea and then be unable to fix a
 * typo in it. Equally, `editor` alone is no longer enough to change *someone
 * else's* item; it used to be, which would have meant any member could rewrite
 * anything in an open bank.
 *
 * Editing and deleting are one rule because the backend makes them one rule. If
 * they ever diverge, split this — do not let the two drift apart silently.
 */
function canChangeContent(
  user: User | null,
  content: Program,
  workspaceRole: WorkspaceRole | null | undefined
): boolean {
  if (!user || !content) return false;
  // Platform admins bypass workspace membership entirely
  if (user.permissions === "admin") return true;
  // Everyone else must at least be a member of the workspace
  if (!hasWorkspaceRole(workspaceRole, "viewer")) return false;
  return isOwner(user, content) || hasWorkspaceRole(workspaceRole, "admin");
}

/**
 * Check if the current user can edit (update) a bank item.
 *
 * Backend: `PATCH /programs|events|tasks/{id}` → `check_content_edit_access`.
 */
export function canEditProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  return canChangeContent(user, program, workspaceRole);
}

/**
 * Check if the current user can delete a bank item.
 *
 * Backend: `DELETE /programs|events|tasks/{id}` → `check_content_edit_access`.
 *
 * This used to require workspace `admin`, which meant a leader could file an idea
 * into the open bank and then have no way to take it back. An author can now
 * withdraw their own submission.
 */
export function canDeleteProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  return canChangeContent(user, program, workspaceRole);
}

/**
 * Check if the current user can add content to a workspace.
 *
 * Mirrors `check_content_create_access` in `backend/app/core/auth.py`.
 *
 * **The open bank is the exception, not the new rule.** It takes submissions
 * from anyone with an account — and every account is auto-joined to it as a
 * viewer on first login — so there, membership is enough. Anywhere else `editor`
 * still means what it always did and `viewer` still means read-only: a sveit
 * that adds a co-leader or a parent as a viewer so they can read the plan has
 * not agreed to let them write to it.
 *
 * **This takes the two ids rather than an `isTheBank` flag on purpose.** The
 * backend decides openness by comparing the target workspace against the default
 * one, and a boolean here would have to be supplied correctly by every caller to
 * agree with it. A caller who omitted it would get `editor` — silently closing
 * public submission, with a hidden button and no error anywhere to explain it.
 * The ids are things a caller already has in hand, so there is nothing to forget.
 *
 * Until the default workspace id has loaded, `defaultWorkspaceId` is null and
 * this answers `editor`. That is the right way round: the button appears a beat
 * late rather than appearing and then refusing the click.
 */
export function canCreateProgram(
  workspaceRole: WorkspaceRole | null | undefined,
  workspaceId: string | null | undefined,
  defaultWorkspaceId: string | null | undefined
): boolean {
  const isOpenBank = Boolean(workspaceId) && workspaceId === defaultWorkspaceId;
  return hasWorkspaceRole(workspaceRole, isOpenBank ? "viewer" : "editor");
}

/**
 * Check if the current user can view a bank item.
 *
 * Reading the bank requires an account and workspace membership. There is no
 * anonymous read path and no per-item public flag — opening the bank opened it to
 * *submissions*, not to the open web.
 */
export function canViewProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  if (!user || !program) return false;
  if (user.permissions === "admin") return true;
  return hasWorkspaceRole(workspaceRole, "viewer");
}
