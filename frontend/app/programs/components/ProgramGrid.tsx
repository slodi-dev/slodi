"use client";

import type { ReactNode } from "react";
import styles from "./ProgramGrid.module.css";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GridView = "grid" | "list";

export interface ProgramGridProps {
  children?: ReactNode;
  view?: GridView;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

// ─── Skeleton count ─────────────────────────────────────────────────────────────

const SKELETON_COUNT = 6;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProgramGrid({
  children,
  view = "grid",
  isLoading = false,
  isEmpty = false,
  emptyMessage = "Engar dagskrár fundust",
  className = "",
}: ProgramGridProps) {
  // Loading skeleton — renders inline shimmer cards matching real card dimensions
  if (isLoading) {
    return (
      <ul
        className={`${styles.grid} ${styles[view]} ${className}`}
        aria-busy="true"
        aria-label="Hleð dagskrám..."
        role="list"
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <li key={i} className={styles.skeletonItem} aria-hidden="true">
            <div className={styles.skeleton}>
              {/* 16:9 image placeholder */}
              <div className={styles.skeletonMedia} />
              <div className={styles.skeletonContent}>
                {/* Title */}
                <div className={styles.skeletonTitle} />
                {/* Byline */}
                <div className={styles.skeletonByline} />
                {/* Description lines */}
                <div className={styles.skeletonDescription} />
                <div className={`${styles.skeletonDescription} ${styles.skeletonDescriptionShort}`} />
                {/* Tags */}
                <div className={styles.skeletonTags}>
                  <div className={styles.skeletonTag} />
                  <div className={styles.skeletonTag} />
                  <div className={styles.skeletonTag} />
                </div>
                {/* Meta row */}
                <div className={styles.skeletonMeta} />
              </div>
              {/* Footer */}
              <div className={styles.skeletonFooter}>
                <div className={styles.skeletonButton} />
                <div className={styles.skeletonButtonSm} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>{emptyMessage}</h3>
        <p className={styles.emptyDescription}>
          Prófaðu að breyta leitar- eða merkjasíunni til að finna það sem þú leitar að.
        </p>
      </div>
    );
  }

  // Results grid — children are <li> elements from ProgramCard
  return (
    <ul
      className={`${styles.grid} ${styles[view]} ${className}`}
      role="list"
      aria-label="Dagskrár"
    >
      {children}
    </ul>
  );
}
