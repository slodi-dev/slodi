"use client";

import React, { useEffect, useRef } from "react";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        className={styles.dialog}
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
            <button
              className={styles.closeBtn}
              aria-label="Loka"
              onClick={() => {
                // Ask for confirmation in Icelandic when the explicit X is pressed.
                try {
                  const ok = window.confirm(
                    "Ertu viss um að þú viljir hætta? Öll óvista gögn munu tapast."
                  );
                  if (ok) onClose();
                } catch {
                  // Fallback: if confirm is unavailable, close
                  onClose();
                }
              }}
            >
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
            onClick={() => {
              try {
                const ok = window.confirm(
                  "Ertu viss um að þú viljir hætta? Öll óvista gögn munu tapast."
                );
                if (ok) onClose();
              } catch {
                onClose();
              }
            }}
          >
            ✕
          </button>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
