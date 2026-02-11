import { buildApiUrl } from "@/lib/api-utils";

export type User = {
  id: string;
  auth0_id: string;
  email: string;
  name: string;
  pronouns?: string | null;
  preferences?: Record<string, unknown> | null;
};

export type UserUpdateInput = {
  name?: string;
  pronouns?: string | null;
  preferences?: Record<string, unknown> | null;
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