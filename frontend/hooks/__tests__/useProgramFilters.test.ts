import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useProgramFilters,
  DEFAULT_FILTERS,
  filtersToParams,
  paramsToFilters,
} from "../useProgramFilters";
import type { Program } from "@/services/programs.service";

// ── Mock next/navigation ─────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/programs",
}));

// ── Mock program fixtures ────────────────────────────────────────────────────

function createProgram(overrides: Partial<Program> = {}): Program {
  // Keep the denormalized author_id / author_name fields in sync with the
  // nested `author` object. When a test overrides `author`, the top-level
  // fields have to follow or `useProgramFilters` (which reads `author_name`
  // first via `??`) won't see the override.
  const author = overrides.author ?? { id: "a1", name: "Author One", email: "a@test.is" };
  return {
    id: "p-" + Math.random().toString(36).slice(2, 8),
    content_type: "program",
    name: "Default Program",
    description: null,
    public: true,
    like_count: 0,
    liked_by_me: false,
    created_at: "2026-01-01T00:00:00Z",
    author_id: author.id,
    author_name: author.name,
    image: null,
    workspace_id: "w1",
    author,
    workspace: { id: "w1", name: "Workspace" },
    ...overrides,
  };
}

const PROGRAMS: Program[] = [
  createProgram({
    id: "p1",
    name: "Skátaleikur",
    description: "Fun scout game",
    age: ["Hrefnuskátar", "Drekaskátar"],
    price: 0,
    like_count: 10,
    created_at: "2026-01-10T00:00:00Z",
    author_name: "Jón Jónsson",
    author: { id: "a1", name: "Jón Jónsson", email: "jon@test.is" },
    location: "Reykjavík",
    tags: [{ id: "t1", name: "Útileikur" }],
    duration_min: 30,
    duration_max: 60,
    count_min: 5,
    count_max: 15,
  }),
  createProgram({
    id: "p2",
    name: "Útivist",
    description: "Outdoor adventure",
    age: ["Fálkaskátar"],
    price: 2000,
    like_count: 5,
    created_at: "2026-02-15T00:00:00Z",
    author_name: "Anna Sigurdsson",
    author: { id: "a2", name: "Anna Sigurdsson", email: "anna@test.is" },
    location: "Akureyri",
    tags: [{ id: "t2", name: "Gönguferð" }],
    duration_min: 60,
    duration_max: 120,
    count_min: 10,
    count_max: 30,
  }),
  createProgram({
    id: "p3",
    name: "Búðadagskrá",
    description: "Camp program",
    age: ["Hrefnuskátar"],
    price: 500,
    like_count: 20,
    created_at: "2026-03-01T00:00:00Z",
    author_name: "Guðrún Helga",
    author: { id: "a3", name: "Guðrún Helga", email: "gudrun@test.is" },
    location: "Reykjavík",
    tags: [
      { id: "t1", name: "Útileikur" },
      { id: "t3", name: "Búðir" },
    ],
    duration_min: 120,
    duration_max: 240,
    count_min: 20,
    count_max: 50,
  }),
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useProgramFilters", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("returns all programs when no filters are active", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    expect(result.current.filtered).toHaveLength(3);
  });

  it("filters programs matching age filter (OR logic)", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ ages: ["Fálkaskátar"] });
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe("p2");
  });

  it("age filter with multiple values uses OR logic", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ ages: ["Fálkaskátar", "Drekaskátar"] });
    });

    // p1 has Drekaskátar, p2 has Fálkaskátar
    expect(result.current.filtered).toHaveLength(2);
    const ids = result.current.filtered.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
  });

  it("freeOnly excludes programs with price > 0", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ freeOnly: true });
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe("p1");
    expect(result.current.filtered[0].price).toBe(0);
  });

  it("text search matches on name (case-insensitive)", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ search: "útivist" });
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe("p2");
  });

  it("text search matches on description", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ search: "camp" });
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe("p3");
  });

  it("text search matches on author name", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ search: "guðrún" });
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe("p3");
  });

  it("clearAll resets all fields to DEFAULT_FILTERS", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({
        search: "test",
        ages: ["Hrefnuskátar"],
        freeOnly: true,
        sortBy: "alpha",
      });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(result.current.filtered).toHaveLength(3);
  });

  it("sort 'alpha' orders correctly with Icelandic locale", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ sortBy: "alpha" });
    });

    const names = result.current.filtered.map((p) => p.name);
    // Icelandic alphabetical order: B < S < Ú
    expect(names).toEqual(["Búðadagskrá", "Skátaleikur", "Útivist"]);
  });

  it("sort 'liked' orders by like_count descending", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ sortBy: "liked" });
    });

    const likeCounts = result.current.filtered.map((p) => p.like_count);
    expect(likeCounts).toEqual([20, 10, 5]);
  });

  it("sort 'newest' orders by created_at descending", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ sortBy: "newest" });
    });

    const ids = result.current.filtered.map((p) => p.id);
    // p3 is March, p2 is February, p1 is January
    expect(ids).toEqual(["p3", "p2", "p1"]);
  });

  it("sort 'oldest' orders by created_at ascending", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ sortBy: "oldest" });
    });

    const ids = result.current.filtered.map((p) => p.id);
    expect(ids).toEqual(["p1", "p2", "p3"]);
  });

  it("location filter matches case-insensitively", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ location: "reykjavík" });
    });

    expect(result.current.filtered).toHaveLength(2);
    const ids = result.current.filtered.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
  });

  it("priceMax filters programs above threshold", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({ priceMax: 1000 });
    });

    // p1 (0) and p3 (500) are <= 1000
    expect(result.current.filtered).toHaveLength(2);
    const ids = result.current.filtered.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
  });

  it("multiple filters combine correctly", () => {
    const { result } = renderHook(() => useProgramFilters(PROGRAMS));

    act(() => {
      result.current.setFilters({
        ages: ["Hrefnuskátar"],
        location: "Reykjavík",
      });
    });

    // p1 has Hrefnuskátar + Reykjavík, p3 has Hrefnuskátar + Reykjavík
    expect(result.current.filtered).toHaveLength(2);
  });
});

// ── URL serialisation ────────────────────────────────────────────────────────

describe("filtersToParams / paramsToFilters round-trip", () => {
  it("round-trips default filters to empty params", () => {
    const params = filtersToParams(DEFAULT_FILTERS);
    expect(params.toString()).toBe("");

    const restored = paramsToFilters(params);
    expect(restored).toEqual(DEFAULT_FILTERS);
  });

  it("round-trips complex filter state", () => {
    const state = {
      ...DEFAULT_FILTERS,
      search: "test",
      ages: ["Hrefnuskátar", "Drekaskátar"],
      freeOnly: true,
      sortBy: "alpha" as const,
      durationMin: 30,
      durationMax: 60,
    };

    const params = filtersToParams(state);
    const restored = paramsToFilters(params);

    expect(restored.search).toBe("test");
    expect(restored.ages).toEqual(["Hrefnuskátar", "Drekaskátar"]);
    expect(restored.freeOnly).toBe(true);
    expect(restored.sortBy).toBe("alpha");
    expect(restored.durationMin).toBe(30);
    expect(restored.durationMax).toBe(60);
  });

  it("paramsToFilters handles invalid sortBy gracefully", () => {
    const params = new URLSearchParams({ sortBy: "invalid" });
    const result = paramsToFilters(params);
    expect(result.sortBy).toBe("newest");
  });

  it("paramsToFilters handles non-numeric values", () => {
    const params = new URLSearchParams({ durationMin: "abc" });
    const result = paramsToFilters(params);
    expect(result.durationMin).toBeUndefined();
  });
});
