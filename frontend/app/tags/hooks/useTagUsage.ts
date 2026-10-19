"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTagUsageCount } from "@/services/tags.service";

/**
 * How many items carry each of `ids`, fetched for the tags on screen and kept
 * while the page is open. A count that fails to load stays unknown (null).
 */
export function useTagUsage(ids: string[]) {
  const { getToken } = useAuth();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const idsKey = ids.join(",");

  useEffect(() => {
    const missing = idsKey ? idsKey.split(",").filter((id) => !(id in counts)) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(
      missing.map((id) =>
        fetchTagUsageCount(id, getToken)
          .catch(() => null)
          .then((count) => [id, count] as const)
      )
    ).then((pairs) => {
      if (!cancelled) setCounts((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
    // `counts` is left out on purpose: a count landing must not start another round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getToken]);

  /** For a tag this page just made: nothing uses it yet. */
  const setCount = useCallback(
    (id: string, count: number) => setCounts((prev) => ({ ...prev, [id]: count })),
    []
  );

  return { counts, setCount };
}
