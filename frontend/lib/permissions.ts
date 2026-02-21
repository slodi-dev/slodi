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
 * Check if the current user can edit (update) a program.
 *
 * Backend requires workspace role >= "admin" for PATCH /programs/{id}.
 * Authors also retain the right to edit their own programs if they have at
 * least editor access (they created it, so they must have had editor+).
 *
 * @param user          - current authenticated user
 * @param program       - program to check
 * @param workspaceRole - the user's role in the program's workspace (null = not a member)
 */
export function canEditProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  if (!user || !program) return false;
  // Platform admins can always edit (they bypass workspace membership entirely)
  if (user.permissions === "admin") return true;
  // Workspace admins and owners can always edit
  if (hasWorkspaceRole(workspaceRole, "admin")) return true;
  // Authors can edit their own programs if they still have at least editor access
  if (isOwner(user, program) && hasWorkspaceRole(workspaceRole, "editor")) return true;
  return false;
}

/**
 * Check if the current user can delete a program.
 *
 * Backend requires workspace role >= "admin" for DELETE /programs/{id}.
 */
export function canDeleteProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  if (!user || !program) return false;
  // Platform admins can always delete
  if (user.permissions === "admin") return true;
  return hasWorkspaceRole(workspaceRole, "admin");
}

/**
 * Check if the current user can create a program in a workspace.
 *
 * Backend requires workspace role >= "editor" for POST /workspaces/{id}/programs.
 */
export function canCreateProgram(
  workspaceRole: WorkspaceRole | null | undefined
): boolean {
  return hasWorkspaceRole(workspaceRole, "editor");
}

/**
 * Check if the current user can view a program.
 * Public programs can be viewed by anyone.
 * Private programs require workspace membership.
 */
export function canViewProgram(
  user: User | null,
  program: Program,
  workspaceRole: WorkspaceRole | null | undefined = null
): boolean {
  if (program.public) return true;
  if (!user) return false;
  return hasWorkspaceRole(workspaceRole, "viewer");
}
