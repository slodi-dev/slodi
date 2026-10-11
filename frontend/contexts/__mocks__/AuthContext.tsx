/**
 * Storybook mock of `contexts/AuthContext`. Registered with `sb.mock()` in
 * `.storybook/preview.tsx`, so every component that calls `useAuth()` gets a
 * fixture user instead of Auth0 and the backend.
 *
 * Pick the user per story with `parameters.auth`:
 * "member" (default) | "moderator" | "admin" | "anonymous" | "loading".
 *
 * Vitest ignores this file: the unit tests mock AuthContext with inline
 * factories, and `__mocks__` is only read for factory-less `vi.mock()` calls.
 */
import { createContext, useContext, type ReactNode } from "react";
import { currentMockUser, getMockAuthMode } from "@/.storybook/mocks/fetch";
import type { User } from "@/services/users.service";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  getToken: () => Promise<string | null>;
  refetch: () => Promise<void>;
};

// One stable object per auth mode, so hooks that list `getToken` in their
// effect dependencies do not refetch on every render.
const cache = new Map<string, AuthContextType>();

function buildValue(): AuthContextType {
  const mode = getMockAuthMode();
  const cached = cache.get(mode);
  if (cached) return cached;
  const user = currentMockUser();
  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: mode === "loading",
    error: null,
    getToken: async () => (user ? "sb-token" : null),
    refetch: async () => {},
  };
  cache.set(mode, value);
  return value;
}

const MockAuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <MockAuthContext.Provider value={buildValue()}>{children}</MockAuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  return useContext(MockAuthContext) ?? buildValue();
}
