"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchUnreviewedCount } from "@/services/moderation.service";
import { useAuth } from "@/contexts/AuthContext";
import { type UserPermissions, hasPermission } from "@/services/users.service";

/**
 * How much is waiting on the Yfirferð board, for the sidebar badge.
 *
 * Returns 0 rather than throwing when the fetch fails. A badge is an
 * invitation, not a source of truth: a moderator who sees no number goes to
 * the board and finds the queue, whereas a sidebar that error-boundaries out
 * takes the whole navigation with it.
 *
 * Only moderators are asked for. Everyone else never calls the endpoint —
 * partly because it would 403, and partly because how much sits unreviewed is
 * a fact about the bank that a member has no business reading.
 */
export function useUnreviewedCount(userPermissions?: UserPermissions): number {
  const [count, setCount] = useState(0);
  const { getToken } = useAuth();
  const isModerator = hasPermission(userPermissions, "moderator");

  const load = useCallback(async () => {
    if (!isModerator) {
      setCount(0);
      return;
    }
    try {
      setCount(await fetchUnreviewedCount(getToken));
    } catch {
      setCount(0);
    }
  }, [isModerator, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  return count;
}
