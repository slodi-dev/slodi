"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Program } from "@/services/programs.service";
import { formatDuration, formatPrepTime, formatParticipants, formatPrice } from "@/lib/format";

// ── FilterState type ────────────────────────────────────────────────────────────

export interface FilterState {
  search: string;
  ages: string[];
  tags: string[];
  equipment: string[];
  author: string;
  location: string;
  durationMin: number | undefined;
  durationMax: number | undefined;
  prepMin: number | undefined;
  prepMax: number | undefined;
  countMin: number | undefined;
  countMax: number | undefined;
  freeOnly: boolean;
  priceMax: number | undefined;
  sortBy: "newest" | "oldest" | "liked" | "alpha";
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  ages: [],
  tags: [],
  equipment: [],
  author: "",
  location: "",
  durationMin: undefined,
  durationMax: undefined,
  prepMin: undefined,
  prepMax: undefined,
  countMin: undefined,
  countMax: undefined,
  freeOnly: false,
  priceMax: undefined,
  sortBy: "newest",
};

// ── Active chip type ────────────────────────────────────────────────────────────

export interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

// ── URL serialisation ───────────────────────────────────────────────────────────

const SORT_VALUES = ["newest", "oldest", "liked", "alpha"] as const;

function isSortValue(v: string): v is FilterState["sortBy"] {
  return (SORT_VALUES as readonly string[]).includes(v);
}

export function filtersToParams(f: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (f.search) params.set("search", f.search);
  if (f.ages.length > 0) params.set("ages", f.ages.join(","));
  if (f.tags.length > 0) params.set("tags", f.tags.join(","));
  if (f.equipment.length > 0) params.set("equipment", f.equipment.join(","));
  if (f.author) params.set("author", f.author);
  if (f.location) params.set("location", f.location);
  if (f.durationMin !== undefined) params.set("durationMin", String(f.durationMin));
  if (f.durationMax !== undefined) params.set("durationMax", String(f.durationMax));
  if (f.prepMin !== undefined) params.set("prepMin", String(f.prepMin));
  if (f.prepMax !== undefined) params.set("prepMax", String(f.prepMax));
  if (f.countMin !== undefined) params.set("countMin", String(f.countMin));
  if (f.countMax !== undefined) params.set("countMax", String(f.countMax));
  if (f.freeOnly) params.set("freeOnly", "1");
  if (f.priceMax !== undefined) params.set("priceMax", String(f.priceMax));
  if (f.sortBy !== "newest") params.set("sortBy", f.sortBy);

  return params;
}

