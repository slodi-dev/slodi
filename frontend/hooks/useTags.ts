"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTags, createTag as createTagApi, type Tag } from "@/services/tags.service";
import { handleApiError } from "@/lib/api-utils";
import { useAuth } from "@/contexts/AuthContext";

type UseTagsResult = {
  tags: Tag[] | null;
  tagNames: string[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createTag: (name: string) => Promise<Tag | null>;
};

export function useTags(query?: string): UseTagsResult {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getToken } = useAuth();

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await fetchTags(query, token ?? undefined);
      setTags(data);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch tags");
      setError(new Error(errorMessage));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [query, getToken]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const createTag = useCallback(async (name: string): Promise<Tag | null> => {
    try {
      const newTag = await createTagApi({ name });
      await loadTags(); // Refresh the list
      return newTag;
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to create tag");
      setError(new Error(errorMessage));
      return null;
    }
  }, [loadTags]);

  const tagNames = tags ? tags.map(tag => tag.name) : null;

  return { 
    tags,
    tagNames,
    loading,
    error,
    refetch: loadTags,
    createTag 
  };
}
