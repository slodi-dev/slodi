import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";
import { User } from "@/services/users.service";

export type Program = {
  id: string;
  content_type: "program";
  name: string;
  description: string | null;
  public: boolean;
  like_count: number;
  created_at: string;
  author_id: string;
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
  duration?: string | null;
  prep_time?: string | null;
  age?: string | null;
  location?: string | null;
  count?: number | null;
  price?: number | null;
};

export type ProgramCreateInput = {
  name: string;
  description?: string;
  image?: string;
  instructions?: string;
  equipment?: string[];
  duration?: string;
  prep_time?: string;
  age?: string;
  location?: string;
  count?: number;
  price?: number;
  tagNames?: string[];
  workspaceId: string; // Required - workspace to create program in
};

export type ProgramUpdateInput = {
  name?: string;
  description?: string | null;
  public?: boolean;
  image?: string | null;
  instructions?: string | null;
  equipment?: string[] | null;
  duration?: string | null;
  prep_time?: string | null;
  age?: string | null;
  location?: string | null;
  count?: number | null;
  price?: number | null;
  tagNames?: string[]; // omit to leave tags unchanged; pass [] to clear all tags
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
): Promise<Program[]> {
  const url = buildApiUrl(`/workspaces/${workspaceId}/programs`);
  const data = await fetchWithAuth<ProgramsResponse>(
    url,
    {
      method: "GET",
    },
    getToken
  );

  return Array.isArray(data) ? data : data.programs || [];
}

/**
 * Fetch a single program by ID
 * Requires authentication
 */
export async function fetchProgramById(
  id: string,
  getToken: () => Promise<string | null>
): Promise<Program> {
  const url = buildApiUrl(`/programs/${id}`);
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
export async function createProgram(
  input: ProgramCreateInput,
  getToken: () => Promise<string | null>
): Promise<Program> {
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    image: input.image?.trim() || null,
    instructions: input.instructions?.trim() || null,
    equipment: input.equipment && input.equipment.length > 0 ? input.equipment : null,
    duration: input.duration?.trim() || null,
    prep_time: input.prep_time?.trim() || null,
    age: input.age?.trim() || null,
    location: input.location?.trim() || null,
    count: input.count ?? null,
    price: input.price ?? null,
    tag_names: input.tagNames && input.tagNames.length > 0 ? input.tagNames : null,
    content_type: "program" as const,
  };

  const url = buildApiUrl(`/workspaces/${input.workspaceId}/programs`);

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
 * Like or unlike a program
 * Requires authentication
 */
export async function toggleProgramLike(
  programId: string,
  action: "like" | "unlike",
  getToken: () => Promise<string | null>
): Promise<{ liked: boolean; likeCount: number }> {
  const url = buildApiUrl(`/programs/${programId}/like`);
  return fetchWithAuth<{ liked: boolean; likeCount: number }>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    },
    getToken
  );
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
