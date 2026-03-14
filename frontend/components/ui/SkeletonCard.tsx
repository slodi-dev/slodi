"use client";

import React from "react";
import styles from "./primitives.module.css";

/**
 * Animated placeholder matching the visual structure of ProgramCard.
 * Hidden from screen readers via aria-hidden.
 * Shimmer animation only runs when user has no motion preference.
 */
export default function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
      <div className={styles.skeletonBody}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
        <div className={`${styles.skeletonBlock} ${styles.skeletonLineShort}`} />
        <div className={styles.skeletonChips}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
        </div>
      </div>
    </div>
  );
}
