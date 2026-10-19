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
 * A failed tag request: the HTTP status plus the backend's raw `detail`.
 *
 * The tag page decides what to tell the reader from `status` (409 is a
 * duplicate name, 404 a tag that is already gone), never from the wording of
 * `detail`, which is English and may change (UX rule 3). `status` is 0 when
 * the request never got an answer.
 */
export class TagRequestError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API error: ${status}`);
    this.name = "TagRequestError";
    this.status = status;
    this.detail = detail;
  }
}

/** FastAPI puts the reason in `detail`: a string, or a list of field errors (422). */
async function readDetail(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail ?? body?.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string }) => e.msg ?? "").join("; ");
  }
  return response.statusText;
}

/**
 * Sends one authenticated tag request and returns the response when it is ok.
 *
 * Writes need a bearer token: the API reads auth from the Authorization
 * header, not from cookies, so `credentials: "include"` alone sent these as
 * anonymous requests and every one was refused. A 401 goes to login and back
 * to this page (UX rule 9); any other failure throws a `TagRequestError`.
 */
async function sendTagRequest(
  url: string,
  init: RequestInit,
  getToken: GetToken
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new TagRequestError(401, "No authentication token available");

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch (err) {
    throw new TagRequestError(0, err instanceof Error ? err.message : "Network error");
  }
  if (response.ok) return response;

  if (response.status === 401) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login?returnTo=${returnTo}`;
  }
  const detail = await readDetail(response);
  console.error(`[API ${response.status}]`, detail);
  throw new TagRequestError(response.status, detail);
}

/** The JSON body, or undefined for 204 and empty answers. */
async function readJson<T>(response: Response): Promise<T> {
  const text = response.status === 204 ? "" : await response.text();
  return (text.trim() ? JSON.parse(text) : undefined) as T;
}

/** The backend's largest page (`backend/app/core/pagination.py`). */
const TAGS_PAGE_LIMIT = 200;

/**
 * Every tag in the bank, fetched page by page.
 *
 * `GET /tags` returns 50 by default, so a plain fetch showed the first 50 tags
 * as if they were all of them. The total comes from `X-Total-Count`; when that
 * header is missing, a short page is the last one.
 */
export async function fetchAllTags(getToken: GetToken): Promise<Tag[]> {
  const all: Tag[] = [];
  for (;;) {
    const url = buildApiUrl(`/tags?limit=${TAGS_PAGE_LIMIT}&offset=${all.length}`);
    const response = await sendTagRequest(url, { method: "GET" }, getToken);
    const page = (await readJson<Tag[]>(response)) ?? [];
    all.push(...page);
    const header = response.headers.get("X-Total-Count");
    const reachedTotal = header !== null && all.length >= Number(header);
    if (page.length < TAGS_PAGE_LIMIT || reachedTotal) return all;
  }
}

/**
 * How many items (einingar) carry a tag, read from `X-Total-Count` of a
 * one-row listing. Null when the backend doesn't say.
 *
 * The backend counts only items in the caller's own workspaces (all of them
 * for a platform admin).
 */
export async function fetchTagUsageCount(id: string, getToken: GetToken): Promise<number | null> {
  const url = buildApiUrl(`/tags/${id}/content?limit=1`);
  const response = await sendTagRequest(url, { method: "GET" }, getToken);
  const header = response.headers.get("X-Total-Count");
  const total = header === null ? NaN : Number(header);
  return Number.isFinite(total) ? total : null;
}

/** Create a new tag. Throws `TagRequestError` (409 when the name is taken). */
export async function createTag(input: TagCreateInput, getToken: GetToken): Promise<Tag> {
  const response = await sendTagRequest(
    buildApiUrl("/tags"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name.trim() }),
    },
    getToken
  );
  return readJson<Tag>(response);
}

/**
 * Get a single tag by ID
 */
export async function fetchTagById(id: string, getToken: GetToken): Promise<Tag> {
  const url = buildApiUrl(`/tags/${id}`);
  return fetchWithAuth<Tag>(url, { method: "GET" }, getToken);
}

/** Rename a tag. Throws `TagRequestError` (409 when the name is taken). */
export async function updateTag(id: string, name: string, getToken: GetToken): Promise<Tag> {
  const response = await sendTagRequest(
    buildApiUrl(`/tags/${id}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    },
    getToken
  );
  return readJson<Tag>(response);
}

/**
 * Delete a tag, and with it every item's link to it. Permanent: the backend
 * has no soft delete. Throws `TagRequestError` (404 when it's already gone).
 */
export async function deleteTag(id: string, getToken: GetToken): Promise<void> {
  await sendTagRequest(buildApiUrl(`/tags/${id}`), { method: "DELETE" }, getToken);
}

/**
 * Extract tag names from Tag objects
 */
export function extractTagNames(tags: Tag[]): string[] {
  return tags.map((tag) => tag.name);
}

/**
 * Get all tags for a specific content item
 */
export async function fetchContentTags(contentId: string, getToken: GetToken): Promise<Tag[]> {
  const url = buildApiUrl(`/content/${contentId}/tags`);
  return fetchWithAuth<Tag[]>(url, { method: "GET" }, getToken);
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
      Authorization: `Bearer ${token}`,
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
      Authorization: `Bearer ${token}`,
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
  const exactMatch = tags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
  return exactMatch?.id || null;
}
