import { useCallback, useState } from "react";

export function useProgramLikes(initialCount: number) {
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(false);

  const toggleLike = useCallback(() => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    // TODO: API call to backend
  }, [isLiked]);

  return { likeCount, isLiked, toggleLike };
}
