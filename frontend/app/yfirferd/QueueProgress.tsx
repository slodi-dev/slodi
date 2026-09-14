"use client";

import React from "react";
import styles from "./yfirferd.module.css";
import { formatIcelandicNumber } from "@/lib/format";

/**
 * Whether the pile is going down.
 *
 * Two numbers, deliberately: what is left (the job) and what you cleared in
 * this sitting (the achievement). Neither alone tells a moderator how the
 * shift is going — "5.002 bíða" on its own is only ever discouraging.
 *
 * **The bar measures the session, not the queue.** A fraction of five thousand
 * never visibly moves, and a bar that never moves is worse than no bar. It
 * resets when the filter changes, because a new filter is a new sitting.
 *
 * There are deliberately no streaks, no daily targets and no leaderboard.
 * Every one of those rewards deciding quickly over deciding correctly, which
 * is the one failure mode this surface cannot afford.
 */
export default function QueueProgress({
  done,
  waiting,
  loaded,
}: {
  /** Decided in this sitting. */
  done: number;
  /** Still in the queue under the current filter — the whole of it. */
  waiting: number;
  /** How many of those are actually in the rail right now. */
  loaded: number;
}) {
  if (done === 0 && waiting === 0) return null;

  // The denominator is the batch in front of you, never `waiting`. Dividing by
  // five thousand gives a bar that reads 0% after a solid hour, which tells a
  // reviewer their work does not count. Dividing by what is loaded gives a bar
  // that fills as the rail empties, and starts again when the next page loads.
  const batch = done + loaded;
  const pct = batch === 0 ? 0 : Math.round((done / batch) * 100);

  return (
    <div className={styles.prog}>
      <p className={`${styles.progNum} ${styles.progDone}`}>
        <span className={styles.progBig}>{formatIcelandicNumber(done)}</span>
        <span className={styles.progLab}>afgreidd í þessari lotu</span>
      </p>
      <span className={styles.progSep} aria-hidden="true" />
      <p className={styles.progNum}>
        <span className={styles.progBig}>{formatIcelandicNumber(waiting)}</span>
        <span className={styles.progLab}>bíða</span>
      </p>
      {/* Both numbers are already text above, so the bar is decoration with a
          label — role="img" carrying the whole sentence, not a bare percentage
          a screen reader would read as "37 percent" of nothing. */}
      <div
        className={styles.progBar}
        role="img"
        aria-label={`${done} af ${batch} afgreidd í þessari lotu`}
      >
        <div className={styles.progFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
