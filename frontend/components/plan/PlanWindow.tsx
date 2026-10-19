"use client";

import { useMemo, useState } from "react";
import type { PlanGrid as PlanGridData } from "@/services/plan.service";
import { entriesForPatrol, resolvePatrolId, type PlanEntry } from "./planEntries";
import styles from "./PlanWindow.module.css";

/**
 * The rolling working window — one flokkur, the next few fundir (A7, sc-42).
 *
 * A flokksforingi does not plan a year; they plan the next handful of meetings,
 * which is what the paper "Fundarhugmyndir" sheet is for. This is that horizon:
 * a little done behind for context, the skeleton ahead to fill in.
 *
 * It is the timeline (A4) sliced short — both read `entriesForPatrol`, so they
 * cannot disagree about what counts as a meeting or as done.
 */

/** Meetings kept behind the current one, for context. */
const DONE_CONTEXT = 1;
const DEFAULT_AHEAD = 4;

interface Props {
  data: PlanGridData;
  /** Injectable so tests are not tied to the day they run. */
  today?: Date;
  ahead?: number;
}

export default function PlanWindow({ data, today, ahead = DEFAULT_AHEAD }: Props) {
  // A default of `new Date()` in the parameter list is a new object on every
  // render, which invalidates every memo below it. Day granularity is all the
  // done/ahead split needs, and it is stable across a day's renders.
  const now = useMemo(() => today ?? new Date(), [today]);

  const [patrolId, setPatrolId] = useState<string | null>(null);
  const activePatrolId = resolvePatrolId(data, patrolId);

  const entries = useMemo<PlanEntry[]>(
    () => entriesForPatrol(data, activePatrolId, now),
    [data, activePatrolId, now]
  );

  /**
   * Keep a little history and the next few ahead. Slicing around the first
   * not-yet-done meeting rather than around today's date means an undated
   * scratchpad still shows its first few, instead of an empty window.
   */
  const windowed = useMemo(() => {
    const firstUpcoming = entries.findIndex((entry) => !entry.isDone);
    if (firstUpcoming === -1) return entries.slice(-DONE_CONTEXT - ahead);
    const from = Math.max(0, firstUpcoming - DONE_CONTEXT);
    return entries.slice(from, firstUpcoming + ahead);
  }, [entries, ahead]);

  if (data.patrols.length === 0) {
    return <p className={styles.empty}>Engir flokkar til að sýna enn.</p>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <label className={styles.label} htmlFor="plan-window-patrol">
          Flokkur
        </label>
        <select
          id="plan-window-patrol"
          className={styles.select}
          value={activePatrolId ?? ""}
          onChange={(event) => setPatrolId(event.target.value)}
        >
          {data.patrols.map((patrol) => (
            <option key={patrol.id} value={patrol.id}>
              {patrol.name}
            </option>
          ))}
        </select>
      </div>

      {windowed.length === 0 ? (
        <p className={styles.empty}>Engir fundir framundan hjá þessum flokki.</p>
      ) : (
        <ol className={styles.list}>
          {windowed.map(({ id, title, status, week, isDone, isTroopWide }) => (
            <li key={id} className={`${styles.item} ${isDone ? styles.done : styles.ahead}`}>
              <span className={styles.week}>{week.label}</span>
              <span className={styles.title}>{title}</span>
              {isTroopWide && <span className={styles.troopWide}>Öll sveitin</span>}
              {status === "unknown" && (
                <span className={styles.mark} aria-label="Óákveðið">
                  ?
                </span>
              )}
              {isDone && <span className={styles.doneTag}>Búið</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
