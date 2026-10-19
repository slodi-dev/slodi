"use client";

import { useMemo, useState } from "react";
import type { PlanGrid as PlanGridData } from "@/services/plan.service";
import { entriesForPatrol, parseWeekStart, resolvePatrolId } from "./planEntries";
import { formatIcelandicDateShort, formatIcelandicMonthYear } from "@/lib/format";
import styles from "./PlanTimeline.module.css";

/**
 * One flokkur's whole season, in order (A4, sc-39).
 *
 * ADR-002 §2 calls this the natural default for working on meetings, with the
 * grid as the zoom-out overview. Where the rolling window (A7) shows the next
 * few, this shows the shape of the term: what is behind, what is ahead, and
 * where the gaps are.
 *
 * Same `entriesForPatrol` as the window, so the two cannot disagree.
 */

interface Props {
  data: PlanGridData;
  today?: Date;
}

export default function PlanTimeline({ data, today }: Props) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const [patrolId, setPatrolId] = useState<string | null>(null);
  const activePatrolId = resolvePatrolId(data, patrolId);

  const entries = useMemo(
    () => entriesForPatrol(data, activePatrolId, now),
    [data, activePatrolId, now]
  );

  /**
   * Group by month so a term reads as months rather than an undifferentiated
   * list. An undated season — the scratchpad — has no months to group by, so it
   * falls into a single unlabelled run instead of inventing headings.
   */
  const groups = useMemo(() => {
    const byHeading = new Map<string, typeof entries>();
    for (const entry of entries) {
      const start = parseWeekStart(entry.week);
      const heading = start ? formatIcelandicMonthYear(start) : "";
      const list = byHeading.get(heading) ?? [];
      list.push(entry);
      byHeading.set(heading, list);
    }
    return [...byHeading.entries()];
  }, [entries]);

  if (data.patrols.length === 0) {
    return <p className={styles.empty}>Engir flokkar til að sýna enn.</p>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <label className={styles.label} htmlFor="plan-timeline-patrol">
          Flokkur
        </label>
        <select
          id="plan-timeline-patrol"
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

      {entries.length === 0 ? (
        <p className={styles.empty}>Ekkert skráð á þennan flokk enn.</p>
      ) : (
        groups.map(([heading, group]) => (
          <section key={heading || "undated"} className={styles.month}>
            {heading && <h2 className={styles.monthTitle}>{heading}</h2>}
            <ol className={styles.list}>
              {group.map((entry) => {
                const start = parseWeekStart(entry.week);
                return (
                  <li
                    key={entry.id}
                    className={`${styles.item} ${entry.isDone ? styles.done : styles.ahead}`}
                  >
                    <span className={styles.when}>
                      {start ? formatIcelandicDateShort(start) : entry.week.label}
                    </span>
                    <span className={styles.title}>{entry.title}</span>
                    {entry.isTroopWide && <span className={styles.troopWide}>Öll sveitin</span>}
                    {entry.status === "unknown" && (
                      <span className={styles.mark} aria-label="Óákveðið">
                        ?
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
