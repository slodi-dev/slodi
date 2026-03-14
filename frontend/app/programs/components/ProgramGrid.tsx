import type { ReactNode } from "react";
import styles from "./ProgramGrid.module.css";

export type GridView = "grid" | "list";

interface ProgramGridProps {
  children: ReactNode;
  view?: GridView;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

export default function ProgramGrid({
  children,
  view = "grid",
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No programs found",
  className = "",
}: ProgramGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`${styles.grid} ${styles[view]} ${className}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.skeleton}>
            <div className={styles.skeletonMedia} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonByline} />
              <div className={styles.skeletonDescription} />
              <div className={styles.skeletonDescription} />
              <div className={styles.skeletonTags}>
                <div className={styles.skeletonTag} />
                <div className={styles.skeletonTag} />
                <div className={styles.skeletonTag} />
              </div>
            </div>
            <div className={styles.skeletonFooter}>
              <div className={styles.skeletonButton} />
              <div className={styles.skeletonButton} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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

  // Grid view
  return (
    <div
      className={`${styles.grid} ${styles[view]} ${className}`}
      role="list"
      aria-label="Dagskrár"
    >
      {children}
    </div>
  );
}
