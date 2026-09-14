import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import AuthorStandingPanel from "../AuthorStandingPanel";
import type { AuthorStanding } from "@/services/suspensions.service";

const fetchAuthorStanding = vi.fn();

vi.mock("@/services/suspensions.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/suspensions.service")>()),
  fetchAuthorStanding: (...a: unknown[]) => fetchAuthorStanding(...a),
}));

// Stable across renders, as the real context's is; a fresh function each
// render would re-run the panel's fetch effect on every update.
const getToken = async () => "t";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getToken }),
}));

const standing = (authorId: string, strikes: number): AuthorStanding => ({
  author_id: authorId,
  reports_received: 0,
  strikes,
  suspensions: [],
  active_suspension: null,
});

const summary = { reports: 0, strikes: 0, spells: 0, suspendedUntil: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const strikesShown = () =>
  screen.getByText("áminningar").closest("div")!.querySelector("dd")!.textContent;

describe("AuthorStandingPanel", () => {
  beforeEach(() => fetchAuthorStanding.mockReset());

  it("does not show the previous author's history when it arrives late", async () => {
    const first = deferred<AuthorStanding>();
    fetchAuthorStanding.mockReturnValueOnce(first.promise);
    fetchAuthorStanding.mockResolvedValueOnce(standing("a2", 1));

    const { rerender } = render(
      <AuthorStandingPanel authorId="a1" authorName="Fyrri" summary={summary} />
    );
    rerender(<AuthorStandingPanel authorId="a2" authorName="Seinni" summary={summary} />);
    await waitFor(() => expect(strikesShown()).toBe("1"));

    await act(async () => first.resolve(standing("a1", 7)));
    expect(strikesShown()).toBe("1");
  });

  it("does not report a failure for an author it is no longer showing", async () => {
    const first = deferred<AuthorStanding>();
    fetchAuthorStanding.mockReturnValueOnce(first.promise);
    fetchAuthorStanding.mockResolvedValueOnce(standing("a2", 0));

    const { rerender } = render(
      <AuthorStandingPanel authorId="a1" authorName="Fyrri" summary={summary} />
    );
    rerender(<AuthorStandingPanel authorId="a2" authorName="Seinni" summary={summary} />);
    await waitFor(() => expect(fetchAuthorStanding).toHaveBeenCalledTimes(2));

    await act(async () => first.reject(new Error("offline")));
    expect(screen.queryByText("Ekki tókst að sækja sögu höfundar.")).toBeNull();
  });
});
