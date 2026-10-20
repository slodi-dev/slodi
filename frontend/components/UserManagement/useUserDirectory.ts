"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  adminDeleteUser,
  adminUpdateUser,
  listAllUsers,
  UserRequestError,
  type User,
  type UserPermissions,
} from "@/services/users.service";
import {
  getWorkspaceMembers,
  setWorkspaceMemberRole,
  type WorkspaceRole,
} from "@/services/workspaces.service";

export type DirectoryStatus = "loading" | "ready" | "error";

/** No token means the session has gone; the request is refused like a 401. */
async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) throw new UserRequestError(401, "No authentication token available");
  return token;
}

/**
 * Every user, and each one's role in the shared programme bank, loaded once and
 * then kept in step with this page's own changes from the server's replies.
 *
 * The bank roles load on their own, once the bank's id is known, so the user
 * list never reloads under a save. `bankRoles` stays null until they're in (or
 * if they fail): the page then leaves the bank section out rather than show
 * everyone as having no role.
 *
 * TODO(sc-640): status/freeze, join and last-seen dates and the change history
 * aren't in the API yet; they'd load here alongside the users.
 */
export function useUserDirectory(enabled: boolean, bankWorkspaceId: string | null) {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [bankRoles, setBankRoles] = useState<Record<string, WorkspaceRole> | null>(null);
  const [status, setStatus] = useState<DirectoryStatus>("loading");
  const [error, setError] = useState<unknown>(null);
  // Only the newest load may land; a slow first one must not overwrite a retry.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setStatus("loading");
    try {
      const all = await listAllUsers(await requireToken(getToken));
      if (id !== requestId.current) return;
      setUsers(all);
      setStatus("ready");
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err);
      setStatus("error");
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !bankWorkspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await getWorkspaceMembers(bankWorkspaceId, await requireToken(getToken));
        if (!cancelled) setBankRoles(Object.fromEntries(members.map((m) => [m.user_id, m.role])));
      } catch {
        // The bank roles are extra: without them the page still manages permissions.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, bankWorkspaceId, getToken]);

  /** Saves a platform permission and returns the user as the server now has them. */
  const setPermission = useCallback(
    async (userId: string, permissions: UserPermissions) => {
      const token = await requireToken(getToken);
      const updated = await adminUpdateUser(token, userId, { permissions });
      setUsers((all) =>
        all.map((u) => (u.id === userId ? { ...u, permissions: updated.permissions } : u))
      );
      return updated;
    },
    [getToken]
  );

  /** Saves a role in the bank. Someone with no role yet becomes a member with it. */
  const setBankRole = useCallback(
    async (userId: string, role: WorkspaceRole) => {
      if (!bankWorkspaceId) throw new UserRequestError(404, "No default workspace");
      const token = await requireToken(getToken);
      const updated = await setWorkspaceMemberRole(bankWorkspaceId, userId, role, token);
      setBankRoles((all) => ({ ...all, [userId]: updated.role }));
      return updated.role;
    },
    [getToken, bankWorkspaceId]
  );

  /** Deletes a user. The backend can't undo it. */
  const deleteUser = useCallback(
    async (userId: string) => {
      const token = await requireToken(getToken);
      await adminDeleteUser(token, userId);
      setUsers((all) => all.filter((u) => u.id !== userId));
    },
    [getToken]
  );

  return { users, bankRoles, status, error, retry: load, setPermission, setBankRole, deleteUser };
}

export type UserDirectory = ReturnType<typeof useUserDirectory>;
