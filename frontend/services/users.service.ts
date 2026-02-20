import { buildApiUrl } from "@/lib/api-utils";

export type UserPermissions = "viewer" | "member" | "admin";

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
export async function updateCurrentUser(
  token: string,
  updates: UserUpdateInput
): Promise<User> {
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

  const url = `${buildApiUrl("/users")}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to list users: ${response.status} - ${errorBody}`);
  }

  const items: User[] = await response.json();
  const totalHeader = response.headers.get("X-Total-Count");
  const total = totalHeader ? parseInt(totalHeader, 10) : items.length;

  return { items, total };
}

/**
 * Update any user's fields as an admin (admin only).
 */
export async function adminUpdateUser(
  token: string,
  userId: string,
  updates: AdminUserUpdateInput
): Promise<User> {
  const url = buildApiUrl(`/users/${userId}`);

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
 * Delete a user (admin only).
 */
export async function adminDeleteUser(
  token: string,
  userId: string
): Promise<void> {
  const url = buildApiUrl(`/users/${userId}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to delete user: ${response.status} - ${errorBody}`);
  }
}