"use client";
https://lightsail.aws.amazon.com/ls/webapp
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLikes } from "@/contexts/LikesContext";
import { useFavorite } from "@/contexts/FavoritesContext";
import type { AgeGroup } from "@/services/programs.service";
import styles from "./ProgramCard.module.css";

// ─── Prop Interface ────────────────────────────────────────────────────────────

export interface ProgramCardProps {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  author?: {
    id: string;
    name: string;
  };
  /** Tags with optional hex/hsl color. When color is present it overrides the default chip background. */
  tags?: Array<{ id: string; name: string; color?: string }>;
  /** AgeGroup enum array — all values shown, comma-separated. */
  age?: AgeGroup[] | null;
  /** Free-text duration string, e.g. "45 mín". */
  duration?: string | null;
  /** Free-text prep time string shown after duration when present. */
  prep_time?: string | null;
  /** Participant capacity. Shown as "{n} þátttakendur" when present. */
  count?: number | null;
  /**
   * Price in ISK.
   * - 0     → "Frítt"
   * - > 0   → "{n} kr."
   * - null  → hidden
   */
  price?: number | null;
  /** Location string shown when present. */
  location?: string | null;
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format price for display. Returns null when price is null (field should be hidden). */
function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  if (price === 0) return "Frítt";
  return `${price.toLocaleString("is-IS")} kr.`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProgramCard({
  id,
  name,
  description,
  image,
  author,
  tags = [],
  age,
  duration,
  prep_time,
  count,
  price,
  location,
  like_count = 0,
  className,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ProgramCardProps) {
  const { likeCount, isLiked, toggleLike } = useLikes(id, like_count);
  const { isFavorite, toggleFavorite } = useFavorite(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const showMenu = canEdit || canDelete;
  const priceLabel = formatPrice(price);
  const hasAge = age && age.length > 0;
  const hasMeta = hasAge || duration || prep_time || count != null || priceLabel || location;

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
    e.preventDefault();
    e.stopPropagation();
    toggleLike();
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite();
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex =
        e.key === "ArrowDown"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  return (
    <li className={`${styles.item} ${className || ""}`}>
      {/*
       * The entire card is a single <a> element for keyboard and pointer navigation.
       * Interactive overlays (like/favorite/menu) use e.preventDefault() + e.stopPropagation()
       * so they do not trigger the link navigation.
       */}
      <a
        href={`/programs/${id}`}
        className={styles.card}
        aria-label={name}
      >
        {/* Action menu overlay — only visible for users with edit/delete rights */}
        {showMenu && (
          <div
            className={styles.cardActions}
            ref={menuRef}
            onKeyDown={handleMenuKeyDown}
            // Prevent the <a> from receiving the click when interacting with the menu
            onClick={(e) => e.preventDefault()}
          >
            <button
              ref={menuButtonRef}
              type="button"
              className={`${styles.menuButton} ${menuOpen ? styles.menuButtonOpen : ""}`}
              onClick={handleMenuToggle}
              aria-label="Valkostir"
              aria-haspopup="menu"
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

        {/* Thumbnail / Hero image — 16:9 aspect ratio */}
        <div className={styles.media}>
          {image ? (
            <Image
              src={image}
              alt={name}
              className={styles.image}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className={styles.placeholder} aria-hidden="true">
              <svg
                className={styles.placeholderIcon}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 12h.008v.008H18V12zm-7.5 3H12m0 0h.008v.008H12V15zm-3.75 3.75h.008v.008H8.25v-.008zm0-3h.008v.008H8.25V15zm0-3h.008v.008H8.25V12zm0-3h.008v.008H8.25V9zm3.75 0h.008v.008H12V9zm3.75 0h.008v.008H15.75V9z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className={styles.content}>
          {/* Title — clamped to 2 lines */}
          <h3 className={styles.title}>{name}</h3>

          {/* Author byline */}
          {author && (
            <p className={styles.byline}>
              <span className={styles.authorName}>{author.name}</span>
            </p>
          )}

          {/* Description — clamped to 2 lines */}
          {description && <p className={styles.description}>{description}</p>}

          {/* Tags — rendered only when the array is non-empty */}
          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className={styles.tag}
                  /*
                   * When a tag carries a color value, use it directly as the
                   * chip background. We set foreground to white and trust that
                   * tag colors from the backend have sufficient contrast.
                   * If no color is present, the CSS class provides the default
                   * primary-subtle background via token.
                   */
                  style={
                    tag.color
                      ? ({
                          "--tag-bg": tag.color,
                          "--tag-fg": "#ffffff",
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {tag.name}
                </span>
              ))}
              {tags.length > 4 && (
                <span className={styles.tagMore}>+{tags.length - 4}</span>
              )}
            </div>
          )}

          {/* Meta row — age, duration, prep_time, count, price, location */}
          {hasMeta && (
            <div className={styles.meta}>
              {hasAge && (
                <span className={styles.metaItem}>
                  {age!.join(", ")}
                </span>
              )}
              {duration && (
                <span className={styles.metaItem}>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  {duration}
                </span>
              )}
              {prep_time && (
                <span className={styles.metaItem}>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  {prep_time} undirbúningur
                </span>
              )}
              {count != null && (
                <span className={styles.metaItem}>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  {count} þátttakendur
                </span>
              )}
              {priceLabel && (
                <span className={styles.metaItem}>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  {priceLabel}
                </span>
              )}
              {location && (
                <span className={styles.metaItem}>
                  <span className={styles.metaDot} aria-hidden="true">·</span>
                  {location}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer — like + favorite */}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.likeButton} ${isLiked ? styles.liked : ""}`}
            onClick={handleLike}
            aria-label={isLiked ? `Afþakka dagskrá ${name}` : `Þakka fyrir dagskrá ${name}`}
            aria-pressed={isLiked}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <span className={styles.likeCount}>{likeCount}</span>
          </button>

          <button
            type="button"
            className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ""}`}
            onClick={handleFavorite}
            aria-label={isFavorite ? `Fjarlægja ${name} úr möppu` : `Vista ${name} í möppu`}
            aria-pressed={isFavorite}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
          </button>
        </div>
      </a>
    </li>
  );
}
