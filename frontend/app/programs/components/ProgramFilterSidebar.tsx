"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./ProgramFilterSidebar.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SidebarFilters {
  q: string;
  age: string[];
  tags: string[];
  duration: string[];
  prep_time: string[];
  location: string;
  count_min: string;
  count_max: string;
  price: string[];
}

export interface ProgramFilterSidebarProps {
  tags: Array<{ id: string; name: string; color?: string }>;
  totalCount: number;
  isLoading: boolean;
  onChange: (filters: SidebarFilters) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUP_OPTIONS = [
  { value: "Hrefnuskátar", label: "Hrefnuskátar" },
  { value: "Drekaskátar", label: "Drekaskátar" },
  { value: "Fálkaskátar", label: "Fálkaskátar" },
  { value: "Dróttskátar", label: "Dróttskátar" },
  { value: "Rekkaskátar", label: "Rekkaskátar" },
  { value: "Róverskátar", label: "Róverskátar" },
  { value: "Vættaskátar", label: "Vættaskátar" },
] as const;

const DURATION_OPTIONS = [
  { value: "short", label: "< 30 mín" },
  { value: "medium", label: "30–60 mín" },
  { value: "long", label: "1–2 klst" },
  { value: "xlong", label: "> 2 klst" },
] as const;

const PREP_TIME_OPTIONS = [
  { value: "short", label: "< 15 mín" },
  { value: "medium", label: "15–30 mín" },
  { value: "long", label: "> 30 mín" },
] as const;

const PRICE_OPTIONS = [
  { value: "free", label: "Frítt" },
  { value: "paid", label: "Með kostnað" },
] as const;

const SEARCH_DEBOUNCE_MS = 300;
const LOCATION_DEBOUNCE_MS = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFiltersFromParams(params: URLSearchParams): SidebarFilters {
  const splitComma = (key: string): string[] => {
    const raw = params.get(key) ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  };

  return {
    q: params.get("q") ?? "",
    age: splitComma("age"),
    tags: splitComma("tags"),
    duration: splitComma("duration"),
    prep_time: splitComma("prep_time"),
    location: params.get("location") ?? "",
    count_min: params.get("count_min") ?? "",
    count_max: params.get("count_max") ?? "",
    price: splitComma("price"),
  };
}

function isFilterActive(filters: SidebarFilters): boolean {
  return (
    filters.q !== "" ||
    filters.age.length > 0 ||
    filters.tags.length > 0 ||
    filters.duration.length > 0 ||
    filters.prep_time.length > 0 ||
    filters.location !== "" ||
    filters.count_min !== "" ||
    filters.count_max !== "" ||
    filters.price.length > 0
  );
}

function countActiveFilters(filters: SidebarFilters): number {
  // search (q) is not counted since it lives outside the sidebar
  return (
    filters.age.length +
    (filters.tags.length > 0 ? 1 : 0) +
    filters.duration.length +
    filters.prep_time.length +
    (filters.location !== "" ? 1 : 0) +
    (filters.count_min !== "" ? 1 : 0) +
    (filters.count_max !== "" ? 1 : 0) +
    filters.price.length
  );
}

const EMPTY_FILTERS: SidebarFilters = {
  q: "",
  age: [],
  tags: [],
  duration: [],
  prep_time: [],
  location: "",
  count_min: "",
  count_max: "",
  price: [],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgramFilterSidebar({
  tags: availableTags,
  totalCount,
  isLoading,
  onChange,
  className = "",
}: ProgramFilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // IDs for aria relationships
  const searchId = useId();
  const resultsId = useId();

  // ── Initialise state from URL on first render ──────────────────────────────

  const [q, setQ] = useState<string>(() => searchParams.get("q") ?? "");
  const [localQ, setLocalQ] = useState<string>(() => searchParams.get("q") ?? "");

  const [age, setAge] = useState<string[]>(() => {
    const raw = searchParams.get("age") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
    const raw = searchParams.get("tags") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [duration, setDuration] = useState<string[]>(() => {
    const raw = searchParams.get("duration") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [prepTime, setPrepTime] = useState<string[]>(() => {
    const raw = searchParams.get("prep_time") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [location, setLocation] = useState<string>(
    () => searchParams.get("location") ?? ""
  );
  const [localLocation, setLocalLocation] = useState<string>(
    () => searchParams.get("location") ?? ""
  );

  const [countMin, setCountMin] = useState<string>(
    () => searchParams.get("count_min") ?? ""
  );
  const [countMax, setCountMax] = useState<string>(
    () => searchParams.get("count_max") ?? ""
  );

  const [price, setPrice] = useState<string[]>(() => {
    const raw = searchParams.get("price") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  // ── Mobile drawer ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Latest filter state ref so debounce callbacks never read stale closures
  const latestRef = useRef<SidebarFilters>({
    q,
    age,
    tags: selectedTagIds,
    duration,
    prep_time: prepTime,
    location,
    count_min: countMin,
    count_max: countMax,
    price,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);

  // ── Keep latestRef in sync ─────────────────────────────────────────────────

  useEffect(() => {
    latestRef.current = {
      q,
      age,
      tags: selectedTagIds,
      duration,
      prep_time: prepTime,
      location,
      count_min: countMin,
      count_max: countMax,
      price,
    };
  }, [q, age, selectedTagIds, duration, prepTime, location, countMin, countMax, price]);

  // ─── URL sync helper ───────────────────────────────────────────────────────

  const pushToUrl = useCallback(
    (filters: SidebarFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      const setOrDelete = (key: string, value: string) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      };

      const setOrDeleteArray = (key: string, values: string[]) => {
        if (values.length > 0) {
          params.set(key, values.join(","));
        } else {
          params.delete(key);
        }
      };

      setOrDelete("q", filters.q);
      setOrDeleteArray("age", filters.age);
      setOrDeleteArray("tags", filters.tags);
      setOrDeleteArray("duration", filters.duration);
      setOrDeleteArray("prep_time", filters.prep_time);
      setOrDelete("location", filters.location);
      setOrDelete("count_min", filters.count_min);
      setOrDelete("count_max", filters.count_max);
      setOrDeleteArray("price", filters.price);

      router.replace(`?${params.toString()}`, { scroll: false });
      onChange(filters);
    },
    [router, searchParams, onChange]
  );

  // ─── On mount: call onChange with URL-derived initial state ────────────────

  useEffect(() => {
    const initial = readFiltersFromParams(searchParams);
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Debounce: localQ → q ─────────────────────────────────────────────────

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      const trimmed = localQ.trim();
      const latest = latestRef.current;
      if (trimmed !== latest.q) {
        setQ(trimmed);
        pushToUrl({ ...latest, q: trimmed });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  // ─── Debounce: localLocation → location ───────────────────────────────────

  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);

    locationDebounceRef.current = setTimeout(() => {
      const trimmed = localLocation.trim();
      const latest = latestRef.current;
      if (trimmed !== latest.location) {
        setLocation(trimmed);
        pushToUrl({ ...latest, location: trimmed });
      }
    }, LOCATION_DEBOUNCE_MS);

    return () => {
      if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLocation]);

  // ─── Keyboard: close drawer on Escape ─────────────────────────────────────

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // ─── Focus management: move focus into drawer when it opens ───────────────

  useEffect(() => {
    if (!drawerOpen) return;
    // Defer one tick so the drawer is fully mounted before focusing
    const id = setTimeout(() => {
      drawerCloseButtonRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [drawerOpen]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSearchClear = () => {
    setLocalQ("");
    setQ("");
    pushToUrl({ ...latestRef.current, q: "" });
    searchInputRef.current?.focus();
  };

  const buildNextList = (list: string[], value: string): string[] =>
    list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];

  const handleAgeToggle = (value: string) => {
    const next = buildNextList(age, value);
    setAge(next);
    pushToUrl({ ...latestRef.current, age: next });
  };

  const handleTagToggle = (id: string) => {
    const next = buildNextList(selectedTagIds, id);
    setSelectedTagIds(next);
    pushToUrl({ ...latestRef.current, tags: next });
  };

  const handleDurationToggle = (value: string) => {
    const next = buildNextList(duration, value);
    setDuration(next);
    pushToUrl({ ...latestRef.current, duration: next });
  };

  const handlePrepTimeToggle = (value: string) => {
    const next = buildNextList(prepTime, value);
    setPrepTime(next);
    pushToUrl({ ...latestRef.current, prep_time: next });
  };

  const handlePriceToggle = (value: string) => {
    const next = buildNextList(price, value);
    setPrice(next);
    pushToUrl({ ...latestRef.current, price: next });
  };

  const handleCountMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setCountMin(value);
    pushToUrl({ ...latestRef.current, count_min: value });
  };

  const handleCountMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setCountMax(value);
    pushToUrl({ ...latestRef.current, count_max: value });
  };

  const handleClearAll = () => {
    setLocalQ("");
    setQ("");
    setAge([]);
    setSelectedTagIds([]);
    setDuration([]);
    setPrepTime([]);
    setLocalLocation("");
    setLocation("");
    setCountMin("");
    setCountMax("");
    setPrice([]);
    pushToUrl(EMPTY_FILTERS);
    searchInputRef.current?.focus();
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const currentFilters: SidebarFilters = {
    q,
    age,
    tags: selectedTagIds,
    duration,
    prep_time: prepTime,
    location,
    count_min: countMin,
    count_max: countMax,
    price,
  };

  const anyFilterActive = isFilterActive(currentFilters);
  const activeSidebarCount = countActiveFilters(currentFilters);

  const resultsText =
    totalCount === 0
      ? "Engar dagskrár fundust"
      : totalCount === 1
      ? "1 dagskrá"
      : `${totalCount} dagskrár`;

  // ─── Checkbox section renderer (reused for all multi-select groups) ────────

  const renderCheckboxGroup = ({
    sectionTitle,
    groupLabel,
    options,
    selected,
    onToggle,
    idPrefix,
  }: {
    sectionTitle: string;
    groupLabel: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    selected: string[];
    onToggle: (value: string) => void;
    idPrefix: string;
  }) => (
    <section className={styles.filterSection}>
      <h3 className={styles.filterSectionTitle}>
        {sectionTitle}
        {selected.length > 0 && (
          <span className={styles.sectionCount}> ({selected.length})</span>
        )}
      </h3>
      <fieldset className={styles.checkboxGroup} aria-label={groupLabel}>
        <legend className={styles.srOnly}>{groupLabel}</legend>
        {options.map((opt) => {
          const checkId = `${idPrefix}-${opt.value}`;
          const checked = selected.includes(opt.value);
          return (
            <label key={opt.value} htmlFor={checkId} className={styles.checkboxLabel}>
              <input
                id={checkId}
                type="checkbox"
                className={styles.checkboxInput}
                checked={checked}
                onChange={() => onToggle(opt.value)}
                disabled={isLoading}
              />
              <span className={styles.checkboxCustom} aria-hidden="true" />
              <span className={styles.checkboxText}>{opt.label}</span>
            </label>
          );
        })}
      </fieldset>
    </section>
  );

  // ─── Tag checkboxes (dynamic list) ────────────────────────────────────────

  const renderTagsSection = () => {
    if (availableTags.length === 0) return null;
    return (
      <section className={styles.filterSection}>
        <h3 className={styles.filterSectionTitle}>
          Merki
          {selectedTagIds.length > 0 && (
            <span className={styles.sectionCount}> ({selectedTagIds.length})</span>
          )}
        </h3>
        <fieldset className={styles.checkboxGroup} aria-label="Merki síur">
          <legend className={styles.srOnly}>Merki síur</legend>
          {availableTags.map((tag) => {
            const checkId = `tag-${tag.id}`;
            const checked = selectedTagIds.includes(tag.id);
            return (
              <label key={tag.id} htmlFor={checkId} className={styles.checkboxLabel}>
                <input
                  id={checkId}
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={checked}
                  onChange={() => handleTagToggle(tag.id)}
                  disabled={isLoading}
                />
                <span className={styles.checkboxCustom} aria-hidden="true" />
                <span className={styles.checkboxText}>{tag.name}</span>
                {tag.color && (
                  <span
                    className={styles.tagColorDot}
                    style={{ backgroundColor: tag.color }}
                    aria-hidden="true"
                  />
                )}
              </label>
            );
          })}
        </fieldset>
      </section>
    );
  };

  // ─── Inner filter panel content (shared between sidebar and drawer) ────────

  const renderFilterSections = () => (
    <>
      {renderCheckboxGroup({
        sectionTitle: "Aldurshópur",
        groupLabel: "Aldurshópur síur",
        options: AGE_GROUP_OPTIONS,
        selected: age,
        onToggle: handleAgeToggle,
        idPrefix: "age",
      })}

      {renderTagsSection()}

      {renderCheckboxGroup({
        sectionTitle: "Tímalengd",
        groupLabel: "Tímalengd síur",
        options: DURATION_OPTIONS,
        selected: duration,
        onToggle: handleDurationToggle,
        idPrefix: "duration",
      })}

      {renderCheckboxGroup({
        sectionTitle: "Undirbúningstími",
        groupLabel: "Undirbúningstími síur",
        options: PREP_TIME_OPTIONS,
        selected: prepTime,
        onToggle: handlePrepTimeToggle,
        idPrefix: "prep",
      })}

      {/* Location */}
      <section className={styles.filterSection}>
        <h3 className={styles.filterSectionTitle}>
          Staðsetning
          {location && <span className={styles.sectionCount}> (1)</span>}
        </h3>
        <div className={styles.textInputWrapper}>
          <input
            id="filter-location"
            type="text"
            className={styles.textInput}
            value={localLocation}
            onChange={(e) => setLocalLocation(e.target.value)}
            placeholder="Leita eftir stað..."
            disabled={isLoading}
            aria-label="Leita eftir staðsetningu"
            autoComplete="off"
          />
          {localLocation && (
            <button
              type="button"
              className={styles.textInputClear}
              onClick={() => {
                setLocalLocation("");
                setLocation("");
                pushToUrl({ ...latestRef.current, location: "" });
              }}
              aria-label="Hreinsa staðsetningu"
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
      </section>

      {/* Participant count */}
      <section className={styles.filterSection}>
        <h3 className={styles.filterSectionTitle}>
          Þátttakendur
          {(countMin || countMax) && (
            <span className={styles.sectionCount}> (1)</span>
          )}
        </h3>
        <div className={styles.countInputRow}>
          <label htmlFor="filter-count-min" className={styles.countLabel}>
            <span className={styles.countLabelText}>Lágmark þátttakenda</span>
            <input
              id="filter-count-min"
              type="number"
              inputMode="numeric"
              className={styles.countInput}
              value={countMin}
              onChange={handleCountMinChange}
              min={0}
              placeholder="0"
              disabled={isLoading}
            />
          </label>
          <span className={styles.countSeparator} aria-hidden="true">–</span>
          <label htmlFor="filter-count-max" className={styles.countLabel}>
            <span className={styles.countLabelText}>Hámark þátttakenda</span>
            <input
              id="filter-count-max"
              type="number"
              inputMode="numeric"
              className={styles.countInput}
              value={countMax}
              onChange={handleCountMaxChange}
              min={0}
              placeholder="∞"
              disabled={isLoading}
            />
          </label>
        </div>
      </section>

      {renderCheckboxGroup({
        sectionTitle: "Verð",
        groupLabel: "Verð síur",
        options: PRICE_OPTIONS,
        selected: price,
        onToggle: handlePriceToggle,
        idPrefix: "price",
      })}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Search bar — always visible, sits outside/above sidebar ── */}
      <div className={styles.searchBarWrapper}>
        <div className={styles.searchInputWrapper}>
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
            id={searchId}
            ref={searchInputRef}
            type="search"
            className={styles.searchInput}
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

        {/* Results count — visible at the search bar level */}
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
            <span className={totalCount === 0 ? styles.resultsEmpty : styles.resultsText}>
              {resultsText}
            </span>
          )}
        </div>

        {/* Mobile: "Síur" button that opens drawer */}
        <button
          type="button"
          className={`${styles.mobileFiltersButton} ${activeSidebarCount > 0 ? styles.mobileFiltersButtonActive : ""}`}
          onClick={() => setDrawerOpen(true)}
          aria-label={
            activeSidebarCount > 0
              ? `Opna síur, ${activeSidebarCount} virkar síur`
              : "Opna síur"
          }
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
          {activeSidebarCount > 0 ? `Síur (${activeSidebarCount})` : "Síur"}
        </button>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        role="search"
        aria-label="Sía dagskrár"
        className={`${styles.sidebar} ${className}`}
      >
        {/* Sidebar header */}
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Síur</h2>
          {anyFilterActive && (
            <button
              type="button"
              className={styles.clearAllButton}
              onClick={handleClearAll}
              aria-label="Hreinsa allar síur"
            >
              Hreinsa síur
            </button>
          )}
        </div>

        {/* Scrollable filter sections */}
        <div className={styles.sidebarBody}>
          {renderFilterSections()}
        </div>
      </aside>

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
              <h2 className={styles.drawerTitle}>
                Síur
                {activeSidebarCount > 0 && (
                  <span className={styles.drawerTitleCount}> ({activeSidebarCount})</span>
                )}
              </h2>
              <button
                ref={drawerCloseButtonRef}
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
              {renderFilterSections()}
            </div>

            <div className={styles.drawerFooter}>
              {anyFilterActive && (
                <button
                  type="button"
                  className={styles.drawerClearButton}
                  onClick={() => {
                    handleClearAll();
                    setDrawerOpen(false);
                  }}
                  aria-label="Hreinsa allar síur"
                >
                  Hreinsa síur
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
    </>
  );
}
