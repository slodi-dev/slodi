import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnreviewedCountProvider, useUnreviewedCount } from "@/contexts/UnreviewedCountContext";

const fetchUnreviewedCount = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  fetchUnreviewedCount: (...args: unknown[]) => fetchUnreviewedCount(...args),
}));

let permissions: string | undefined = "moderator";
const getToken = async () => "tok";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { permissions }, getToken }),
}));

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

let refresh: () => Promise<void> = async () => {};
function Badge() {
  const value = useUnreviewedCount();
  refresh = value.refresh;
  return <span data-testid="count">{value.count}</span>;
}

function renderBadge() {
  return render(
    <UnreviewedCountProvider>
      <Badge />
    </UnreviewedCountProvider>
  );
}

beforeEach(() => {
  fetchUnreviewedCount.mockReset();
  permissions = "moderator";
  pathname = "/";
});

describe("UnreviewedCountProvider", () => {
  it.each(["moderator", "admin"])("shows what waits for a %s", async (p) => {
    permissions = p;
    fetchUnreviewedCount.mockResolvedValue(12);
    renderBadge();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("12"));
  });

  it.each(["member", "viewer", undefined])("never asks when the user is %s", async (p) => {
    permissions = p;
    renderBadge();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    expect(fetchUnreviewedCount).not.toHaveBeenCalled();
  });

  it("shows no badge when the request fails", async () => {
    fetchUnreviewedCount.mockRejectedValue(new Error("500"));
    renderBadge();
    await waitFor(() => expect(fetchUnreviewedCount).toHaveBeenCalled());
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("asks again on refresh, as after a review", async () => {
    fetchUnreviewedCount.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    renderBadge();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("5"));
    await act(() => refresh());
    expect(screen.getByTestId("count").textContent).toBe("4");
  });

  it("asks again on another page", async () => {
    fetchUnreviewedCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    const { rerender } = renderBadge();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("5"));
    pathname = "/programs";
    rerender(
      <UnreviewedCountProvider>
        <Badge />
      </UnreviewedCountProvider>
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
  });
});
