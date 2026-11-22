"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { fetchProgramById, likeProgram, unlikeProgram } from "@/services/programs.service";
import { useAuth } from "@/hooks/useAuth";

interface LikeEntry {
  liked: boolean;
  count: number;
}

interface LikesContextValue {
  /** Record what the server says. Ignored while this reader's own toggle is in flight. */
  initLike: (id: string, liked: boolean, count: number) => void;
  getLike: (id: string) => LikeEntry | undefined;
  /** `fallback` is what the caller shows when nothing is registered yet. */
  toggleLike: (id: string, fallback: LikeEntry) => Promise<void>;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

/**
 * The like state of every item on screen, shared so a card and the item page
 * agree.
 *
 * Server values always replace what is stored: the item page renders once
 * before its fetch lands, and a first-write-wins map kept that render's
 * "0, not liked" for good (sc-531). The one exception is an item whose like
 * this reader is toggling right now — a fetch that left before the click must
 * not undo the optimistic heart.
 */
export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth();
  const [likes, setLikes] = useState<Map<string, LikeEntry>>(new Map());
  const likesRef = useRef(likes);
  likesRef.current = likes;
  /** Toggles in flight, per item. */
  const pending = useRef(new Map<string, number>());

  /* liked_by_me belongs to a reader. When one signs out or another signs in in
     the same tab, what the last one liked must not carry over. */
  const userId = user?.id ?? null;
  const [owner, setOwner] = useState(userId);
  if (owner !== userId) {
    setOwner(userId);
    if (owner !== null) setLikes(new Map());
  }

  const initLike = useCallback((id: string, liked: boolean, count: number) => {
    setLikes((prev) => {
      if (pending.current.get(id)) return prev;
      const cur = prev.get(id);
      if (cur && cur.liked === liked && cur.count === count) return prev;
      const next = new Map(prev);
      next.set(id, { liked, count });
      return next;
    });
  }, []);

  const getLike = useCallback((id: string) => likes.get(id), [likes]);

  const toggleLike = useCallback(
    async (id: string, fallback: LikeEntry) => {
      const entry = likesRef.current.get(id) ?? fallback;
      const wasLiked = entry.liked;
      const prevCount = entry.count;
      const set = (value: LikeEntry) => {
        setLikes((prev) => {
          const next = new Map(prev);
          next.set(id, value);
          return next;
        });
      };
      const settle = () => {
        const left = (pending.current.get(id) ?? 1) - 1;
        if (left > 0) pending.current.set(id, left);
        else pending.current.delete(id);
      };

      pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
      set({ liked: !wasLiked, count: Math.max(0, wasLiked ? prevCount - 1 : prevCount + 1) });

      try {
        if (wasLiked) await unlikeProgram(id, getToken);
        else await likeProgram(id, getToken);
      } catch {
        set({ liked: wasLiked, count: prevCount });
        settle();
        return;
      }
      settle();

      /* `/content/{id}` is cacheable for a minute, so the browser still holds
         the copy from before this click. A shared link opened in a new tab
         would be served it and show the like undone. Re-fetch past the cache,
         which also replaces the cached copy, and take the server's count. */
      fetchProgramById(id, getToken, { refreshCache: true })
        .then((item) => {
          if (item && typeof item.like_count === "number") {
            initLike(id, Boolean(item.liked_by_me), item.like_count);
          }
        })
        .catch(() => {
          /* The like itself is saved; a stale cache entry is the worst case. */
        });
    },
    [getToken, initLike]
  );

  return (
    <LikesContext.Provider value={{ initLike, getLike, toggleLike }}>
      {children}
    </LikesContext.Provider>
  );
}

/**
 * Like state for one item.
 *
 * Pass the item's `like_count` and `liked_by_me` as the server sent them, or
 * `undefined` while the item is still loading (or where the caller has no like
 * data). Only a pair from the server is registered, so a placeholder can never
 * stand in for the real value.
 */
export function useLikes(programId: string, serverCount?: number, serverLiked?: boolean) {
  const context = useContext(LikesContext);
  if (!context) throw new Error("useLikes must be used within LikesProvider");

  const { initLike, getLike, toggleLike: contextToggleLike } = context;

  useEffect(() => {
    if (serverCount !== undefined && serverLiked !== undefined) {
      initLike(programId, serverLiked, serverCount);
    }
  }, [programId, serverLiked, serverCount, initLike]);

  const entry = getLike(programId);
  const likeCount = entry?.count ?? serverCount ?? 0;
  const isLiked = entry?.liked ?? serverLiked ?? false;

  return {
    likeCount,
    isLiked,
    toggleLike: () => contextToggleLike(programId, { liked: isLiked, count: likeCount }),
  };
}
