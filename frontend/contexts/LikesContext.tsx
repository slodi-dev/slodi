"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { likeProgram, unlikeProgram } from "@/services/programs.service";
import { useAuth } from "@/hooks/useAuth";

interface LikeEntry {
  liked: boolean;
  count: number;
}

interface LikesContextValue {
  initLike: (id: string, liked: boolean, count: number) => void;
  isLiked: (id: string) => boolean;
  getLikeCount: (id: string) => number | undefined;
  toggleLike: (id: string, currentCount: number) => Promise<void>;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [likes, setLikes] = useState<Map<string, LikeEntry>>(new Map());

  const initLike = useCallback((id: string, liked: boolean, count: number) => {
    setLikes((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, { liked, count });
      return next;
    });
  }, []);

  const isLiked = useCallback((id: string) => likes.get(id)?.liked ?? false, [likes]);

  const getLikeCount = useCallback((id: string) => likes.get(id)?.count, [likes]);

  const toggleLike = useCallback(
    async (id: string, currentCount: number) => {
      const wasLiked = likes.get(id)?.liked ?? false;
      const newEntry: LikeEntry = {
        liked: !wasLiked,
        count: wasLiked ? currentCount - 1 : currentCount + 1,
      };

      setLikes((prev) => {
        const next = new Map(prev);
        next.set(id, newEntry);
        return next;
      });

      try {
        if (wasLiked) await unlikeProgram(id, getToken);
        else await likeProgram(id, getToken);
      } catch {
        setLikes((prev) => {
          const next = new Map(prev);
          next.set(id, { liked: wasLiked, count: currentCount });
          return next;
        });
      }
    },
    [likes, getToken]
  );

  return (
    <LikesContext.Provider value={{ initLike, isLiked, getLikeCount, toggleLike }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes(programId: string, initialCount: number, initialLiked = false) {
  const context = useContext(LikesContext);
  if (!context) throw new Error("useLikes must be used within LikesProvider");

  const {
    initLike,
    isLiked: contextIsLiked,
    getLikeCount,
    toggleLike: contextToggleLike,
  } = context;

  useEffect(() => {
    initLike(programId, initialLiked, initialCount);
  }, [programId, initialLiked, initialCount, initLike]);

  const currentCount = getLikeCount(programId) ?? initialCount;

  return {
    likeCount: currentCount,
    isLiked: contextIsLiked(programId),
    toggleLike: () => contextToggleLike(programId, currentCount),
  };
}
