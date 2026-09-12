import { buildApiUrl } from "@/lib/api-utils";
import type { BankContentType } from "@/components/ContentTypeChooser/ContentTypeChooser";
import { fetchWithAuth, fetchPageWithAuth } from "@/lib/api";
import { User } from "@/services/users.service";

export type Program = {
  id: string;
  /** The bank lists all three kinds now, so this is no longer always "program". */
  content_type: "program" | "event" | "task";
  name: string;
  description: string | null;
  public: boolean;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
  author_id: string;
  author_name: string;
  image: string | null;
  workspace_id: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  tags?: Array<{ id: string; name: string }>;
  comment_count?: number;
  // Extended backend fields (ContentBase)
  instructions?: string | null;
  equipment?: string[] | null;
  duration_min?: number | null;
  duration_max?: number | null;
  prep_time_min?: number | null;
  prep_time_max?: number | null;
  age?: string[] | null;
  location?: string | null;
  count_min?: number | null;
  count_max?: number | null;
  price?: number | null;
  /** Documents uploaded alongside the item; images go to `image`. */
  media?: { documents?: Array<{ name: string; url: string; content_type?: string | null }> } | null;
  comments?: ContentComment[];
};

/** A leader's public comment on a bank item — not a reviewer's note. */
export type ContentComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  content_id: string;
  author_name: string;
};

export type ProgramCreateInput = {
  name: string;
  description?: string;
  image?: string;
  instructions?: string;
  equipment?: string[];
  duration_min?: number;
  duration_max?: number;
  prep_time_min?: number;
  prep_time_max?: number;
  age?: string[];
  location?: string;
  count_min?: number;
  count_max?: number;
  price?: number;
  tagNames?: string[];
  /** Free-form JSONB. `documents` is the shape Yfirferð reads attachments from. */
  media?: Record<string, unknown>;
  workspaceId: string; // Required - workspace to create program in
};

export type ProgramUpdateInput = {
  name?: string;
  description?: string | null;
  public?: boolean;
  image?: string | null;
  instructions?: string | null;
  equipment?: string[] | null;
  duration_min?: number | null;
  duration_max?: number | null;
  prep_time_min?: number | null;
  prep_time_max?: number | null;
  age?: string[] | null;
  location?: string | null;
  count_min?: number | null;
  count_max?: number | null;
  price?: number | null;
  tagNames?: string[];
  /** Free-form JSONB. `documents` is the shape Yfirferð reads attachments from. */
  media?: Record<string, unknown>; // omit to leave tags unchanged; pass [] to clear all tags
};

export type ProgramsResponse = Program[] | { programs: Program[] };

/**
 * Check if a user can edit a program.
 * @deprecated Use `canEditProgram` from `@/lib/permissions` with workspace role for accurate checks.
 */
export function canEditProgram(user: User | null, program: Program): boolean {
  if (!user || !program) return false;
  return user.id === program.author_id;
}

/** What the bank can be narrowed by. Mirrors the query params on `/content`. */
export type ContentQuery = {
  search?: string;
  ages?: string[];
  tags?: string[];
  equipment?: string[];
  author?: string;
  location?: string;
  durationMin?: number;
  durationMax?: number;
  prepMin?: number;
  prepMax?: number;
  countMin?: number;
  countMax?: number;
  freeOnly?: boolean;
  priceMax?: number;
  sortBy?: string;
};

/** The option lists the filter sidebar offers, across the whole bank. */
export type ContentFacets = {
  locations: string[];
  equipment: string[];
  authors: string[];
  tags: string[];
};