export function paramsToFilters(p: URLSearchParams): FilterState {
  const parseNum = (key: string): number | undefined => {
    const v = p.get(key);
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const parseArray = (key: string): string[] => {
    const v = p.get(key);
    if (!v) return [];
    return v.split(",").filter(Boolean);
  };

  const sortRaw = p.get("sortBy") ?? "newest";

  return {
    search: p.get("search") ?? "",
    ages: parseArray("ages"),
    tags: parseArray("tags"),
    equipment: parseArray("equipment"),
    author: p.get("author") ?? "",
    location: p.get("location") ?? "",
    durationMin: parseNum("durationMin"),
    durationMax: parseNum("durationMax"),
    prepMin: parseNum("prepMin"),
    prepMax: parseNum("prepMax"),
    countMin: parseNum("countMin"),
    countMax: parseNum("countMax"),
    freeOnly: p.get("freeOnly") === "1",
    priceMax: parseNum("priceMax"),
    sortBy: isSortValue(sortRaw) ? sortRaw : "newest",
  };
}

// ── Client-side filtering ───────────────────────────────────────────────────────

function getAuthorName(program: Program): string {
  return program.author?.name ?? "";
}

function applyFilters(programs: Program[], f: FilterState): Program[] {
  let result = programs;

  // 1. Text search: case-insensitive on name, description, author name
  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        getAuthorName(p).toLowerCase().includes(q)
    );
  }

  // 2. Age groups: OR logic
  if (f.ages.length > 0) {
    result = result.filter((p) => {
      const programAges = p.age ?? [];
      return f.ages.some((age) => programAges.includes(age));
    });
  }

  // 3. Tags: OR logic
  if (f.tags.length > 0) {
    result = result.filter((p) => {
      const programTags = (p.tags ?? []).map((t) => t.name);
      return f.tags.some((tag) => programTags.includes(tag));
    });
  }

  // 4. Equipment: OR logic
  if (f.equipment.length > 0) {
    result = result.filter((p) => {
      const programEquipment = p.equipment ?? [];
      return f.equipment.some((item) => programEquipment.includes(item));
    });
  }

  // 5. Duration range
  if (f.durationMin !== undefined) {
    result = result.filter((p) => p.duration_min != null && p.duration_min >= f.durationMin!);
  }
  if (f.durationMax !== undefined) {
    result = result.filter((p) => p.duration_max != null && p.duration_max <= f.durationMax!);
  }

  // 6. Prep time range
  if (f.prepMin !== undefined) {
    result = result.filter((p) => p.prep_time_min != null && p.prep_time_min >= f.prepMin!);
  }
  if (f.prepMax !== undefined) {
    result = result.filter((p) => p.prep_time_max != null && p.prep_time_max <= f.prepMax!);
  }

  // 7. Participant count range
  if (f.countMin !== undefined) {
    result = result.filter((p) => p.count_min != null && p.count_min >= f.countMin!);
  }
  if (f.countMax !== undefined) {
    result = result.filter((p) => p.count_max != null && p.count_max <= f.countMax!);
  }

  // 8. Price filters
  if (f.freeOnly) {
    result = result.filter((p) => p.price === 0 || p.price == null);
  } else if (f.priceMax !== undefined) {
    result = result.filter((p) => p.price != null && p.price <= f.priceMax!);
  }

  // 9. Location: case-insensitive includes
  if (f.location) {
    const loc = f.location.toLowerCase();
    result = result.filter((p) => (p.location ?? "").toLowerCase().includes(loc));
  }

  // 10. Author: case-insensitive includes
  if (f.author) {
    const auth = f.author.toLowerCase();
    result = result.filter((p) => getAuthorName(p).toLowerCase().includes(auth));
  }

  // Sort after filtering
  const sorted = [...result];
  switch (f.sortBy) {
    case "newest":
      sorted.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      break;
    case "oldest":
      sorted.sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
      break;
    case "liked":
      sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      break;
    case "alpha":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "is"));
      break;
  }

  return sorted;
}

// ── Chip derivation ─────────────────────────────────────────────────────────────

