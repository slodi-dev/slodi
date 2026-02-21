"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toggleProgramLike } from '@/services/programs.service';
import { useAuth } from '@/hooks/useAuth';

interface LikesContextValue {
  likedPrograms: Map<string, number>; // programId -> like_count
  isLiked: (programId: string) => boolean;
  getLikeCount: (programId: string) => number | undefined;
  toggleLike: (programId: string, currentCount: number) => Promise<void>;
  isLoading: boolean;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [likedPrograms, setLikedPrograms] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Load liked programs from backend on mount
  useEffect(() => {
    loadLikedPrograms();
  }, []);

  const loadLikedPrograms = async () => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/users/me/likes');
      // const data = await response.json();
      // const likedMap = new Map(data.map((item: any) => [item.programId, item.likeCount]));
      // setLikedPrograms(likedMap);
      
      // For now, load from localStorage as fallback
      const stored = localStorage.getItem('liked-programs');
      if (stored) {
        const parsed = JSON.parse(stored);
        setLikedPrograms(new Map(Object.entries(parsed)));
      }
    } catch (error) {
      console.error('Failed to load liked programs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isLiked = useCallback((programId: string) => {
    return likedPrograms.has(programId);
  }, [likedPrograms]);

  const getLikeCount = useCallback((programId: string) => {
    return likedPrograms.get(programId);
  }, [likedPrograms]);

  const toggleLike = async (programId: string, currentCount: number) => {
    const wasLiked = likedPrograms.has(programId);
    const newCount = wasLiked ? currentCount - 1 : currentCount + 1;

    // Optimistic update
    setLikedPrograms(prev => {
      const next = new Map(prev);
      if (wasLiked) {
        next.delete(programId);
      } else {
        next.set(programId, newCount);
      }
      return next;
    });

    // Persist to localStorage immediately
    const updatedMap = new Map(likedPrograms);
    if (wasLiked) {
      updatedMap.delete(programId);
    } else {
      updatedMap.set(programId, newCount);
    }
    localStorage.setItem('liked-programs', JSON.stringify(Object.fromEntries(updatedMap)));

    try {
      const data = await toggleProgramLike(programId, wasLiked ? 'unlike' : 'like', getToken);

      // Update with actual count from server
      setLikedPrograms(prev => {
        const next = new Map(prev);
        if (data.liked) {
          next.set(programId, data.likeCount);
        } else {
          next.delete(programId);
        }
        return next;
      });
    } catch (error) {
      // Revert optimistic update on error
      setLikedPrograms(prev => {
        const next = new Map(prev);
        if (wasLiked) {
          next.set(programId, currentCount);
        } else {
          next.delete(programId);
        }
        return next;
      });

      // Revert localStorage
      if (wasLiked) {
        likedPrograms.set(programId, currentCount);
      } else {
        likedPrograms.delete(programId);
      }
      localStorage.setItem('liked-programs', JSON.stringify(Object.fromEntries(likedPrograms)));

      console.error('Failed to toggle like:', error);
      // You could show a toast notification here
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
    throw new Error('useLikes must be used within LikesProvider');
  }

  const { getLikeCount, isLiked: contextIsLiked, toggleLike: contextToggleLike } = context;
  
  // Only check liked state after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return {
    likeCount: mounted ? (getLikeCount(programId) ?? initialCount) : initialCount,
    isLiked: mounted ? contextIsLiked(programId) : false,
    toggleLike: () => contextToggleLike(programId, initialCount),
  };
}
