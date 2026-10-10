import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../AuthContext";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockAuth0User: { sub: string } | null = { sub: "auth0|1" };
vi.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({ user: mockAuth0User, isLoading: false }),
}));

const getCurrentUserMock = vi.fn();
vi.mock("@/services/users.service", () => ({
  getCurrentUser: (token: string) => getCurrentUserMock(token),
}));

let tokenCounter = 0;
let fetchMock: ReturnType<typeof vi.fn>;
let now = 1_000_000;

function tokenResponse() {
  tokenCounter += 1;
  const accessToken = `tok-${tokenCounter}`;
  return { ok: true, status: 200, json: () => Promise.resolve({ accessToken }) };
}

const SIX_MINUTES = 6 * 60 * 1000;

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  mockAuth0User = { sub: "auth0|1" };
  tokenCounter = 0;
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  fetchMock = vi.fn(() => Promise.resolve(tokenResponse()));
  vi.stubGlobal("fetch", fetchMock);
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue({ id: "u1", name: "Signý" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AuthProvider getToken", () => {
  it("keeps getToken's identity when the cached token expires and is refreshed", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    const firstGetToken = result.current.getToken;
    await expect(firstGetToken()).resolves.toBe("tok-1");

    now += SIX_MINUTES;
    let refreshed: string | null = null;
    await act(async () => {
      refreshed = await result.current.getToken();
    });

    expect(refreshed).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.getToken).toBe(firstGetToken);
  });

  it("does not refetch /users/me when the token is refreshed", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    now += SIX_MINUTES;
    await act(async () => {
      await result.current.getToken();
    });

    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
  });

  it("shares one /api/auth/token request between concurrent callers", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    fetchMock.mockClear();

    now += SIX_MINUTES;
    let tokens: (string | null)[] = [];
    await act(async () => {
      tokens = await Promise.all([
        result.current.getToken(),
        result.current.getToken(),
        result.current.getToken(),
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(["tok-2", "tok-2", "tok-2"]);
  });

  it("does not rerun consumer effects that depend on getToken after a refresh", async () => {
    // Mirrors useProgram / usePrograms / useWorkspaceRole, which load data in
    // an effect keyed on getToken.
    const loads = vi.fn();
    let latest: ReturnType<typeof useAuth> | null = null;

    function Consumer() {
      const auth = useAuth();
      latest = auth;
      const { getToken } = auth;
      useEffect(() => {
        loads();
        void getToken();
      }, [getToken]);
      return null;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(latest?.user).not.toBeNull());

    now += SIX_MINUTES;
    await act(async () => {
      await latest!.getToken();
    });

    expect(loads).toHaveBeenCalledTimes(1);
  });

  it("does not refetch /users/me when Auth0 returns a new object for the same user", async () => {
    const { result, rerender } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    mockAuth0User = { sub: "auth0|1" };
    rerender();
    await act(async () => {});

    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
  });
});
