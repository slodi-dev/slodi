import { buildApiUrl, fetchAndCheck } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";
import { findTagIdByName, addTagToContent } from "@/services/tags.service";
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
};

export type ProgramCreateInput = {
  name: string;
  description?: string;
  public?: boolean;
  image?: string;
  imageFile?: File;
  tags?: string[];
  workspaceId: string; // Required - workspace to create program in
};

export type ProgramUpdateInput = {
  name?: string;
  description?: string;
  public?: boolean;
  image?: string;
  tags?: string[];
};

export interface ProgramUpdateFormData {
  name: string;
  description: string | null;
  public: boolean;
  image: string | null;
}

export type ProgramsResponse = Program[] | { programs: Program[] };

/**
 * Check if a user can edit a program
 * User can edit if they are the author of the program
 */
export function canEditProgram(user: User | null, program: Program): boolean {
  if (!user || !program) return false;
  return user.id === program.author_id;
}

/**
 * Fetch all programs for a workspace
 */
export async function fetchPrograms(workspaceId: string): Promise<Program[]> {
  const url = buildApiUrl(`/workspaces/${workspaceId}/programs`);
  const data = await fetchAndCheck<ProgramsResponse>(url, {
    method: "GET",
    credentials: "include",
  });

  return Array.isArray(data) ? data : data.programs || [];
}

/**
 * Assign tags to a program by tag names
 * Looks up tag IDs and assigns them to the program
 */
async function assignTagsToProgram(
  programId: string,
  tagNames: string[],
  getToken: () => Promise<string | null>
): Promise<void> {
  for (const tagName of tagNames) {
    try {
      const tagId = await findTagIdByName(tagName);
      if (!tagId) continue;
      await addTagToContent(programId, tagId, getToken);
    } catch {
      // Continue with other tags even if one fails
    }
  }
}

/**
 * Fetch a single program by ID
 */
export async function fetchProgramById(id: string): Promise<Program> {
  const url = buildApiUrl(`/programs/${id}`);
  return fetchAndCheck<Program>(url, {
    method: "GET",
    credentials: "include",
  });
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
    description: input.description?.trim() || "",
    image: input.image?.trim() || null,
    content_type: "program" as const,
  };

  const url = buildApiUrl(`/workspaces/${input.workspaceId}/programs`);

  const data = await fetchWithAuth<Program | Program[]>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, getToken);

  const program = Array.isArray(data) ? data[0] : data;

  if (input.tags && input.tags.length > 0) {
    await assignTagsToProgram(program.id, input.tags, getToken);
  }

  return program;
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
  const url = buildApiUrl(`/programs/${id}`);
  return fetchWithAuth<Program>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }, getToken);
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
  await fetchWithAuth(url, {
    method: "DELETE",
  }, getToken);
}

/**
 * Like or unlike a program
 */
export async function toggleProgramLike(
  programId: string,
  action: "like" | "unlike"
): Promise<{ liked: boolean; likeCount: number }> {
  const url = buildApiUrl(`/programs/${programId}/like`);
  return fetchAndCheck(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
    credentials: "include",
  });
}

/**
 * Extract unique tags from programs list
 */
export function extractTags(programs: Program[]): string[] {
  const tagNames = programs.flatMap((p) => (p.tags || []).map(t => t.name));
  return Array.from(new Set(tagNames));
}

/**
 * Filter programs by search query
 */
export function filterProgramsByQuery(
  programs: Program[],
  query: string
): Program[] {
  if (!query.trim()) return programs;

  const q = query.trim().toLowerCase();
  return programs.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
  );
}

/**
 * Filter programs by tags (OR logic - matches ANY selected tag)
 */
export function filterProgramsByTags(
  programs: Program[],
  selectedTags: string[]
): Program[] {
  if (selectedTags.length === 0) return programs;

  return programs.filter((p) => {
    const programTagNames = (p.tags || []).map(t => t.name);
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
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
      );
    case "most-liked":
      return sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "is"));
    default:
      return sorted;
  }
}