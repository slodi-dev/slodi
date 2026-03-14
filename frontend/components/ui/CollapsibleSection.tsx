"use client";

import React, { useState, useId } from "react";
import styles from "./primitives.module.css";

interface CollapsibleSectionProps {
  label: string;
  activeCount?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  id?: string;
}

/**
 * A toggle-able panel that wraps any filter group.
 * Uses a button for the toggle with proper ARIA attributes.
 */
export default function CollapsibleSection({
  label,
  activeCount,
  defaultOpen = false,
  children,
  id,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const generatedId = useId();
  const panelId = id ?? `collapsible-panel-${generatedId}`;

  return (
    <div className={styles.collapsible}>
      <button
        type="button"
        className={styles.collapsibleToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={styles.collapsibleLabel}>{label}</span>
        {activeCount != null && activeCount > 0 && (
          <span className={styles.collapsibleBadge}>{activeCount}</span>
        )}
        <svg
          className={`${styles.collapsibleChevron} ${isOpen ? styles.collapsibleChevronOpen : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={label}
        className={`${styles.collapsiblePanel} ${isOpen ? styles.collapsiblePanelOpen : ""}`}
      >
        <div className={styles.collapsiblePanelInner}>
          <div className={styles.collapsiblePanelContent}>{children}</div>
        </div>
      </div>
    </div>
  );
}
