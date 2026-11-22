"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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

/** How long a fetched access token is reused before asking the session again. */
const TOKEN_CACHE_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: auth0User, isLoading: auth0IsLoading } = useAuth0User();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // The token lives in refs rather than state so refreshing it neither
  // re-renders the tree nor changes getToken's identity. Hooks list getToken
  // in their effect dependencies, so a new identity would refetch their data.
  const tokenCacheRef = useRef<TokenCache | null>(null);
  const inFlightRef = useRef<Promise<string | null> | null>(null);

  /**
   * Get an access token for API calls.
   * Reuses a cached token for 5 minutes, and concurrent callers share a single
   * request instead of each hitting /api/auth/token. Stable across renders.
   */
  const getToken = useCallback((): Promise<string | null> => {
    const cached = tokenCacheRef.current;
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.token);
    }

    if (!inFlightRef.current) {
      inFlightRef.current = fetchSessionToken({
        onToken: (token) => {
          tokenCacheRef.current = { token, expiresAt: Date.now() + TOKEN_CACHE_MS };
        },
        onUnauthorized: () => {
          setUser(null);
          tokenCacheRef.current = null;
        },
      }).finally(() => {
        inFlightRef.current = null;
      });
    }
    return inFlightRef.current;
  }, []);

  // Key the backend fetch on the Auth0 identity, not the user object, so a
  // session revalidation that yields a new object for the same person does
  // not refetch /users/me.
  const auth0Sub = auth0User?.sub ?? null;

  /**
   * Fetch user from backend when Auth0 authentication completes
   * Backend will auto-create user if first login
   */
  const fetchBackendUser = useCallback(async () => {
    if (!auth0Sub) {
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
        console.warn("No access token available - user may not be fully authenticated yet");
        setUser(null);
        return;
      }

      // Backend will auto-create user if first login
      const backendUser = await getCurrentUser(token);
      setUser(backendUser);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("Failed to fetch backend user:", error);
      setError(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [auth0Sub, getToken]);

  // Fetch backend user when Auth0 auth state changes
  useEffect(() => {
    if (!auth0IsLoading) {
      if (auth0Sub) {
        fetchBackendUser();
      } else {
        setUser(null);
        setIsLoading(false);
        setError(null);
        tokenCacheRef.current = null;
      }
    }
  }, [auth0Sub, auth0IsLoading, fetchBackendUser]);

  const isAuthenticated = !!user;
  const combinedIsLoading = isLoading || auth0IsLoading;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading: combinedIsLoading,
      error,
      getToken,
      refetch: fetchBackendUser,
    }),
    [user, isAuthenticated, combinedIsLoading, error, getToken, fetchBackendUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Ask the Next.js session route for the current access token. */
async function fetchSessionToken({
  onToken,
  onUnauthorized,
}: {
  onToken: (token: string) => void;
  onUnauthorized: () => void;
}): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/token");

    if (response.status === 401) {
      onUnauthorized();
      // Redirect to login (not logout) so the user can re-authenticate and
      // return to exactly where they were. Their localStorage draft survives.
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth/login?returnTo=${returnTo}`;
      return null;
    }

    if (!response.ok) {
      console.error("Failed to get access token from session");
      return null;
    }

    const data = await response.json();
    const token = data.accessToken;

    if (token) {
      onToken(token);
    }

    return token || null;
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
