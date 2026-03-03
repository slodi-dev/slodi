"use client";

import { useState } from "react";

interface LikeButtonProps {
  programId: string;
  initialLikeCount: number;
  initialIsLiked?: boolean;
  onLike?: (programId: string) => void;
}

export default function LikeButton({
  programId,
  initialLikeCount,
  initialIsLiked = false,
  onLike,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

    // Call parent handler
    if (onLike) {
      onLike(programId);
    }

    // TODO: API call to persist like
  };

  return (
    <button
      className={`like-button ${isLiked ? "liked" : ""}`}
      onClick={handleClick}
      aria-label={isLiked ? "Unlike this program" : "Like this program"}
    >
      <span className="heart-icon">{isLiked ? "❤️" : "🤍"}</span>
      <span className="like-count">{likeCount}</span>
    </button>
  );
}
