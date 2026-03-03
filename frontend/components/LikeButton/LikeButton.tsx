"use client";

import React from "react";
import { useLikes } from "@/contexts/LikesContext";
import styles from "./LikeButton.module.css";

interface LikeButtonProps {
  programId: string;
  initialLikeCount: number;
  size?: "small" | "medium" | "large";
  showCount?: boolean;
  className?: string;
}

export default function LikeButton({
  programId,
  initialLikeCount,
  size = "medium",
  showCount = true,
  className,
}: LikeButtonProps) {
  const { isLiked, likeCount, toggleLike } = useLikes(programId, initialLikeCount);

  const liked = isLiked;
  const likeCountValue = likeCount ?? initialLikeCount;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleLike();
  };

  return (
    <button
      type="button"
      className={`${styles.likeButton} ${styles[size]} ${liked ? styles.liked : ""} ${className || ""}`}
      onClick={handleClick}
      aria-label={liked ? "Unlike this program" : "Like this program"}
      aria-pressed={liked}
    >
      <svg
        className={styles.icon}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {showCount && <span className={styles.count}>{likeCountValue}</span>}
    </button>
  );
}
