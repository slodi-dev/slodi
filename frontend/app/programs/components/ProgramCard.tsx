"use client";

import { useEffect, useRef, useState } from "react";
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
  tags?: Array<{ id: string; name: string }>;
  like_count?: number;
  className?: string;
  /** Show an edit option in the card action menu. */
  canEdit?: boolean;
  /** Show a delete option in the card action menu. */
  canDelete?: boolean;
  /** Called when the user selects "Edit" in the menu. */
  onEdit?: () => void;
  /** Called when the user selects "Delete" in the menu. */
  onDelete?: () => void;
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
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ProgramCardProps) {
  const router = useRouter();
  const { likeCount, isLiked, toggleLike } = useLikes(id, like_count);
  const { isFavorite, toggleFavorite } = useFavorite(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const showMenu = canEdit || canDelete;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (!menuOpen) return;
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [menuOpen]);

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

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.();
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/programs/${id}`);
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = e.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  return (
    <article
      className={`${styles.card} ${className || ''}`}
      onClick={handleCardClick}
      data-program-id={id}
    >
      {/* Action menu overlay — only visible for users with edit/delete rights */}
      {showMenu && (
        <div className={styles.cardActions} ref={menuRef} onKeyDown={handleMenuKeyDown}>
          <button
            ref={menuButtonRef}
            type="button"
            className={`${styles.menuButton} ${menuOpen ? styles.menuButtonOpen : ""}`}
            onClick={handleMenuToggle}
            aria-label="Valkostir"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            ···
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              {canEdit && (
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={handleEdit}
                >
                  Breyta
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  role="menuitem"
                  onClick={handleDelete}
                >
                  Eyða
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {/* Thumbnail/Hero Image */}
      <div className={styles.media}>
        {image ? (
          <Image src={image} alt={name} className={styles.image} width={400} height={250} />
        ) : (
          <div className={styles.placeholder}>
            <svg
              aria-hidden="true"
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
          type="button"
          className={`${styles.likeButton} ${isLiked ? styles.liked : ''}`}
          onClick={handleLike}
          aria-label="Þakka fyrir dagskrá"
          aria-pressed={isLiked}
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
          type="button"
          className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ''}`}
          onClick={handleFavorite}
          aria-label="Vista í möppu"
          aria-pressed={isFavorite}
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
          type="button"
          className={styles.readMore}
          onClick={handleNavigate}
          aria-label={`Lesa meira um ${name}`}
        >
          Lesa meira
          <svg
            aria-hidden="true"
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
