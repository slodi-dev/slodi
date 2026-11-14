"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllTags, type Tag } from "@/services/tags.service";

export type TagListStatus = "loading" | "ready" | "error";

/**
 * Every tag in the bank, loaded once, then kept in step with this page's own
 * create, rename and delete from the server's replies rather than refetched.
 */
export function useTagList(enabled: boolean) {
  const { getToken } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<TagListStatus>("loading");
  // Only the newest load may land; a slow first one must not overwrite a retry.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setStatus("loading");
    try {
      const all = await fetchAllTags(getToken);
      if (id !== requestId.current) return;
      setTags(all);
      setStatus("ready");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const add = useCallback((tag: Tag) => setTags((all) => [...all, tag]), []);
  const replace = useCallback(
    (tag: Tag) => setTags((all) => all.map((t) => (t.id === tag.id ? tag : t))),
    []
  );
  const remove = useCallback((id: string) => setTags((all) => all.filter((t) => t.id !== id)), []);

  return { tags, status, retry: load, add, replace, remove };
}
