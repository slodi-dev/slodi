/**
 * Tags API Service
 * Handles all API calls related to tags
 */

import { buildApiUrl, fetchAndCheck } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

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

  const url = buildApiUrl(`/tags${params.toString() ? `?${params.toString()}` : ""}`);
  return fetchAndCheck<Tag[]>(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
}

type GetToken = () => Promise<string | null>;

/**
 * Create a new tag
 *
 * Writes need a bearer token: the API reads auth from the Authorization
 * header, not from cookies, so `credentials: "include"` alone sent these as
 * anonymous requests and every one was refused.
 */
export async function createTag(input: TagCreateInput, getToken: GetToken): Promise<Tag> {
  const url = buildApiUrl("/tags");
  return fetchWithAuth<Tag>(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: input.name.trim() }),
    },
    getToken
  );
}

/**
 * Update a tag
 */
export async function updateTag(id: string, name: string, getToken: GetToken): Promise<Tag> {
  const url = buildApiUrl(`/tags/${id}`);
  return fetchWithAuth<Tag>(
    url,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: name.trim() }),
    },
    getToken
  );
}

/**
 * Delete a tag
 */
export async function deleteTag(id: string, getToken: GetToken): Promise<void> {
  const url = buildApiUrl(`/tags/${id}`);
  await fetchWithAuth<void>(url, { method: "DELETE" }, getToken);
}

/**
 * Extract tag names from Tag objects
 */
export function extractTagNames(tags: Tag[]): string[] {
  return tags.map((tag) => tag.name);
}
