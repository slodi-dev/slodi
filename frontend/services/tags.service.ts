/**
 * Tags API Service
 * Handles all API calls related to tags
 */

import { buildApiUrl, fetchAndCheck } from "@/lib/api-utils";

export type Tag = {
  id: string;
  name: string;
};

export type TagCreateInput = {
  name: string;
};

/**
 * Fetch all tags
 * @param query Optional search query to filter tags by name
 * @param token Bearer token for authentication
 */
export async function fetchTags(query?: string, token?: string): Promise<Tag[]> {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.append("q", query.trim());
  }

  const url = buildApiUrl(`/tags${params.toString() ? `?${params.toString()}` : ''}`);
  return fetchAndCheck<Tag[]>(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
}

/**
 * Create a new tag
 */
export async function createTag(input: TagCreateInput): Promise<Tag> {
  const url = buildApiUrl("/tags");
  return fetchAndCheck<Tag>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: input.name.trim() }),
    credentials: "include",
  });
}

/**
 * Get a single tag by ID
 */
export async function fetchTagById(id: string): Promise<Tag> {
  const url = buildApiUrl(`/tags/${id}`);
  return fetchAndCheck<Tag>(url, {
    method: "GET",
    credentials: "include",
  });
}

/**
 * Update a tag
 */
export async function updateTag(id: string, name: string): Promise<Tag> {
  const url = buildApiUrl(`/tags/${id}`);
  return fetchAndCheck<Tag>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.trim() }),
    credentials: "include",
  });
}

/**
 * Delete a tag
 */
export async function deleteTag(id: string): Promise<void> {
  const url = buildApiUrl(`/tags/${id}`);
  await fetchAndCheck(url, {
    method: "DELETE",
    credentials: "include",
  });
}

/**
 * Extract tag names from Tag objects
 */
export function extractTagNames(tags: Tag[]): string[] {
  return tags.map(tag => tag.name);
}

/**
 * Get all tags for a specific content item
 */
export async function fetchContentTags(contentId: string): Promise<Tag[]> {
  const url = buildApiUrl(`/content/${contentId}/tags`);
  return fetchAndCheck<Tag[]>(url, {
    method: "GET",
    credentials: "include",
  });
}

/**
 * Add a tag to content (by tag ID)
 * Returns whether the tag was newly created (true) or already existed (false)
 */
export async function addTagToContent(
  contentId: string,
  tagId: string,
  getToken: () => Promise<string | null>
): Promise<{ created: boolean }> {
  const url = buildApiUrl(`/content/${contentId}/tags/${tagId}`);
  
  const token = await getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add tag: ${error}`);
  }

  // 201 = created, 200 = already existed
  return { created: response.status === 201 };
}

/**
 * Remove a tag from content
 */
export async function removeTagFromContent(
  contentId: string,
  tagId: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const url = buildApiUrl(`/content/${contentId}/tags/${tagId}`);
  
  const token = await getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to remove tag: ${error}`);
  }
}

/**
 * Find tag ID by tag name
 * Returns null if tag doesn't exist
 */
export async function findTagIdByName(tagName: string): Promise<string | null> {
  const tags = await fetchTags(tagName);
  const exactMatch = tags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
  return exactMatch?.id || null;
}
