import { useCallback, useEffect, useRef, useState } from "react";
import { getMyWorkspaceRole, type WorkspaceMembership, type WorkspaceRole } from "@/services/workspaces.service";
import { useAuth } from "@/hooks/useAuth";

type UseWorkspaceRoleResult = {
  role: WorkspaceRole | null;
  membership: WorkspaceMembership | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Fetch the current user's workspace role for a given workspace.
 * Returns null role when the user is not a member or when workspaceId is falsy.
 */
export function useWorkspaceRole(workspaceId: string | null | undefined): UseWorkspaceRoleResult {
  const { getToken, isLoading: authLoading } = useAuth();
  const [membership, setMembership] = useState<WorkspaceMembership | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchedId = useRef<string | null>(null);

  const fetch = useCallback(async () => {
    if (!workspaceId) {
      setMembership(null);
      return;
    }

    // Avoid re-fetching the same workspace unnecessarily
    if (lastFetchedId.current === workspaceId) return;

    const token = await getToken();
    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyWorkspaceRole(workspaceId, token);
      setMembership(result);
      lastFetchedId.current = workspaceId;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load workspace role"));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, getToken]);

  useEffect(() => {
    if (!authLoading) {
      lastFetchedId.current = null; // reset cache when workspaceId changes
      fetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, authLoading]);

  return {
    role: membership?.role ?? null,
    membership,
    isLoading,
    error,
  };
}
