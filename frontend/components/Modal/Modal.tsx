"use client";

import React, { useEffect, useRef } from "react";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  /**
   * `wide` for content that has its own natural width — a document preview
   * cannot usefully be squeezed into a 800px column.
   */
  size?: "default" | "wide";
  /**
   * Message to confirm before closing, for a modal holding work that would be
   * lost. Off by default.
   *
   * Every close used to raise „Ertu viss…" — on a read-only document preview,
   * and on the delete dialog, where it asked you to confirm before confirming.
   * It also only ever guarded the ✕: Escape and a click on the scrim closed
   * without asking, so it protected nothing it claimed to.
   */
  confirmOnClose?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "default",
  confirmOnClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const requestClose = () => {
    if (!confirmOnClose) {
      onClose();
      return;
    }
    try {
      if (window.confirm(confirmOnClose)) onClose();
    } catch {
      // If confirm is unavailable, closing is the safer failure: a modal that
      // cannot be dismissed traps the reader.
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={size === "wide" ? `${styles.dialog} ${styles.wide}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        ref={dialogRef}
      >
        {title && (
          <div className={styles.header}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            <button className={styles.closeBtn} aria-label="Loka" onClick={requestClose}>
              ✕
            </button>
          </div>
        )}
        {!title && (
          <button
            className={styles.closeBtn}
            style={{
              position: "absolute",
              right: "var(--sl-spacing-inset-md)",
              top: "var(--sl-spacing-inset-md)",
            }}
            aria-label="Loka"
            onClick={requestClose}
          >
            ✕
          </button>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