function buildContentParams(query: ContentQuery, limit: number, offset: number): URLSearchParams {
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  p.set("offset", String(offset));

  if (query.search?.trim()) p.set("search", query.search.trim());
  for (const age of query.ages ?? []) p.append("age", age);
  for (const tag of query.tags ?? []) p.append("tags", tag);
  for (const item of query.equipment ?? []) p.append("equipment", item);
  if (query.author?.trim()) p.set("author", query.author.trim());
  if (query.location?.trim()) p.set("location", query.location.trim());
  if (query.durationMin !== undefined) p.set("duration_min", String(query.durationMin));
  if (query.durationMax !== undefined) p.set("duration_max", String(query.durationMax));
  if (query.prepMin !== undefined) p.set("prep_time_min", String(query.prepMin));
  if (query.prepMax !== undefined) p.set("prep_time_max", String(query.prepMax));
  if (query.countMin !== undefined) p.set("count_min", String(query.countMin));
  if (query.countMax !== undefined) p.set("count_max", String(query.countMax));
  // `freeOnly` is price_max=0, which the backend reads as "free or unpriced".
  if (query.freeOnly) p.set("price_max", "0");
  else if (query.priceMax !== undefined) p.set("price_max", String(query.priceMax));
  if (query.sortBy) p.set("sort_by", query.sortBy);

  return p;
}

/**
 * One page of the bank, filtered and sorted by the server.
 *
 * Both halves of that sentence matter. This used to fetch a flat `limit=200`
 * and let the browser filter and slice it, which meant the bank showed 200 of
 * 10.004 items and called the result "everything" — a filter that matched
 * nothing on the first 200 rows reported an empty bank.
 *
 * `/content`, not `/programs`: the latter returns only rows whose content_type
 * is "program", which was indistinguishable from "everything" while the create
 * form filed every submission as one.
 */
export async function fetchPrograms(
  workspaceId: string,
  getToken: () => Promise<string | null>,
  options: { query?: ContentQuery; limit?: number; offset?: number } = {}
): Promise<{ items: Program[]; total: number | null }> {
  const { query = {}, limit = 24, offset = 0 } = options;
  const params = buildContentParams(query, limit, offset);
  const url = buildApiUrl(`/workspaces/${workspaceId}/content?${params.toString()}`);
  return fetchPageWithAuth<Program>(url, { method: "GET" }, getToken);
}

/**
 * The filter sidebar's option lists.
 *
 * Derived in the browser before, from whatever rows had been fetched — which
 * offered one page's worth of equipment once the grid started paging.
 */
export async function fetchContentFacets(
  workspaceId: string,
  getToken: () => Promise<string | null>
): Promise<ContentFacets> {
  const url = buildApiUrl(`/workspaces/${workspaceId}/content/facets`);
  const raw = await fetchWithAuth<Partial<ContentFacets>>(url, { method: "GET" }, getToken);
  return {
    locations: raw.locations ?? [],
    equipment: raw.equipment ?? [],
    authors: raw.authors ?? [],
    tags: raw.tags ?? [],
  };
}

/**
 * Fetch a single program by ID
 * Requires authentication
 */
export async function fetchProgramById(
  id: string,
  getToken: () => Promise<string | null>
): Promise<Program> {
  // `/content/{id}`, not `/programs/{id}`, for the same reason the listing
  // moved: the latter selects `Program`, which under joined-table inheritance
  // matches only rows whose content_type is "program". Every Verkefni a leader
  // submitted 404'd on the page the bank had just linked them to.
  const url = buildApiUrl(`/content/${id}`);
  return fetchWithAuth<Program>(
    url,
    {
      method: "GET",
    },
    getToken
  );
}

/**
 * Create a new program
 * Requires authentication - backend will set author_id from authenticated user
 */
/**
 * Where each content type is created, and what it calls itself on the wire.
 *
 * The three share every field a bank submission carries — a Verkefni and a
 * Viðburður differ in what they *are*, not in what you write about them — so
 * one payload serves all three and only the route and the discriminator change.
 */
const CREATE_ROUTE: Record<BankContentType, string> = {
  task: "tasks",
  event: "events",
  program: "programs",
};

