"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { likeProgram, unlikeProgram } from "@/services/programs.service";
import { useAuth } from "@/hooks/useAuth";

interface LikeEntry {
  liked: boolean;
  count: number;
}

interface LikesContextValue {
  likedPrograms: Map<string, LikeEntry>;
  isLiked: (programId: string) => boolean;
  getLikeCount: (programId: string) => number | undefined;
  toggleLike: (programId: string, currentCount: number) => Promise<void>;
  isLoading: boolean;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [likedPrograms, setLikedPrograms] = useState<Map<string, LikeEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLikedPrograms();
  }, []);

  const loadLikedPrograms = async () => {
    try {
      const stored = localStorage.getItem("liked-programs");
      if (stored) {
        const parsed = JSON.parse(stored);
        const entries: [string, LikeEntry][] = Object.entries(parsed).map(([id, val]) => {
          // Handle old format (number) and new format ({ liked, count })
          if (typeof val === "number") {
            return [id, { liked: true, count: val }];
          }
          return [id, val as LikeEntry];
        });
        setLikedPrograms(new Map(entries));
      }
    } catch (error) {
      console.error("Failed to load liked programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isLiked = useCallback(
    (programId: string) => {
      return likedPrograms.get(programId)?.liked ?? false;
    },
    [likedPrograms]
  );

  const getLikeCount = useCallback(
    (programId: string) => {
      return likedPrograms.get(programId)?.count;
    },
    [likedPrograms]
  );

  const toggleLike = async (programId: string, currentCount: number) => {
    const current = likedPrograms.get(programId);
    const wasLiked = current?.liked ?? false;
    const newCount = wasLiked ? currentCount - 1 : currentCount + 1;
    const newEntry: LikeEntry = { liked: !wasLiked, count: newCount };

    // Optimistic update
    setLikedPrograms((prev) => {
      const next = new Map(prev);
      next.set(programId, newEntry);
      return next;
    });

    // Persist to localStorage
    setLikedPrograms((prev) => {
      localStorage.setItem("liked-programs", JSON.stringify(Object.fromEntries(prev)));
      return prev;
    });

    try {
      if (wasLiked) {
        await unlikeProgram(programId, getToken);
      } else {
        await likeProgram(programId, getToken);
      }
    } catch (error) {
      // Revert optimistic update on error
      const revertEntry: LikeEntry = { liked: wasLiked, count: currentCount };
      setLikedPrograms((prev) => {
        const next = new Map(prev);
        next.set(programId, revertEntry);
        localStorage.setItem("liked-programs", JSON.stringify(Object.fromEntries(next)));
        return next;
      });

      console.error("Failed to toggle like:", error);
    }
  };

  return (
    <LikesContext.Provider value={{ likedPrograms, isLiked, getLikeCount, toggleLike, isLoading }}>
      {children}
    </LikesContext.Provider>
  );
}

// Hook to use likes for a specific program
export function useLikes(programId: string, initialCount: number = 0) {
  const context = useContext(LikesContext);
  const [mounted, setMounted] = useState(false);

  if (!context) {
    throw new Error("useLikes must be used within LikesProvider");
  }

  const { getLikeCount, isLiked: contextIsLiked, toggleLike: contextToggleLike } = context;

  // Only check liked state after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentCount = mounted ? (getLikeCount(programId) ?? initialCount) : initialCount;

  return {
    likeCount: currentCount,
    isLiked: mounted ? contextIsLiked(programId) : false,
    toggleLike: () => contextToggleLike(programId, currentCount),
  };
}
