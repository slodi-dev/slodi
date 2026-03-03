"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { checkResponse } from "@/lib/api-utils";

interface FavoritesContextValue {
  favorites: Set<string>;
  isLoading: boolean;
  toggleFavorite: (programId: string) => Promise<void>;
  isFavorite: (programId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from backend/localStorage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch('/api/users/me/favorites');
      // const data = await response.json();
      // setFavorites(new Set(data.programIds));

      // For now, load from localStorage as fallback
      const stored = localStorage.getItem("favorite-programs");
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(new Set(parsed));
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFavorite = useCallback(
    (programId: string) => {
      return favorites.has(programId);
    },
    [favorites]
  );

  const toggleFavorite = async (programId: string) => {
    const wasFavorite = favorites.has(programId);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFavorite) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });

    // Persist to localStorage immediately
    const updatedSet = new Set(favorites);
    if (wasFavorite) {
      updatedSet.delete(programId);
    } else {
      updatedSet.add(programId);
    }
    localStorage.setItem("favorite-programs", JSON.stringify(Array.from(updatedSet)));

    try {
      // TODO: Replace with actual API call when backend is ready
      if (wasFavorite) {
        const response = await fetch(`/api/users/me/favorites/${programId}`, {
          method: "DELETE",
        });

        checkResponse(response);
      } else {
        const response = await fetch("/api/users/me/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId }),
        });

        checkResponse(response);
      }
    } catch (error) {
      // Revert optimistic update on error
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) {
          next.add(programId);
        } else {
          next.delete(programId);
        }
        return next;
      });

      // Revert localStorage
      if (wasFavorite) {
        favorites.add(programId);
      } else {
        favorites.delete(programId);
      }
      localStorage.setItem("favorite-programs", JSON.stringify(Array.from(favorites)));

      console.error("Failed to update favorite:", error);
      // You could show a toast notification here
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isLoading, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

// Hook to use favorites for a specific program (hydration-safe)
export function useFavorite(programId: string) {
  const context = useContext(FavoritesContext);
  const [mounted, setMounted] = useState(false);

  if (!context) {
    throw new Error("useFavorite must be used within FavoritesProvider");
  }

  const { isFavorite: contextIsFavorite, toggleFavorite: contextToggleFavorite } = context;

  // Only check favorite state after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    isFavorite: mounted ? contextIsFavorite(programId) : false,
    toggleFavorite: () => contextToggleFavorite(programId),
  };
}

// Hook to get all favorites (for favorites page)
export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }

  return context;
}