function deriveChips(f: FilterState, patch: (next: Partial<FilterState>) => void): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (f.search) {
    chips.push({
      key: "search",
      label: `"${f.search}"`,
      remove: () => patch({ search: "" }),
    });
  }

  for (const age of f.ages) {
    chips.push({
      key: `age-${age}`,
      label: age,
      remove: () => patch({ ages: f.ages.filter((a) => a !== age) }),
    });
  }

  for (const tag of f.tags) {
    chips.push({
      key: `tag-${tag}`,
      label: tag,
      remove: () => patch({ tags: f.tags.filter((t) => t !== tag) }),
    });
  }

  for (const item of f.equipment) {
    chips.push({
      key: `eq-${item}`,
      label: item,
      remove: () => patch({ equipment: f.equipment.filter((e) => e !== item) }),
    });
  }

  if (f.freeOnly) {
    chips.push({
      key: "freeOnly",
      label: "Ókeypis",
      remove: () => patch({ freeOnly: false }),
    });
  }

  if (f.location) {
    chips.push({
      key: "location",
      label: f.location,
      remove: () => patch({ location: "" }),
    });
  }

  if (f.author) {
    chips.push({
      key: "author",
      label: `Höfundur: ${f.author}`,
      remove: () => patch({ author: "" }),
    });
  }

  if (f.priceMax !== undefined) {
    chips.push({
      key: "priceMax",
      label: `Hámark: ${formatPrice(f.priceMax)}`,
      remove: () => patch({ priceMax: undefined }),
    });
  }

  if (f.durationMin !== undefined || f.durationMax !== undefined) {
    const label = `Lengd: ${formatDuration(f.durationMin, f.durationMax)}`;
    chips.push({
      key: "duration",
      label,
      remove: () => patch({ durationMin: undefined, durationMax: undefined }),
    });
  }

  if (f.prepMin !== undefined || f.prepMax !== undefined) {
    const label = `Undirbúningur: ${formatPrepTime(f.prepMin, f.prepMax)}`;
    chips.push({
      key: "prep",
      label,
      remove: () => patch({ prepMin: undefined, prepMax: undefined }),
    });
  }

  if (f.countMin !== undefined || f.countMax !== undefined) {
    const label = `Fjöldi: ${formatParticipants(f.countMin, f.countMax)}`;
    chips.push({
      key: "count",
      label,
      remove: () => patch({ countMin: undefined, countMax: undefined }),
    });
  }

  return chips;
}

// ── Unique value extraction ─────────────────────────────────────────────────────

function extractUniqueLocations(programs: Program[]): string[] {
  const locations = new Set<string>();
  for (const p of programs) {
    if (p.location) locations.add(p.location);
  }
  return Array.from(locations).sort((a, b) => a.localeCompare(b, "is"));
}

function extractUniqueAuthors(programs: Program[]): string[] {
  const authors = new Set<string>();
  for (const p of programs) {
    const name = getAuthorName(p);
    if (name) authors.add(name);
  }
  return Array.from(authors).sort((a, b) => a.localeCompare(b, "is"));
}

function extractUniqueTags(programs: Program[]): string[] {
  const tags = new Set<string>();
  for (const p of programs) {
    for (const t of p.tags ?? []) {
      tags.add(t.name);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b, "is"));
}

function extractUniqueEquipment(programs: Program[]): string[] {
  const items = new Set<string>();
  for (const p of programs) {
    for (const e of p.equipment ?? []) {
      items.add(e);
    }
  }
  return Array.from(items).sort((a, b) => a.localeCompare(b, "is"));
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useProgramFilters(allPrograms: Program[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialise from URL on mount
  const [filters, setFiltersState] = useState<FilterState>(() => paramsToFilters(searchParams));

  // Track whether this is the initial mount to avoid writing URL on first render
  const isInitialMount = useRef(true);

  // Sync URL when filters change (but skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = filtersToParams(filters);
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url, { scroll: false });
  }, [filters, pathname, router]);

  // Merge partial updates
  const setFilters = useCallback((next: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  // Clear all filters and URL
  const clearAll = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  // Memoised filtered + sorted result
  const filtered = useMemo(() => applyFilters(allPrograms, filters), [allPrograms, filters]);

  // Active chips
  const activeChips = useMemo(() => deriveChips(filters, setFilters), [filters, setFilters]);

  // Unique value arrays derived from all programs
  const uniqueLocations = useMemo(() => extractUniqueLocations(allPrograms), [allPrograms]);
  const uniqueAuthors = useMemo(() => extractUniqueAuthors(allPrograms), [allPrograms]);
  const uniqueTags = useMemo(() => extractUniqueTags(allPrograms), [allPrograms]);
  const uniqueEquipment = useMemo(() => extractUniqueEquipment(allPrograms), [allPrograms]);

  return {
    filters,
    setFilters,
    filtered,
    activeChips,
    clearAll,
    uniqueLocations,
    uniqueAuthors,
    uniqueTags,
    uniqueEquipment,
  };
}
