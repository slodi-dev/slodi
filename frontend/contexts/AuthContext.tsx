"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useUser as useAuth0User } from "@auth0/nextjs-auth0/client";
import { getCurrentUser, type User } from "@/services/users.service";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  getToken: () => Promise<string | null>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type TokenCache = {
  token: string;
  expiresAt: number;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tokenCache, setTokenCache] = useState<TokenCache | null>(null);

  /**
   * Get fresh access token for API calls
   * Caches token for 5 minutes to avoid excessive API calls
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    // Return cached token if still valid
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache.token;
    }

    try {
      const response = await fetch("/api/auth/token");

      if (response.status === 401) {
        // Token expired or invalid - clear user state and force re-login
        setUser(null);
        setTokenCache(null);
        // Redirect to logout to clear the stale Auth0 session cookie
        window.location.href = "/api/auth/logout";
        return null;
      }

      if (!response.ok) {
        console.error("Failed to get access token from session");
        return null;
      }

      const data = await response.json();
      const token = data.accessToken;

      if (token) {
        // Cache token for 5 minutes
        setTokenCache({
          token,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
      }

      return token || null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }, [tokenCache]);

  /**
   * Fetch user from backend when Auth0 authentication completes
   * Backend will auto-create user if first login
   */
  const fetchBackendUser = useCallback(async () => {
    if (!auth0User) {
      setUser(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        console.warn(
          "No access token available - user may not be fully authenticated yet"
        );
        setUser(null);
        return;
      }

      // Backend will auto-create user if first login
      const backendUser = await getCurrentUser(token);
      setUser(backendUser);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("Failed to fetch backend user:", error);
      setError(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [auth0User, getToken]);

  // Fetch backend user when Auth0 auth state changes
  useEffect(() => {
    if (!auth0IsLoading) {
      if (auth0User) {
        fetchBackendUser();
      } else {
        setUser(null);
        setIsLoading(false);
        setError(null);
        setTokenCache(null);
      }
    }
  }, [auth0User, auth0IsLoading, fetchBackendUser]);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading: isLoading || auth0IsLoading,
        error,
        getToken,
        refetch: fetchBackendUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}