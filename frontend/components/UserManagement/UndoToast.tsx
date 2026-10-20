"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/util";
import styles from "./UserManagement.module.css";

export interface Toast {
  /** A new key restarts the timer, even for the same message. */
  key: number;
  message: string;
  /** Puts the change back. Shown as "Afturkalla". */
  undo?: () => void;
}

/** UX rule 5: "Afturkalla" stays for at least 8 seconds. */
const TOAST_MS = 10_000;

/**
 * The page's one announcement line: what just changed, with "Afturkalla" when
 * it can be put back. It's a live region, so a screen reader hears it, and the
 * timer stops while focus is inside it.
 */
export default function UndoToast({
  toast,
  onDismiss,
}: {
  toast: Toast | null;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  return (
    <div
      ref={regionRef}
      className={styles.toastRegion}
      role="status"
      tabIndex={-1}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {toast && (
        <div key={toast.key} className={styles.toast}>
          <span className={styles.toastText}>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className={cn(styles.button, styles.toastButton)}
              onClick={() => {
                toast.undo?.();
                // The button is about to go; keep focus in the region, not on <body>.
                regionRef.current?.focus();
              }}
            >
              Afturkalla
            </button>
          )}
          <button
            type="button"
            className={cn(styles.button, styles.toastClose)}
            aria-label="Loka"
            onClick={onDismiss}
          >
            <X aria-hidden="true" className={styles.buttonIcon} />
          </button>
        </div>
      )}
    </div>
  );
}
