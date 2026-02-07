/**
 * User API Service
 * Handles all API calls related to users
 */

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
  // Toggle this to enable/disable debug logging for user fetching
  const DEBUG_GET_USER = true;

  const url = buildApiUrl("/users/me");

  if (DEBUG_GET_USER) {
    console.log("=== getCurrentUser Debug ===");
    console.log("URL:", url);
    console.log("Token length:", token.length);
    console.log("Token starts with:", token.substring(0, 30) + "...");
    console.log("Token ends with:", "..." + token.substring(token.length - 30));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (DEBUG_GET_USER) {
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Error response body:", errorBody);
    throw new Error(`Failed to get user: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  if (DEBUG_GET_USER) {
    console.log("User data received:", data);
  }
  return data;
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