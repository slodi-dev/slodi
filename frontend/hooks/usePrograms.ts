"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPrograms, extractTags, type Program } from "@/services/programs.service";
import { handleApiError } from "@/lib/api-utils";
import { useAuth } from "@/contexts/AuthContext";

type UseProgramsResult = {
  programs: Program[] | null;
  tags: string[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export default function usePrograms(workspaceId: string): UseProgramsResult {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getToken } = useAuth();

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await fetchPrograms(workspaceId, token ?? undefined);
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

  return { programs, tags, loading, error, refetch: loadPrograms };
}

export type { Program };
