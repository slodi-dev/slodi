"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLikes } from "@/contexts/LikesContext";
import { useFavorite } from "@/contexts/FavoritesContext";
import styles from "./ProgramCard.module.css";

export interface ProgramCardProps {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  author?: {
    id: string;
    name: string;
  };
  workspace?: {
    id: string;
    name: string;
  };
  tags?: Array<{ id: string; name: string }>;
  like_count?: number;
  created_at?: string;
  public?: boolean;
  onLike?: (programId: string) => void;
  isLiked?: boolean;
  className?: string;
}

export default function ProgramCard({
  id,
  name,
  description,
  image,
  author,
  tags = [],
  like_count = 0,
  className,
}: ProgramCardProps) {
  const router = useRouter();
  const { likeCount, isLiked, toggleLike } = useLikes(id, like_count || 0);
  const { isFavorite, toggleFavorite } = useFavorite(id);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike();
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    router.push(`/programs/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(`/programs/${id}`);
    }
  };

  return (
    <article
      className={`${styles.card} ${className || ''}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View program: ${name}`}
      data-program-id={id}
    >
      {/* Thumbnail/Hero Image */}
      <div className={styles.media}>
        {image ? (
          <img src={image} alt={name} className={styles.image} width={400} height={250} />
        ) : (
          <div className={styles.placeholder}>
            <svg
              className={styles.placeholderIcon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Title */}
        <h3 className={styles.title}>{name}</h3>

        {/* Author byline */}
        {author && (
          <p className={styles.byline}>
            by <span className={styles.authorName}>{author.name}</span>
          </p>
        )}

        {/* Description */}
        {description && <p className={styles.description}>{description}</p>}

        {/* Tags */}
        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 4).map((tag) => (
              <span key={tag.id} className={styles.tag}>
                {tag.name}
              </span>
            ))}
            {tags.length > 4 && (
              <span className={styles.tagMore}>+{tags.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer Meta */}
      <div className={styles.footer}>
        {/* Like button */}
        <button
          className={`${styles.likeButton} ${isLiked ? styles.liked : ''}`}
          onClick={handleLike}
          aria-label={isLiked ? 'Afþakka dagskrá' : 'Þakka fyrir dagskrá'}
          title={isLiked ? 'Afþakka' : 'Þakka fyrir'}
        >
          <svg
            className={styles.heartIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <span className={styles.likeCount}>{likeCount}</span>
        </button>

        {/* Favorite button */}
        <button
          className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ''}`}
          onClick={handleFavorite}
          aria-label={isFavorite ? 'Fjarlægja úr möppu' : 'Vista í möppu'}
          title={isFavorite ? 'Fjarlægja úr möppu' : 'Vista í möppu'}
        >
          <svg
            className={styles.bookmarkIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
        </button>

        {/* Read more button */}
        <button
          className={styles.readMore}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/programs/${id}`);
          }}
          aria-label={`Lesa meira um ${name}`}
        >
          Lesa meira
          <svg
            className={styles.arrow}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </article>
  );
}
