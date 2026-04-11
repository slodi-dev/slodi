"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./NextPuzzleCountdown.module.css";

type Props = {
  targetIso: string;
  label?: string;
  onExpire?: () => void;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatRemaining(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Countdown to a target ISO timestamp. Updates every second.
 *
 * Calls `onExpire` exactly once when the target moment is reached.
 * Cleans up its interval on unmount.
 */
export default function NextPuzzleCountdown({
  targetIso,
  label = "Næsta þraut eftir",
  onExpire,
}: Props) {
  const targetMs = new Date(targetIso).getTime();
  const [display, setDisplay] = useState<string>(() => formatRemaining(targetMs, Date.now()));
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;

    const tick = () => {
      const now = Date.now();
      setDisplay(formatRemaining(targetMs, now));
      if (now >= targetMs && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    // Sync immediately, then once per second.
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return (
    <div className={styles.root} role="timer" aria-live="polite">
      <p className={styles.label}>{label}</p>
      <p className={styles.digits}>{display}</p>
    </div>
  );
}
