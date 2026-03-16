import { useState, useEffect } from "react";
import { fetchProgramById } from "@/services/programs.service";
import { fetchEventById } from "@/services/events.service";
import { fetchTaskById } from "@/services/tasks.service";
import type { ContentItem } from "@/services/content.service";
import { useAuth } from "@/hooks/useAuth";

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Fetch a content item by ID, trying program → event → task in order.
 * Returns the first successful response.
 */
export function useContentItem(id: string) {
  const { getToken } = useAuth();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!isValidUUID(id)) {
        setError(new Error("Invalid ID format"));
        setItem(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Try each type in sequence — the first 404 triggers the next
        const fetchers = [
          () => fetchProgramById(id, getToken),
          () => fetchEventById(id, getToken),
          () => fetchTaskById(id, getToken),
        ];

        for (const fetcher of fetchers) {
          try {
            const data = await fetcher();
            setItem(data as ContentItem);
            return;
          } catch {
            // try next type
          }
        }

        throw new Error("Content item not found");
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setItem(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, [id, getToken]);

  return { item, isLoading, error, setItem };
}
