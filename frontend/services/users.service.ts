import { buildApiUrl } from "@/lib/api-utils";

/**
 * Ranked viewer < member < moderator < admin.
 *
 * `moderator` is Dagskrárstjórnarteymið: they sweep the Yfirferð board and can
 * hide or reject anything in the bank, with none of an admin's reach over users,
 * workspaces or settings.
 */
export type UserPermissions = "viewer" | "member" | "moderator" | "admin";

const PERMISSION_RANK: Record<UserPermissions, number> = {
  viewer: 0,
  member: 1,
  moderator: 2,
  admin: 3,
};

/** Mirrors `_PERMISSION_RANK` in `backend/app/core/auth.py`. */
export function hasPermission(
  permissions: UserPermissions | null | undefined,
  minimum: UserPermissions
): boolean {
  if (!permissions) return false;
  return PERMISSION_RANK[permissions] >= PERMISSION_RANK[minimum];
}

export type User = {
  id: string;
  auth0_id: string;
  email: string;
  name: string;
  pronouns?: string | null;
  preferences?: Record<string, unknown> | null;
  permissions: UserPermissions;
};

export type UserUpdateInput = {
  name?: string;
  pronouns?: string | null;
  preferences?: Record<string, unknown> | null;
};

export type AdminUserUpdateInput = {
  name?: string;
  pronouns?: string | null;
  permissions?: UserPermissions;
  preferences?: Record<string, unknown> | null;
  email?: string;
};

export type PaginatedUsersResult = {
  items: User[];
  total: number;
};

/**
 * A failed admin request, with the HTTP status so the page can pick its own
 * Icelandic message. Status 0 is a network failure. `detail` is the backend's
 * text, for the console and small print only.
 */
export class UserRequestError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API error: ${status}`);
    this.name = "UserRequestError";
    this.status = status;
    this.detail = detail;
  }
}

/** Sends one admin request; throws `UserRequestError` unless the response is ok. */
async function sendAdminRequest(url: string, token: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch (err) {
    throw new UserRequestError(0, err instanceof Error ? err.message : "Network error");
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error(`[API ${response.status}]`, detail);
    throw new UserRequestError(response.status, detail);
  }
  return response;
}

export type ListUsersParams = {
  q?: string;
  limit?: number;
  offset?: number;
};

/**
 * Get current authenticated user from backend.
 * Backend will auto-create user on first login.
 */
export async function getCurrentUser(token: string): Promise<User> {
  const url = buildApiUrl("/users/me");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to get user: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Update current user profile
 */
export async function updateCurrentUser(token: string, updates: UserUpdateInput): Promise<User> {
  const url = buildApiUrl("/users/me");

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update user: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * List all users (admin only). Returns items + total from pagination headers.
 */
export async function listUsers(
  token: string,
  params: ListUsersParams = {}
): Promise<PaginatedUsersResult> {
  const { q, limit = 50, offset = 0 } = params;
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (q && q.length >= 2) searchParams.set("q", q);

  const url = `${buildApiUrl("/users/admin/list")}?${searchParams.toString()}`;
  const response = await sendAdminRequest(url, token);

  const items: User[] = await response.json();
  const totalHeader = response.headers.get("X-Total-Count");
  const total = totalHeader ? parseInt(totalHeader, 10) : items.length;

  return { items, total };
}

/** The most the backend returns in one page (`Limit`, `app/core/pagination.py`). */
const USERS_PAGE_LIMIT = 200;

/**
 * Every user (admin only), paged through in the backend's largest pages, so the
 * page can search, filter and count on the whole list.
 */
export async function listAllUsers(token: string): Promise<User[]> {
  const all: User[] = [];
  for (;;) {
    const page = await listUsers(token, { limit: USERS_PAGE_LIMIT, offset: all.length });
    all.push(...page.items);
    if (page.items.length < USERS_PAGE_LIMIT || all.length >= page.total) return all;
  }
}

/**
 * Update any user's fields as an admin (admin only).
 */
export async function adminUpdateUser(
  token: string,
  userId: string,
  updates: AdminUserUpdateInput
): Promise<User> {
  const response = await sendAdminRequest(buildApiUrl(`/users/${userId}`), token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return response.json();
}

/**
 * Delete a user (admin only).
 */
export async function adminDeleteUser(token: string, userId: string): Promise<void> {
  await sendAdminRequest(buildApiUrl(`/users/${userId}`), token, { method: "DELETE" });
}
