"use client";

import React, { useEffect, useRef } from "react";
import styles from "./yfirferd.module.css";
import { formatIcelandicNumber } from "@/lib/format";

/**
 * What the rail says when it has nothing to show.
 *
 * An empty filter and an empty queue are different findings and must not share
 * a sentence: one means "look somewhere else", the other means "you are done".
 * Reaching an empty list by filtering and being told "vel gert" is how a
 * moderator concludes the board is broken.
 *
 * The reward is the number, not the praise — `Þú afgreiddir 37 einingar` is
 * something the reader did; `Vel gert` is something the software says.
 */
export default function QueueEmpty({
  filtered,
  done,
  openReports,
  onClearFilter,
  onShowReports,
}: {
  /** True when a filter is narrowing the queue — so this is not the whole board. */
  filtered: boolean;
  /** Decided in this sitting. */
  done: number;
  /** Open reports waiting on the other tab, if any. */
  openReports: number;
  onClearFilter: () => void;
  onShowReports: () => void;
}) {
  const heading = useRef<HTMLParagraphElement>(null);

  // Focus lands on the finding. The row the reader was on has just left the
  // list, so without this focus falls back to <body> and a screen-reader user
  // is told nothing at all about why the rail went quiet.
  //
  // Except when they are typing. A debounced search empties the rail while the
  // caret is still in the search box, and pulling focus out mid-word makes the
  // field unusable — the reader loses their place for a message they did not
  // ask for.
  useEffect(() => {
    const focused = document.activeElement;
    const typing = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
    if (!typing) heading.current?.focus();
  }, []);

  return (
    <div className={styles.empty}>
      <span className={styles.emptyMark} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className={styles.emptyTitle} ref={heading} tabIndex={-1}>
        {filtered ? "Ekkert bíður í þessari síu." : "Röðin er tóm."}
      </p>
      <p className={styles.emptySub}>
        {done > 0
          ? `Þú afgreiddir ${formatIcelandicNumber(done)} ${done === 1 ? "einingu" : "einingar"} í þessari lotu.`
          : filtered
            ? "Prófaðu að víkka síuna."
            : "Ekkert efni bíður yfirferðar."}
      </p>
      <div className={styles.emptyActions}>
        {openReports > 0 && (
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onShowReports}>
            Sjá tilkynningar ({formatIcelandicNumber(openReports)})
          </button>
        )}
        {filtered && (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClearFilter}>
            Hreinsa síuna
          </button>
        )}
      </div>
    </div>
  );
}
