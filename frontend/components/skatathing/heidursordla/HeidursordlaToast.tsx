"use client";

import { useEffect } from "react";
import styles from "./HeidursordlaToast.module.css";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

const DEFAULT_DURATION = 2000;

export default function HeidursordlaToast({
  message,
  onDismiss,
  durationMs = DEFAULT_DURATION,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div className={styles.root} role="status" aria-live="polite">
      {message}
    </div>
  );
}
