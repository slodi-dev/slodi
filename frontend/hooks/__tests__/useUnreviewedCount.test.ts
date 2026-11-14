import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUnreviewedCount } from "../useUnreviewedCount";

const fetchUnreviewedCount = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  fetchUnreviewedCount: (...args: unknown[]) => fetchUnreviewedCount(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken: async () => "tok" }),
}));

beforeEach(() => {
  fetchUnreviewedCount.mockReset();
});

describe("useUnreviewedCount", () => {
  it("reports what the board says is waiting", async () => {
    fetchUnreviewedCount.mockResolvedValue(12);
    const { result } = renderHook(() => useUnreviewedCount("moderator"));
    await waitFor(() => expect(result.current).toBe(12));
  });

  it("an admin outranks moderator, so the badge works for them too", async () => {
    fetchUnreviewedCount.mockResolvedValue(4);
    const { result } = renderHook(() => useUnreviewedCount("admin"));
    await waitFor(() => expect(result.current).toBe(4));
  });

  it.each(["member", "viewer", undefined] as const)(
    "never asks the board when the user is %s",
    async (permissions) => {
      const { result } = renderHook(() => useUnreviewedCount(permissions));
      await waitFor(() => expect(result.current).toBe(0));
      expect(fetchUnreviewedCount).not.toHaveBeenCalled();
    }
  );

  it("falls back to no badge when the fetch fails, rather than taking the nav down", async () => {
    fetchUnreviewedCount.mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useUnreviewedCount("moderator"));
    await waitFor(() => expect(result.current).toBe(0));
  });
});