/**
 * Put something in the bank.
 *
 * Everything used to go through `createProgram`, which hardcoded
 * `content_type: "program"` — so a leikur submitted by a leader was stored as a
 * Dagskrá, a *collection*, and arrived in the review queue as an empty one.
 * The type is now the caller's to state, and `ContentTypeChooser` is what asks.
 *
 * **No date is sent for an event.** A bank Viðburður is a template somebody may
 * run in March or September; `start_dt` is nullable precisely so it can stay
 * unanswered rather than defaulting to the moment of submission.
 */
export async function createBankContent(
  type: BankContentType,
  input: ProgramCreateInput,
  getToken: () => Promise<string | null>
): Promise<Program> {
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    image: input.image?.trim() || null,
    instructions: input.instructions?.trim() || null,
    equipment: input.equipment && input.equipment.length > 0 ? input.equipment : null,
    duration_min: input.duration_min ?? null,
    duration_max: input.duration_max ?? null,
    prep_time_min: input.prep_time_min ?? null,
    prep_time_max: input.prep_time_max ?? null,
    age: input.age && input.age.length > 0 ? input.age : null,
    location: input.location?.trim() || null,
    count_min: input.count_min ?? null,
    count_max: input.count_max ?? null,
    price: input.price ?? null,
    tag_names: input.tagNames && input.tagNames.length > 0 ? input.tagNames : null,
    media: input.media ?? null,
    content_type: type,
  };

  const url = buildApiUrl(`/workspaces/${input.workspaceId}/${CREATE_ROUTE[type]}`);

  const data = await fetchWithAuth<Program | Program[]>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    getToken
  );

  return Array.isArray(data) ? data[0] : data;
}

/** Back-compat shim for callers that only ever make a Dagskrá. */
export async function createProgram(
  input: ProgramCreateInput,
  getToken: () => Promise<string | null>
): Promise<Program> {
  return createBankContent("program", input, getToken);
}

/**
 * Update an existing program
 * Requires authentication
 */
export async function updateProgram(
  id: string,
  input: ProgramUpdateInput,
  getToken: () => Promise<string | null>
): Promise<Program> {
  const { tagNames, ...rest } = input;
  const body = tagNames !== undefined ? { ...rest, tag_names: tagNames } : rest;
  const url = buildApiUrl(`/programs/${id}`);
  return fetchWithAuth<Program>(
    url,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    getToken
  );
}

/**
 * Delete a program
 * Requires authentication
 */
export async function deleteProgram(
  id: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const url = buildApiUrl(`/programs/${id}`);
  await fetchWithAuth(
    url,
    {
      method: "DELETE",
    },
    getToken
  );
}

/**
 * Like a program. Requires authentication.
 */
export async function likeProgram(
  programId: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const url = buildApiUrl(`/content/${programId}/likes`);
  await fetchWithAuth<void>(url, { method: "POST" }, getToken);
}

/**
 * Unlike a program. Requires authentication.
 */
export async function unlikeProgram(
  programId: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const url = buildApiUrl(`/content/${programId}/likes`);
  await fetchWithAuth<void>(url, { method: "DELETE" }, getToken);
}

/**
 * Filter programs by search query
 */
export function filterProgramsByQuery(programs: Program[], query: string): Program[] {
  if (!query.trim()) return programs;

  const q = query.trim().toLowerCase();
  return programs.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
  );
}

/**
 * Filter programs by tags (OR logic - matches ANY selected tag)
 */
export function filterProgramsByTags(programs: Program[], selectedTags: string[]): Program[] {
  if (selectedTags.length === 0) return programs;

  return programs.filter((p) => {
    const programTagNames = (p.tags || []).map((t) => t.name);
    return selectedTags.some((selectedTag) => programTagNames.includes(selectedTag));
  });
}

/**
 * Sort programs by specified criteria
 */
export function sortPrograms(
  programs: Program[],
  sortBy: "newest" | "oldest" | "most-liked" | "alphabetical"
): Program[] {
  const sorted = [...programs];

  switch (sortBy) {
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    case "most-liked":
      return sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "is"));
    default:
      return sorted;
  }
}
