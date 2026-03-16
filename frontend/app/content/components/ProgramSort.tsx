"use client";

import styles from "./ProgramSort.module.css";
import type { FilterState } from "@/hooks/useProgramFilters";

export type SortOption = FilterState["sortBy"];

interface ProgramSortProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

const SORT_OPTIONS: Record<SortOption, string> = {
  newest: "Nýjast fyrst",
  oldest: "Elst fyrst",
  liked: "Vinsælast",
  alpha: "Stafrófsröð",
};

export default function ProgramSort({ value, onChange, className = "" }: ProgramSortProps) {
  return (
    <div className={`${styles.sortContainer} ${className}`}>
      <label htmlFor="sort-select" className={styles.sortLabel}>
        Raða eftir:
      </label>
      <div className={styles.sortWrapper}>
        <select
          id="sort-select"
          className={styles.sortSelect}
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          aria-label="Raða dagskrám"
        >
          {Object.entries(SORT_OPTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <svg
          className={styles.sortIcon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
