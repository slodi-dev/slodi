"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLikes } from "@/contexts/LikesContext";
import { useFavorite } from "@/contexts/FavoritesContext";
import {
  formatDuration,
  formatDurationLabel,
  formatParticipants,
  formatParticipantsLabel,
  formatPrice,
  formatPriceLabel,
  formatAgeGroup,
  getAgeGroupPatrol,
} from "@/lib/format";
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
  liked_by_me?: boolean;
  className?: string;
  /** Show an edit option in the card action menu. */
  canEdit?: boolean;
  /** Show a delete option in the card action menu. */
  canDelete?: boolean;
  /** Called when the user selects "Edit" in the menu. */
  onEdit?: () => void;
  /** Called when the user selects "Delete" in the menu. */
  onDelete?: () => void;
  /** ISO date string for when the program was created. */
  created_at?: string;
  /** Duration range in minutes. */
  duration_min?: number | null;
  duration_max?: number | null;
  /** Participant count range. */
  count_min?: number | null;
  count_max?: number | null;
  /** Price in ISK. */
  price?: number | null;
  /** Free-text location. */
  location?: string | null;
  /** Age group enum values. */
  age?: string[] | null;
}

const MAX_VISIBLE_TAGS = 4;

export default function ProgramCard({
  id,
  name,
  description,
  image,
  author,
  tags = [],
  like_count = 0,
  liked_by_me = false,
  className,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  created_at,
  duration_min,
  duration_max,
  count_min,
  count_max,
  price,
  location,
  age,
}: ProgramCardProps) {
  const { likeCount, isLiked, toggleLike } = useLikes(id, like_count, liked_by_me);
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
    e.preventDefault();
    toggleLike();
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite();
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen((v) => !v);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen(false);
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  // Derive metadata values
  const durationStr = formatDuration(duration_min ?? undefined, duration_max ?? undefined);
  const durationLabelStr = formatDurationLabel(
    duration_min ?? undefined,
    duration_max ?? undefined
  );
  const participantsStr = formatParticipants(count_min ?? undefined, count_max ?? undefined);
  const participantsLabelStr = formatParticipantsLabel(
    count_min ?? undefined,
    count_max ?? undefined
  );
  const priceValue = price ?? undefined;
  const priceStr = priceValue !== undefined ? formatPrice(priceValue) : "";
  const priceLabelStr = priceValue !== undefined ? formatPriceLabel(priceValue) : "";
  const locationStr = location?.trim() || "";
  const ageGroups = age ?? [];
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflowTagCount = tags.length - MAX_VISIBLE_TAGS;
  const hasMetadata = durationStr || participantsStr || priceStr || locationStr;

  // Format created_at date
  const dateFormatted = created_at
    ? new Date(created_at).toLocaleDateString("is-IS", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <article className={`${styles.card} ${className || ""}`} aria-label={name} data-program-id={id}>
      {/* ── Hero image ──────────────────────────────────────────── */}
      <div className={styles.media}>
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={styles.image}
          />
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

      {/* ── Stretched link (covers entire card) ─────────────────── */}
      <Link href={`/programs/${id}`} className={styles.stretchedLink}>
        <span className="sl-sr-only">Opna {name}</span>
      </Link>

      {/* ── Content body ────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* Title */}
        <h2 className={styles.title}>{name}</h2>

        {/* Author + date */}
        {(author || dateFormatted) && (
          <p className={styles.byline}>
            {author && <span className={styles.authorName}>{author.name}</span>}
            {author && dateFormatted && <span aria-hidden="true"> · </span>}
            {dateFormatted && created_at && <time dateTime={created_at}>{dateFormatted}</time>}
          </p>
        )}

        {/* Description */}
        {description && <p className={styles.description}>{description}</p>}

        {/* ── Metadata row ────────────────────────────────────── */}
        {hasMetadata && (
          <dl className={styles.metadata}>
            {/* Duration */}
            {durationStr && (
              <div className={styles.metaItem}>
                <dt className="sl-sr-only">Lengd</dt>
                <dd aria-label={durationLabelStr}>
                  <svg
                    aria-hidden="true"
                    className={styles.metaIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {durationStr}
                </dd>
              </div>
            )}

            {/* Participants */}
            {participantsStr && (
              <div className={styles.metaItem}>
                <dt className="sl-sr-only">Fjöldi þátttakenda</dt>
                <dd aria-label={participantsLabelStr}>
                  <svg
                    aria-hidden="true"
                    className={styles.metaIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  {participantsStr}
                </dd>
              </div>
            )}

            {/* Price */}
            {priceStr && (
              <div className={styles.metaItem}>
                <dt className="sl-sr-only">Kostnaður</dt>
                <dd
                  aria-label={priceLabelStr}
                  className={priceValue === 0 ? styles.metaFree : undefined}
                >
                  <svg
                    aria-hidden="true"
                    className={styles.metaIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                  {priceStr}
                </dd>
              </div>
            )}

            {/* Location */}
            {locationStr && (
              <div className={styles.metaItem}>
                <dt className="sl-sr-only">Staðsetning</dt>
                <dd>
                  <svg
                    aria-hidden="true"
                    className={styles.metaIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {locationStr}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* ── Age group badges ────────────────────────────────── */}
        {ageGroups.length > 0 && (
          <ul className={styles.ageGroups} aria-label="Aldurshópar">
            {ageGroups.map((ag) => {
              const patrol = getAgeGroupPatrol(ag);
              const patrolClass = patrol
                ? styles[`patrol${patrol.charAt(0).toUpperCase()}${patrol.slice(1)}`]
                : undefined;
              return (
                <li
                  key={ag}
                  className={`${styles.ageBadge}${patrolClass ? ` ${patrolClass}` : ""}`}
                >
                  {formatAgeGroup(ag)}
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Tag pills ───────────────────────────────────────── */}
        {tags.length > 0 && (
          <ul className={styles.tags} aria-label="Flokkur">
            {visibleTags.map((tag) => (
              <li key={tag.id} className={styles.tag}>
                {tag.name}
              </li>
            ))}
            {overflowTagCount > 0 && (
              <li className={styles.tagMore} aria-label={`${overflowTagCount} fleiri flokkar`}>
                +{overflowTagCount}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── Footer actions ──────────────────────────────────────── */}
      <div className={styles.footer}>
        {/* Like button */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.likeButton} ${isLiked ? styles.liked : ""}`}
          onClick={handleLike}
          aria-label={`${isLiked ? "Taka rokkstig til baka" : "Gefa rokkstig"} ${name}, ${likeCount} rokkstig`}
          aria-pressed={isLiked}
        >
          <svg
            className={styles.actionIcon}
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

        {/* Favorite button */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.favoriteButton} ${isFavorite ? styles.favorited : ""}`}
          onClick={handleFavorite}
          aria-label={isFavorite ? `Fjarlægja ${name} úr möppu` : `Vista ${name} í möppu`}
          aria-pressed={isFavorite}
        >
          <svg
            className={styles.actionIcon}
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

        {/* Spacer pushes edit/delete to the right */}
        <div className={styles.footerSpacer} />

        {/* Edit button */}
        {canEdit && onEdit && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.editButton}`}
            onClick={handleEdit}
            aria-label={`Breyta ${name}`}
          >
            <svg
              className={styles.actionIcon}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </button>
        )}

        {/* Delete button */}
        {canDelete && onDelete && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={handleDelete}
            aria-label={`Eyða ${name}`}
          >
            <svg
              className={styles.actionIcon}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ── Action menu overlay (legacy three-dot menu) ─────────── */}
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
    </article>
  );
}
