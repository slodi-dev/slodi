"use client";

import type { Season } from "@/services/plan.service";
import styles from "./SeasonSwitcher.module.css";

interface Props {
  seasons: Season[];
  selectedId: string | null;
  onSelect: (seasonId: string) => void;
}

/**
 * Pick which season the plan views are showing (A1, sc-34).
 *
 * Starfsár and scratchpads sit in one list because they are the same entity —
 * a scratchpad is just a Season with no dates. Keeping them together is what
 * makes "play with putting a dagskrá together" a move within the plan rather
 * than a separate mode to leave and come back from.
 */
export default function SeasonSwitcher({ seasons, selectedId, onSelect }: Props) {
  if (seasons.length === 0) return null;

  return (
    <nav className={styles.switcher} aria-label="Veldu starfsár">
      <ul className={styles.list}>
        {seasons.map((season) => {
          const isSelected = season.id === selectedId;
          return (
            <li key={season.id}>
              <button
                type="button"
                className={`${styles.tab} ${isSelected ? styles.selected : ""}`}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelect(season.id)}
              >
                <span className={styles.name}>{season.name}</span>
                {season.kind === "scratchpad" && <span className={styles.badge}>Krot</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
