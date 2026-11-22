"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUnreviewedCount } from "@/services/moderation.service";
import { hasPermission } from "@/services/users.service";

interface UnreviewedCountValue {
  count: number;
  refresh: () => Promise<void>;
}

const UnreviewedCountContext = createContext<UnreviewedCountValue>({
  count: 0,
  refresh: async () => {},
});

/** What waits on Yfirferð, for the sidebar. Only moderators ask; a failed request shows no badge. */
export function UnreviewedCountProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const pathname = usePathname();
  const isModerator = hasPermission(user?.permissions, "moderator");
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
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
    void refresh();
  }, [refresh, pathname]);

  return (
    <UnreviewedCountContext.Provider value={{ count, refresh }}>
      {children}
    </UnreviewedCountContext.Provider>
  );
}

export function useUnreviewedCount(): UnreviewedCountValue {
  return useContext(UnreviewedCountContext);
}
