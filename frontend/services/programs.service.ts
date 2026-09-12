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

/**
 * Fetch all programs for a workspace
 * Requires authentication
 */
export async function fetchPrograms(
  workspaceId: string,
  getToken: () => Promise<string | null>
): Promise<{ items: Program[]; total: number | null }> {
  // `/content`, not `/programs`: the latter returns only rows whose
  // content_type is "program", which was indistinguishable from "everything"
  // while the create form filed every submission as one. The moment the
  // chooser started filing a Verkefni as a task, those vanished from the bank
  // they had just been added to.
  const url = buildApiUrl(`/workspaces/${workspaceId}/content?limit=200`);
  const page = await fetchPageWithAuth<Program>(
    url,
    {
      method: "GET",
    },
    getToken
  );

  return page;
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
 * Extract unique tags from programs list
 */
export function extractTags(programs: Program[]): string[] {
  const tagNames = programs.flatMap((p) => (p.tags || []).map((t) => t.name));
  return Array.from(new Set(tagNames));
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
