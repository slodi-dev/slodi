"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPrograms } from "@/services/programs.service";
import { fetchEvents } from "@/services/events.service";
import { fetchTasks } from "@/services/tasks.service";
import type { ContentItem } from "@/services/content.service";
import { handleApiError } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

type UseContentItemsResult = {
  items: ContentItem[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export default function useContentItems(workspaceId: string | null): UseContentItemsResult {
  const { getToken } = useAuth();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [programs, events, tasks] = await Promise.all([
        fetchPrograms(workspaceId, getToken),
        fetchEvents(workspaceId, getToken),
        fetchTasks(workspaceId, getToken),
      ]);
      setItems([...programs, ...events, ...tasks]);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch content");
      setError(new Error(errorMessage));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, refetch: load };
}
