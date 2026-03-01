"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./ProgramFilterBar.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgramFilters {
  q: string;
  ageGroup: string;
  tags: string[];
}

export interface ProgramFilterBarProps {
  tags: Array<{ id: string; name: string; color?: string }>;
  totalCount: number;
  isLoading: boolean;
  onChange: (filters: ProgramFilters) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUP_OPTIONS = [
  { value: "Öll", label: "Öll" },
  { value: "6–8 ára", label: "6–8 ára" },
  { value: "9–11 ára", label: "9–11 ára" },
  { value: "12–14 ára", label: "12–14 ára" },
  { value: "15+ ára", label: "15+ ára" },
] as const;

const DEFAULT_AGE_GROUP = "Öll";
const SEARCH_DEBOUNCE_MS = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFiltersFromParams(params: URLSearchParams): ProgramFilters {
  const q = params.get("q") ?? "";
  const ageGroup = params.get("ageGroup") ?? DEFAULT_AGE_GROUP;
  const tagsRaw = params.get("tags") ?? "";
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean) : [];
  return { q, ageGroup, tags };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgramFilterBar({
  tags: availableTags,
  totalCount,
  isLoading,
  onChange,
  className = "",
}: ProgramFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // IDs for aria relationships
  const ageGroupListId = useId();
  const tagsListId = useId();
  const resultsId = useId();

  // ── Derived initial state from URL ──
  const [q, setQ] = useState<string>(() => searchParams.get("q") ?? "");
  const [ageGroup, setAgeGroup] = useState<string>(
    () => searchParams.get("ageGroup") ?? DEFAULT_AGE_GROUP
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
    const raw = searchParams.get("tags") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  // ── Local input value for the search field (debounced before syncing to state) ──
  const [localQ, setLocalQ] = useState<string>(q);

  // ── Dropdown open states ──
  const [ageGroupOpen, setAgeGroupOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ── Mobile drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Refs ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // Keep a stable ref to the latest filter state so the debounce callback
  // never reads stale closure values.
  const latestFiltersRef = useRef<{ q: string; ageGroup: string; selectedTagIds: string[] }>({
    q,
    ageGroup,
    selectedTagIds,
  });
  const ageGroupRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Keep latestFiltersRef in sync with state ─────────────────────────────

  useEffect(() => {
    latestFiltersRef.current = { q, ageGroup, selectedTagIds };
  }, [q, ageGroup, selectedTagIds]);

  // ─── URL sync helper ──────────────────────────────────────────────────────

  const pushToUrl = useCallback(
    (filters: ProgramFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      if (filters.q) {
        params.set("q", filters.q);
      } else {
        params.delete("q");
      }

      if (filters.ageGroup && filters.ageGroup !== DEFAULT_AGE_GROUP) {
        params.set("ageGroup", filters.ageGroup);
      } else {
        params.delete("ageGroup");
      }

      if (filters.tags.length > 0) {
        params.set("tags", filters.tags.join(","));
      } else {
        params.delete("tags");
      }

      router.replace(`?${params.toString()}`, { scroll: false });
      onChange(filters);
    },
    [router, searchParams, onChange]
  );

  // ─── On mount: call onChange with initial URL state ───────────────────────

  useEffect(() => {
    const initial = readFiltersFromParams(searchParams);
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sync localQ → q (debounced) ─────────────────────────────────────────
  // Uses latestFiltersRef so the callback never reads stale state.

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = localQ.trim();
      const { q: currentQ, ageGroup: currentAgeGroup, selectedTagIds: currentTagIds } =
        latestFiltersRef.current;
      if (trimmed !== currentQ) {
        setQ(trimmed);
        pushToUrl({ q: trimmed, ageGroup: currentAgeGroup, tags: currentTagIds });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]); // intentional: fires only when localQ changes; reads latest state via ref

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAgeGroupSelect = (value: string) => {
    setAgeGroup(value);
    setAgeGroupOpen(false);
    pushToUrl({ q, ageGroup: value, tags: selectedTagIds });
  };

  const handleTagToggle = (id: string) => {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    setSelectedTagIds(next);
    pushToUrl({ q, ageGroup, tags: next });
  };

  const handleClearAll = () => {
    setLocalQ("");
    setQ("");
    setAgeGroup(DEFAULT_AGE_GROUP);
    setSelectedTagIds([]);
    pushToUrl({ q: "", ageGroup: DEFAULT_AGE_GROUP, tags: [] });
    searchRef.current?.focus();
  };

  const handleSearchClear = () => {
    setLocalQ("");
    setQ("");
    pushToUrl({ q: "", ageGroup, tags: selectedTagIds });
    searchRef.current?.focus();
  };

  // ─── Close dropdowns on outside click ────────────────────────────────────

  useEffect(() => {
    if (!ageGroupOpen && !tagsOpen) return;

    const handler = (e: MouseEvent) => {
      if (
        ageGroupRef.current &&
        !ageGroupRef.current.contains(e.target as Node)
      ) {
        setAgeGroupOpen(false);
      }
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ageGroupOpen, tagsOpen]);

  // ─── Keyboard handling for dropdowns ─────────────────────────────────────

  const handleAgeGroupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setAgeGroupOpen(false);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items =
        ageGroupRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ??
        [];
      const arr = Array.from(items);
      const currentIndex = arr.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "ArrowDown"
          ? (currentIndex + 1) % arr.length
          : (currentIndex - 1 + arr.length) % arr.length;
      arr[next]?.focus();
    }
  };

  const handleTagsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setTagsOpen(false);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items =
        tagsRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [];
      const arr = Array.from(items);
      const currentIndex = arr.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "ArrowDown"
          ? (currentIndex + 1) % arr.length
          : (currentIndex - 1 + arr.length) % arr.length;
      arr[next]?.focus();
    }
  };

  // ─── Mobile drawer: trap focus and close on Escape ────────────────────────

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // ─── Derived state ────────────────────────────────────────────────────────

  const isAnyFilterActive =
    ageGroup !== DEFAULT_AGE_GROUP || selectedTagIds.length > 0 || q !== "";

  const tagsLabel =
    selectedTagIds.length > 0
      ? `Tags (${selectedTagIds.length})`
      : "Tags";

  const resultsText =
    totalCount === 0
      ? "Engar dagskrár fundust"
      : totalCount === 1
      ? "1 dagskrá"
      : `${totalCount} dagskrár`;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      role="search"
      aria-label="Sía dagskrár"
      className={`${styles.filterBar} ${className}`}
    >
      {/* ── Top row: controls ── */}
      <div className={styles.controlsRow}>
        {/* Search — always visible */}
        <div className={styles.searchWrapper}>
          <label htmlFor="program-search" className={styles.srOnly}>
            Leita að dagskrá
          </label>
          <svg
            className={styles.searchIcon}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            id="program-search"
            ref={searchRef}
            type="search"
            className={`${styles.searchInput} ${localQ ? styles.searchInputActive : ""}`}
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Leita að dagskrá..."
            disabled={isLoading}
            aria-label="Leita að dagskrá"
            aria-controls={resultsId}
            autoComplete="off"
            spellCheck={false}
          />
          {localQ && !isLoading && (
            <button
              type="button"
              className={styles.searchClearButton}
              onClick={handleSearchClear}
              aria-label="Hreinsa leit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Desktop-only controls */}
        <div className={styles.desktopControls}>
          {/* Age Group dropdown */}
          <div
            className={styles.dropdownContainer}
            ref={ageGroupRef}
            onKeyDown={handleAgeGroupKeyDown}
          >
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${ageGroup !== DEFAULT_AGE_GROUP ? styles.dropdownTriggerActive : ""}`}
              onClick={() => {
                setAgeGroupOpen((v) => !v);
                setTagsOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={ageGroupOpen}
              aria-controls={ageGroupListId}
              aria-label={`Aldurshópur: ${ageGroup}`}
              disabled={isLoading}
            >
              <span className={styles.dropdownLabel}>
                {ageGroup === DEFAULT_AGE_GROUP ? "Aldurshópur" : ageGroup}
              </span>
              <svg
                className={`${styles.dropdownChevron} ${ageGroupOpen ? styles.dropdownChevronOpen : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {ageGroupOpen && (
              <ul
                id={ageGroupListId}
                role="listbox"
                aria-label="Aldurshópur"
                className={styles.dropdownList}
              >
                {AGE_GROUP_OPTIONS.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={ageGroup === opt.value}
                    tabIndex={0}
                    className={`${styles.dropdownOption} ${ageGroup === opt.value ? styles.dropdownOptionSelected : ""}`}
                    onClick={() => handleAgeGroupSelect(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAgeGroupSelect(opt.value);
                      }
                    }}
                  >
                    {ageGroup === opt.value && (
                      <svg
                        className={styles.checkIcon}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    <span>{opt.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tags multi-select dropdown */}
          <div
            className={styles.dropdownContainer}
            ref={tagsRef}
            onKeyDown={handleTagsKeyDown}
          >
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${selectedTagIds.length > 0 ? styles.dropdownTriggerActive : ""}`}
              onClick={() => {
                setTagsOpen((v) => !v);
                setAgeGroupOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={tagsOpen}
              aria-controls={tagsListId}
              aria-label={tagsLabel}
              disabled={isLoading || availableTags.length === 0}
            >
              <span className={styles.dropdownLabel}>{tagsLabel}</span>
              <svg
                className={`${styles.dropdownChevron} ${tagsOpen ? styles.dropdownChevronOpen : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {tagsOpen && availableTags.length > 0 && (
              <ul
                id={tagsListId}
                role="listbox"
                aria-label="Tags"
                aria-multiselectable="true"
                className={`${styles.dropdownList} ${styles.dropdownListTags}`}
              >
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <li
                      key={tag.id}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      className={`${styles.dropdownOption} ${selected ? styles.dropdownOptionSelected : ""}`}
                      onClick={() => handleTagToggle(tag.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTagToggle(tag.id);
                        }
                      }}
                    >
                      <span
                        className={`${styles.tagCheckbox} ${selected ? styles.tagCheckboxChecked : ""}`}
                        aria-hidden="true"
                      >
                        {selected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                      <span>{tag.name}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Mobile: "Síur" button that opens drawer */}
        <button
          type="button"
          className={`${styles.mobileFiltersButton} ${ageGroup !== DEFAULT_AGE_GROUP || selectedTagIds.length > 0 ? styles.mobileFiltersButtonActive : ""}`}
          onClick={() => setDrawerOpen(true)}
          aria-label="Opna síur"
          disabled={isLoading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            className={styles.mobileFiltersIcon}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          Síur
          {(ageGroup !== DEFAULT_AGE_GROUP || selectedTagIds.length > 0) && (
            <span className={styles.mobileFiltersBadge} aria-hidden="true">
              {(ageGroup !== DEFAULT_AGE_GROUP ? 1 : 0) +
                selectedTagIds.length}
            </span>
          )}
        </button>

        {/* Clear filters — desktop */}
        {isAnyFilterActive && (
          <button
            type="button"
            className={`${styles.clearButton} ${styles.clearButtonDesktop}`}
            onClick={handleClearAll}
            aria-label="Hreinsa allar síur"
          >
            Hreinsa
          </button>
        )}
      </div>

      {/* ── Bottom row: results count ── */}
      <div className={styles.metaRow}>
        <div
          id={resultsId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={styles.resultsCount}
        >
          {isLoading ? (
            <span className={styles.resultsLoading}>Hleð dagskrám...</span>
          ) : (
            <span
              className={
                totalCount === 0 ? styles.resultsEmpty : styles.resultsText
              }
            >
              {resultsText}
            </span>
          )}
        </div>

        {/* Clear filters — mobile inline (below search row) */}
        {isAnyFilterActive && (
          <button
            type="button"
            className={`${styles.clearButton} ${styles.clearButtonMobile}`}
            onClick={handleClearAll}
            aria-label="Hreinsa allar síur"
          >
            Hreinsa allar síur
          </button>
        )}
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className={styles.drawerBackdrop}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Síur"
            className={styles.drawer}
          >
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Síur</h2>
              <button
                type="button"
                className={styles.drawerCloseButton}
                onClick={() => setDrawerOpen(false)}
                aria-label="Loka síum"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.drawerBody}>
              {/* Age Group section */}
              <section className={styles.drawerSection}>
                <h3 className={styles.drawerSectionTitle}>Aldurshópur</h3>
                <ul
                  role="listbox"
                  aria-label="Aldurshópur"
                  className={styles.drawerOptionList}
                >
                  {AGE_GROUP_OPTIONS.map((opt) => (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={ageGroup === opt.value}
                      tabIndex={0}
                      className={`${styles.drawerOption} ${ageGroup === opt.value ? styles.drawerOptionSelected : ""}`}
                      onClick={() => {
                        setAgeGroup(opt.value);
                        pushToUrl({
                          q,
                          ageGroup: opt.value,
                          tags: selectedTagIds,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAgeGroup(opt.value);
                          pushToUrl({
                            q,
                            ageGroup: opt.value,
                            tags: selectedTagIds,
                          });
                        }
                      }}
                    >
                      <span>{opt.label}</span>
                      {ageGroup === opt.value && (
                        <svg
                          className={styles.checkIcon}
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Tags section */}
              {availableTags.length > 0 && (
                <section className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitle}>
                    Flokkar
                    {selectedTagIds.length > 0 && (
                      <span className={styles.drawerSectionCount}>
                        {" "}
                        ({selectedTagIds.length})
                      </span>
                    )}
                  </h3>
                  <ul
                    role="listbox"
                    aria-label="Flokkar"
                    aria-multiselectable="true"
                    className={styles.drawerTagList}
                  >
                    {availableTags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <li
                          key={tag.id}
                          role="option"
                          aria-selected={selected}
                          tabIndex={0}
                          className={`${styles.drawerTagOption} ${selected ? styles.drawerTagOptionSelected : ""}`}
                          onClick={() => handleTagToggle(tag.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleTagToggle(tag.id);
                            }
                          }}
                        >
                          {tag.name}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            <div className={styles.drawerFooter}>
              {isAnyFilterActive && (
                <button
                  type="button"
                  className={styles.drawerClearButton}
                  onClick={() => {
                    handleClearAll();
                    setDrawerOpen(false);
                  }}
                  aria-label="Hreinsa allar síur"
                >
                  Hreinsa allar síur
                </button>
              )}
              <button
                type="button"
                className={styles.drawerApplyButton}
                onClick={() => setDrawerOpen(false)}
              >
                Skoða niðurstöður
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
