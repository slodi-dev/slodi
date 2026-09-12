"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPrograms, extractTags, type Program } from "@/services/programs.service";
import { handleApiError } from "@/lib/api-utils";
import { useAuth } from "@/hooks/useAuth";

type UseProgramsResult = {
  /** How many the bank holds, not how many were fetched. */
  total: number | null;
  programs: Program[] | null;
  tags: string[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export default function usePrograms(workspaceId: string | null): UseProgramsResult {
  const { getToken } = useAuth();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  /** How many the bank holds, not how many were fetched. */
  const [total, setTotal] = useState<number | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPrograms = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: data, total: count } = await fetchPrograms(workspaceId, getToken);
      setTotal(count);
      setPrograms(data);
      setTags(extractTags(data));
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch programs");
      setError(new Error(errorMessage));
      setPrograms([]);
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, getToken]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  return { programs, tags, total, loading, error, refetch: loadPrograms };
}

export type { Program };
