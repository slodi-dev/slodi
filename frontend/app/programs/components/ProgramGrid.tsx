"use client";

import React from "react";
import SkeletonCard from "@/components/ui/SkeletonCard";
import ProgramCard from "./ProgramCard";
import type { Program } from "@/services/programs.service";
import styles from "./ProgramGrid.module.css";

interface ProgramGridProps {
  programs: Program[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Called when the user selects "Edit" on a card. */
  onEdit?: (program: Program) => void;
  /** Called when the user selects "Delete" on a card. */
  onDelete?: (program: Program) => void;
  /** Returns true if the user can edit the given program. */
  canEdit?: (program: Program) => boolean;
  /** Returns true if the user can delete the given program. */
  canDelete?: (program: Program) => boolean;
}

/**
 * Responsive grid layout for program cards.
 *
 * Handles loading (skeleton placeholders), error (with retry),
 * and empty states. Renders programs inside an accessible
 * `<ul>` / `<li>` list structure with a live region that
 * announces result counts to screen readers.
 */
export default function ProgramGrid({
  programs,
  isLoading,
  error,
  onRetry,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: ProgramGridProps) {
  // ── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <div role="status" aria-live="polite" aria-atomic="true" className="sl-sr-only" />
        <ul className={styles.grid} aria-busy="true" aria-label="Sækir dagskrá...">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className={styles.gridItem}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      </>
    );
  }

  // ── Error state ──────────────────────────────────────────
  if (error) {
    return (
      <>
        <div role="status" aria-live="polite" aria-atomic="true" className="sl-sr-only" />
        <div role="alert" className={styles.errorState}>
          <div className={styles.errorIcon}>
            <svg
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h3 className={styles.errorHeading}>Villa kom upp</h3>
          <p className={styles.errorMessage}>{error}</p>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              Reyna aftur
            </button>
          )}
        </div>
      </>
    );
  }

  // ── Empty state ──────────────────────────────────────────
  if (programs.length === 0) {
    return (
      <>
        <div role="status" aria-live="polite" aria-atomic="true" className="sl-sr-only">
          Engin dagskrá fannst
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h3 className={styles.emptyHeading}>Engin dagskrá fannst</h3>
          <p className={styles.emptyBody}>
            Engin dagskrá passaði við valdar síur. Prófaðu að breyta eða hreinsa síurnar.
          </p>
        </div>
      </>
    );
  }

  // ── Programs grid ────────────────────────────────────────
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sl-sr-only">
        {programs.length} atriði fundust
      </div>
      <ul className={styles.grid} aria-label="Dagskrá">
        {programs.map((program) => (
          <li key={program.id} className={styles.gridItem}>
            <ProgramCard
              id={program.id}
              name={program.name}
              image={program.image}
              description={program.description}
              tags={program.tags}
              author={program.author}
              like_count={program.like_count}
              liked_by_me={program.liked_by_me}
              created_at={program.created_at}
              duration_min={program.duration_min}
              duration_max={program.duration_max}
              count_min={program.count_min}
              count_max={program.count_max}
              price={program.price}
              location={program.location}
              age={program.age}
              canEdit={canEdit ? canEdit(program) : false}
              canDelete={canDelete ? canDelete(program) : false}
              onEdit={onEdit ? () => onEdit(program) : undefined}
              onDelete={onDelete ? () => onDelete(program) : undefined}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
