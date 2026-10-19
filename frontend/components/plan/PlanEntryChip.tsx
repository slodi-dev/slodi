"use client";

import type { PlanBand, PlanCell, Patrol } from "@/services/plan.service";
import { countIs } from "@/lib/format";
import { accentVarFor, formatClock, minutesOf } from "./planEntries";
import styles from "./PlanEntryChip.module.css";

/**
 * One event, as the hi-fi draws it (v5 · claude.ai/design, group Pages).
 *
 * Both the Rist and the Dagatal render the same chip so an event is recognisable
 * across views — same colour, same title, same left accent. What differs is the
 * second line, because the two views answer different questions: the Rist is
 * where a leader balances a term, so it shows the time budget; the Dagatal is
 * where they check *where and when*, so it shows the venue.
 *
 * The hi-fi also put an "N/M í þema" count here. It is gone: it scored each
 * liður as inside or outside the fundur's theme, and there is no such thing —
 * a block carries the theme it came with, and none of them is off it.
 *
 * ## Colour carries the flokkur, never the meaning
 *
 * The left accent is the patrol's own ramp, or primary for a troop-wide event.
 * It is an identity cue, not a status one — status stays with the "?" mark and
 * the border treatment, because a leader with colour-vision deficiency has to be
 * able to read a plan as well as anyone.
 */

/** Kind → the existing semantic ramp. ADR-002 §1 kinds; no new colours. */
const KIND_COLOUR: Record<string, string> = {
  setning: "hsl(var(--sl-color-patrol-drekar))",
  dagskra: "hsl(var(--sl-color-primary))",
  leikur: "hsl(var(--sl-color-patrol-rekkar))",
  slit: "hsl(var(--sl-color-secondary))",
  endurmat: "hsl(var(--sl-color-patrol-falkar))",
  custom: "hsl(var(--sl-color-border-strong))",
};

interface Props {
  entry: PlanBand | PlanCell;
  /** The flokkur that owns it, absent on a troop-wide band. */
  patrol?: Patrol;
  /** Column position, so a patrol with no declared accent still gets a stable one. */
  patrolIndex?: number;
  /** `budget` on the Rist, `venue` on the Dagatal. */
  meta: "budget" | "venue";
  isTroopWide?: boolean;
  isCurrent?: boolean;
  onSelect?: (eventId: string) => void;
}

export default function PlanEntryChip({
  entry,
  patrol,
  patrolIndex = 0,
  meta,
  isTroopWide = false,
  isCurrent = false,
  onSelect,
}: Props) {
  const clock = formatClock(entry.starts_at);
  const { actual, planned } = minutesOf(entry);
  const items = entry.item_count ?? 0;

  const segments = entry.segments ?? [];
  const segmentTotal = segments.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <button
      type="button"
      className={`${styles.ev} ${entry.status === "unknown" ? styles.undecided : ""}`}
      // An alias, so a bare triplet: the stylesheet wraps it in hsl().
      style={
        {
          "--ev": isTroopWide ? "var(--sl-color-primary)" : accentVarFor(patrol, patrolIndex),
        } as React.CSSProperties
      }
      aria-current={isCurrent || undefined}
      onClick={() => onSelect?.(entry.event_id)}
    >
      <span className={styles.title}>
        {entry.title}
        {entry.status === "unknown" && (
          <span className={styles.mark} aria-label="Óákveðið">
            ?
          </span>
        )}
      </span>

      <span className={styles.meta}>
        {clock && <span className={styles.num}>{clock}</span>}

        {meta === "venue"
          ? entry.venue && (
              <>
                {clock && <span className={styles.dot} aria-hidden="true" />}
                <span>{entry.venue}</span>
              </>
            )
          : actual !== null && (
              <>
                {clock && <span className={styles.dot} aria-hidden="true" />}
                <span className={styles.num}>
                  {planned === null ? `${actual} mín` : `${actual}/${planned} mín`}
                </span>
              </>
            )}

        {meta === "budget" && items > 0 && (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span>{countIs(items, "liður", "liðir")}</span>
          </>
        )}
      </span>

      {segmentTotal > 0 && (
        // The minutes are already stated above; this is the same fact as shape.
        <span className={styles.bar} aria-hidden="true">
          {segments.map((segment, i) => (
            <i
              key={`${segment.kind}-${i}`}
              style={{
                width: `${(segment.minutes / segmentTotal) * 100}%`,
                background: KIND_COLOUR[segment.kind] ?? KIND_COLOUR.custom,
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
