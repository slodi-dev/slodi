import { useState, useEffect } from "react";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Load favorites from backend
    setIsLoading(false);
  }, []);

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

    // TODO: Persist to backend
  };

  const isFavorite = (programId: string) => favorites.has(programId);

  return {
    favorites,
    isLoading,
    toggleFavorite,
    isFavorite,
  };
}
